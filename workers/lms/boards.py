"""Selective board reads; navigation copied from reviewed Notifier v5 collector.

Only freshly read details enter the upstream database. Complete list traversal
remains mandatory; list completeness does not mean all bodies were refreshed.
"""
from datetime import datetime, timezone
from hashlib import sha256
from session import wait_for_link
from html.parser import HTMLParser

from dju_lms_notifier.lms.notices import (
    NoticeReadError, checked, list_response,
)
from dju_lms_notifier.parsers.notices import (
    CALL, IncompleteNoticeList, parse_board_page, merge_board_pages,
)


def move_page(page, board_id, number, session):
    link = page.locator(f'a[href="javascript:listPaging({number})"]')
    link.wait_for(state="attached", timeout=10000)
    if link.count() != 1:
        raise IncompleteNoticeList("Required page link is unavailable.")
    session.before_request()
    with page.expect_response(lambda r: list_response(r, board_id, number), timeout=30000) as pending:
        link.click()
    result = parse_board_page(checked(pending.value).text(), board_id)
    if any(ref.page != str(number) for ref in result.refs):
        raise IncompleteNoticeList("Unexpected page response.")
    return result


class Titles(HTMLParser):
    """Only article-link text is stable evidence; exclude counts and row order."""
    def __init__(self):
        super().__init__()
        self.active = None
        self.text = []
        self.signatures = {}

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            match = CALL.fullmatch(dict(attrs).get("href", ""))
            if match:
                self.active = match[2]
                self.text = []

    def handle_data(self, data):
        if self.active is not None:
            self.text.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self.active is not None:
            title = " ".join("".join(self.text).split())
            if not title or self.active in self.signatures:
                raise NoticeReadError("Missing or duplicate board title.")
            self.signatures[self.active] = sha256(title.encode()).hexdigest()
            self.active = None


def read_listing(page, first, board_id, first_html, session):
    pages, signatures = [first], {}
    def capture(current, html):
        parser = Titles()
        parser.feed(html)
        for ref in current.refs:
            if ref.article_id not in parser.signatures:
                raise NoticeReadError("Article title unavailable.")
            signatures[ref.article_id] = parser.signatures[ref.article_id]
    capture(first, first_html)
    number = 1
    while sum(len(p.refs) for p in pages) < first.total:
        number += 1
        if number > 100 or number not in pages[-1].pages:
            raise IncompleteNoticeList("Unverified pagination or traversal limit.")
        link = page.locator(f'a[href="javascript:listPaging({number})"]')
        link.wait_for(state="attached", timeout=10000)
        if link.count() != 1:
            raise IncompleteNoticeList("Required page link is unavailable.")
        session.before_request()
        with page.expect_response(lambda r: list_response(r, board_id, number), timeout=30000) as pending:
            link.click()
        html = checked(pending.value).text()
        following = parse_board_page(html, board_id)
        if any(ref.page != str(number) for ref in following.refs):
            raise IncompleteNoticeList("Unexpected page response.")
        if following.total != first.total:
            raise IncompleteNoticeList("Board changed during pagination.")
        pages.append(following)
        capture(following, html)
    return merge_board_pages(pages), signatures


class BoardPolicy:
    def __init__(self, state, connection, now=None):
        self.state = state
        self.connection = connection
        self.now = now or datetime.now(timezone.utc)
        self.fresh = {}
        self.listed_at = {}

    def key(self, ref):
        return ref.board_id + ":" + ref.article_id

    def listed(self, board_id, refs):
        self.listed_at[board_id] = self.now.isoformat()

    def due(self, ref, signature):
        accepted = self.connection.execute("""SELECT 1 FROM accepted_items a
            JOIN items i USING(item_id) JOIN collection_scopes c
            ON c.course_id=a.course_id AND c.item_type=a.item_type AND c.scope=a.scope
            WHERE i.namespace=? AND i.external_id=? AND c.baseline_complete=1""",
            (ref.board_id, ref.article_id)).fetchone()
        if not accepted:
            return True
        entry = self.state.get(self.key(ref))
        if not entry or entry.get("signature") != signature:
            return True
        return False

    def reuse(self, ref, signature):
        # Retry an interrupted course without opening successful details twice.
        value = self.fresh.get(self.key(ref))
        return value[1] if value and value[0] == signature else None

    def remember(self, ref, signature, item):
        self.fresh[self.key(ref)] = (signature, item)

    def committed(self, results):
        # Called ONLY after upstream DB commit. Failed courses never advance clocks.
        for result in results:
            if result.error:
                continue
            for item in result.items:
                key = item.board_id + ":" + item.article_id
                signature, _ = self.fresh[key]
                self.state[key] = {"signature": signature, "detailCheckedAt": self.now.isoformat()}


def collect_course(page, course, board_kind, detail_parser, policy, *, list_url, session):
    if board_kind not in {"N", "P"}:
        raise NoticeReadError("Unsupported board kind.")
    board_id = f"BBS_{course.course_id}_{board_kind}"
    session.before_request()
    with page.expect_response(lambda r: list_response(r, board_id, 1), timeout=30000) as listing:
        checked(page.goto(list_url, wait_until="domcontentloaded", timeout=30000))
    first_html = checked(listing.value).text()
    first = parse_board_page(first_html, board_id)
    refs, signatures = read_listing(page, first, board_id, first_html, session)
    policy.listed(board_id, refs)
    # Capture only links actually emitted by this list. Never build detail URLs.
    notices = []
    list_url = page.url
    for index, ref in enumerate(refs):
        signature = signatures[ref.article_id]
        cached = policy.reuse(ref, signature)
        if cached is not None:
            notices.append(cached)
            continue
        if not policy.due(ref, signature):
            continue
        if index or first.total > len(first.refs):
            session.before_request()
            with page.expect_response(lambda r: list_response(r, board_id, 1), timeout=30000) as restored:
                checked(page.goto(list_url, wait_until="domcontentloaded", timeout=30000))
            current = parse_board_page(checked(restored.value).text(), board_id)
            if current.total != first.total:
                raise IncompleteNoticeList("Board changed while reading details.")
            for number in range(2, int(ref.page) + 1):
                if number not in current.pages:
                    raise IncompleteNoticeList("Article page is unavailable.")
                current = move_page(page, board_id, number, session)
                if current.total != first.total:
                    raise IncompleteNoticeList("Board changed while reading details.")
        wait_for_link(page, ref.href)
        anchors = [n for n in page.locator('a[href*="viewAtcl("]').all() if n.get_attribute("href") == ref.href]
        if len(anchors) != 1:
            raise NoticeReadError("Notice list changed during collection.")
        session.before_request()
        session.detail_attempt()
        with page.expect_navigation(wait_until="domcontentloaded", timeout=30000) as detail:
            anchors[0].click()
        checked(detail.value)
        page.locator("#atclCtsText").wait_for(state="attached", timeout=10000)
        item = detail_parser(page.content(), ref)
        policy.remember(ref, signature, item)
        notices.append(item)
    return tuple(notices)
