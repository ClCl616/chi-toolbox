"""Selective board reads; navigation copied from reviewed Notifier v5 collector.

Only freshly read details enter the upstream database. Complete list traversal
remains mandatory; list completeness does not mean all bodies were refreshed.
"""
from datetime import datetime, timezone
from hashlib import sha256
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit, parse_qs

from dju_lms_notifier.lms.notices import (
    NoticeReadError, checked, list_response, move_list_page, collect_isolated,
    CourseNoticeResult,
)
from dju_lms_notifier.lms.materials import CourseMaterialResult
from dju_lms_notifier.lms.enrollment import matches, discover_enrollment_from_page
from dju_lms_notifier.lms.auth import launch_browser, navigate_main, probe_auth
from dju_lms_notifier.lms.state import read_state
from dju_lms_notifier.parsers.notices import (
    CALL, IncompleteNoticeList, parse_board_page, merge_board_pages, parse_notice_detail,
)
from dju_lms_notifier.parsers.materials import parse_material_detail
from playwright.sync_api import sync_playwright


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


def read_listing(page, first, board_id, first_html):
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
        if link.count() != 1:
            raise IncompleteNoticeList("Required page link is unavailable.")
        page.wait_for_timeout(1000)
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


def collect_course(page, course, board_kind, detail_parser, policy):
    if board_kind not in {"N", "P"}:
        raise NoticeReadError("Unsupported board kind.")
    page.wait_for_timeout(1000)
    handler = f"classRoomMain('{course.course_id}', '{course.course_type}')"
    candidates = [n for n in page.locator('div.item[onclick]').all() if n.get_attribute("onclick") == handler]
    if len(candidates) != 1:
        raise NoticeReadError("Course menu unavailable.")
    target = candidates[0]
    with page.expect_response(lambda r: matches(r, "/bbs/bbsLect/menuBbsInfoList") and
                              parse_qs(r.request.post_data or "").get("crsCreCd") == [course.course_id], timeout=30000) as menu:
        target.locator("xpath=../..").click()
        target.click()
    checked(menu.value)
    page.locator('a[href*="atclListForm"]').first.wait_for(state="attached", timeout=10000)
    board_id = f"BBS_{course.course_id}_{board_kind}"
    urls = set()
    for anchor in page.locator('a[href*="atclListForm"]').all():
        url = urljoin("https://lms.dju.ac.kr", anchor.get_attribute("href"))
        parts = urlsplit(url)
        fields = parse_qs(parts.query)
        if (parts.scheme == "https" and parts.netloc == "lms.dju.ac.kr" and parts.path == "/bbs/bbsLect/Form/atclListForm"
                and fields.get("bbsId") == [board_id] and fields.get("crsCreCd") == [course.course_id] and "mcd" in fields):
            urls.add(url)
    if len(urls) != 1:
        raise NoticeReadError("Notice board menu unavailable or ambiguous.")
    with page.expect_response(lambda r: list_response(r, board_id, 1), timeout=30000) as listing:
        checked(page.goto(urls.pop(), wait_until="domcontentloaded", timeout=30000))
    first_html = checked(listing.value).text()
    first = parse_board_page(first_html, board_id)
    refs, signatures = read_listing(page, first, board_id, first_html)
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
        page.wait_for_timeout(1000)
        if index or first.total > len(first.refs):
            with page.expect_response(lambda r: list_response(r, board_id, 1), timeout=30000) as restored:
                checked(page.goto(list_url, wait_until="domcontentloaded", timeout=30000))
            current = parse_board_page(checked(restored.value).text(), board_id)
            if current.total != first.total:
                raise IncompleteNoticeList("Board changed while reading details.")
            for number in range(2, int(ref.page) + 1):
                if number not in current.pages:
                    raise IncompleteNoticeList("Article page is unavailable.")
                current = move_list_page(page, board_id, number)
                if current.total != first.total:
                    raise IncompleteNoticeList("Board changed while reading details.")
        anchors = [n for n in page.locator('a[href*="viewAtcl("]').all() if n.get_attribute("href") == ref.href]
        if len(anchors) != 1:
            raise NoticeReadError("Notice list changed during collection.")
        with page.expect_navigation(wait_until="domcontentloaded", timeout=30000) as detail:
            anchors[0].click()
        checked(detail.value)
        page.locator("#atclCtsText").wait_for(state="attached", timeout=10000)
        item = detail_parser(page.content(), ref)
        policy.remember(ref, signature, item)
        notices.append(item)
    return tuple(notices)



def collect_boards(path, channel, category, policy):
    kind, parser, result_type = (("N", parse_notice_detail, CourseNoticeResult)
        if category == "notices" else ("P", parse_material_detail, CourseMaterialResult))
    with sync_playwright() as playwright:
        browser = launch_browser(playwright, channel, headed=False)
        try:
            context = browser.new_context(storage_state=read_state(path), accept_downloads=False)
            page = context.new_page()
            snapshot = discover_enrollment_from_page(page)
            return collect_isolated(snapshot.courses,
                lambda course: collect_course(page, course, kind, parser, policy),
                page.wait_for_timeout, lambda: navigate_main(page),
                check_auth=lambda: probe_auth(page), result_type=result_type)
        finally:
            browser.close()
