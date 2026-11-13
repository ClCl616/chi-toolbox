"""One sequential browser session; no URLs or course identifiers in metrics."""
from contextlib import contextmanager
import time
import traceback
from pathlib import Path
from urllib.parse import parse_qs, urljoin, urlsplit

from playwright.sync_api import sync_playwright, Error as BrowserError
from dju_lms_notifier.lms.auth import launch_browser, navigate_main, ensure_authenticated, settle_auth
from dju_lms_notifier.lms.enrollment import discover_enrollment_from_page, matches
from dju_lms_notifier.lms.notices import checked, NoticeReadError
from dju_lms_notifier.lms.state import read_state

CATEGORIES = ("notices", "materials", "assignments", "exams", "lessons")
PATHS = {
    "notices": "/bbs/bbsLect/Form/atclListForm",
    "materials": "/bbs/bbsLect/Form/atclListForm",
    "assignments": "/asmnt/asmntLect/Form/stuAsmntListForm",
    "exams": "/exam/examLect/Form/stuExamListForm",
    "lessons": "/lesson/lessonLect/Form/lessonListForm",
}


def wait_for_link(page, href):
    # List response completion precedes asynchronous DOM rendering on some pages.
    page.wait_for_function("href => [...document.querySelectorAll('a[href]')].some(a => a.getAttribute('href') === href)",
                           arg=href, timeout=10000)


def menu_urls(hrefs, course_id):
    """Accept only observed links for this course; never synthesize LMS URLs."""
    found = {category: set() for category in CATEGORIES}
    for href in hrefs:
        url = urljoin("https://lms.dju.ac.kr", href)
        parts = urlsplit(url)
        fields = parse_qs(parts.query)
        if (parts.scheme != "https" or parts.netloc != "lms.dju.ac.kr"
                or fields.get("crsCreCd") != [course_id] or "mcd" not in fields):
            continue
        for category, path in PATHS.items():
            if parts.path != path:
                continue
            if category in ("notices", "materials"):
                kind = "N" if category == "notices" else "P"
                if fields.get("bbsId") != [f"BBS_{course_id}_{kind}"]:
                    continue
            found[category].add(url)
    return {category: next(iter(urls)) for category, urls in found.items() if len(urls) == 1}


class PageTrace:
    """Bounded event metadata only: never retain bodies, URLs or dialog text."""
    def __init__(self, page, metrics):
        self.page, self.metrics = page, metrics
        self.events = []
        self.pending = {}
        page.on("request", self.request)
        page.on("response", self.response)
        page.on("requestfinished", self.finished)
        page.on("requestfailed", self.failed)
        page.on("framenavigated", self.committed)
        page.on("domcontentloaded", lambda: self.event("dom_ready"))
        page.on("crash", lambda: self.event("page_crash"))
        page.on("dialog", self.dialog)

    def event(self, name, **fields):
        self.events.append({"event": name, "seconds": round(time.monotonic() - self.metrics.started, 3),
                            "scopeIndex": self.metrics.scope_index, **fields})
        self.events = self.events[-30:]

    def request(self, request):
        if len(self.pending) < 256:
            kind = request.resource_type
            kind = kind if kind in {"document", "script", "stylesheet", "image", "xhr", "fetch", "media"} else "other"
            origin = "lms" if urlsplit(request.url).netloc == "lms.dju.ac.kr" else "external"
            self.pending[request] = (kind + ":" + origin, time.monotonic())
        if request.is_navigation_request() and request.frame == self.page.main_frame:
            self.event("document_request")

    def response(self, response):
        request = response.request
        if request.is_navigation_request() and request.frame == self.page.main_frame:
            self.event("document_response", status=response.status)

    def finished(self, request):
        self.pending.pop(request, None)

    def failed(self, request):
        self.pending.pop(request, None)
        # Network failure strings are only mapped to a closed vocabulary.
        failure = request.failure
        known = {"net::ERR_ABORTED": "aborted", "net::ERR_TIMED_OUT": "timed_out",
                 "net::ERR_CONNECTION_RESET": "connection_reset", "net::ERR_NAME_NOT_RESOLVED": "dns"}
        self.event("request_failed", reason=known.get(failure, "other"))

    def committed(self, frame):
        if frame == self.page.main_frame:
            self.event("document_committed")

    def dialog(self, dialog):
        kind = dialog.type if dialog.type in {"alert", "confirm", "prompt", "beforeunload"} else "other"
        self.event("dialog", kind=kind)
        # Preserve Playwright's default policy while diagnosing navigation.
        dialog.dismiss()

    def snapshot(self):
        pending = {}
        for kind, started in self.pending.values():
            value = pending.setdefault(kind, {"count": 0, "oldestSeconds": 0})
            value["count"] += 1
            value["oldestSeconds"] = max(value["oldestSeconds"], round(time.monotonic() - started, 3))
        return {"events": list(self.events), "pending": pending}


class Metrics:
    def __init__(self):
        self.started = time.monotonic()
        self.active = "setup"
        self.values = {name: {"seconds": 0, "requests": 0, "details": 0, "retries": 0,
                              "results": 0, "failures": 0}
                       for name in ("setup", *CATEGORIES)}
        self.course_entries = 0
        self.diagnostics = []
        self.http_errors = {}
        self.scope_index = 0
        self.page_trace = None
        self.page_replacements = 0

    def response(self, response):
        if urlsplit(response.url).netloc == "lms.dju.ac.kr" and 400 <= response.status <= 599:
            key = str(response.status)
            self.http_errors[key] = self.http_errors.get(key, 0) + 1

    @contextmanager
    def diagnose(self, stage):
        start = time.monotonic()
        before = dict(self.http_errors)
        try:
            yield
        except Exception as error:
            # Never serialize exception messages, source lines, locals or URLs.
            from playwright.sync_api import TimeoutError as BrowserTimeout
            from dju_lms_notifier.lms.notices import TemporaryReadError
            kind = ("timeout" if isinstance(error, BrowserTimeout) else
                    "http_5xx" if isinstance(error, TemporaryReadError) else "other")
            allowed = {"session.py", "collection.py", "activities.py", "boards.py", "popups.py",
                       "notices.py", "assignments.py", "exams.py", "lessons.py", "auth.py", "enrollment.py"}
            frames = [{"file": Path(frame.filename).name, "line": frame.lineno}
                      for frame in traceback.extract_tb(error.__traceback__)
                      if Path(frame.filename).name in allowed]
            self.diagnostics.append({"stage": stage, "category": self.active,
                "scopeIndex": self.scope_index, "kind": kind,
                "seconds": round(time.monotonic() - start, 3), "frames": frames[-8:],
                "navigation": self.page_trace.snapshot() if self.page_trace else None,
                "httpStatuses": {key: value - before.get(key, 0) for key, value in self.http_errors.items()
                                 if value > before.get(key, 0)}})
            self.diagnostics = self.diagnostics[-100:]
            raise

    def request(self, request):
        # Resource bodies, URL strings, account data and course names are not saved.
        if urlsplit(request.url).netloc == "lms.dju.ac.kr" and request.resource_type in ("document", "xhr", "fetch"):
            self.values[self.active]["requests"] += 1

    @contextmanager
    def measure(self, category):
        self.active = category
        start = time.monotonic()
        try:
            yield
        finally:
            self.values[category]["seconds"] += time.monotonic() - start
            self.active = "setup"

    def result(self, category, result):
        entry = self.values[category]
        entry["results"] += 1
        entry["retries"] += max(0, result.attempts - 1)
        entry["failures"] += bool(result.error)

    def snapshot(self):
        return {"version": 1, "totalSeconds": round(time.monotonic() - self.started, 3),
                "diagnostics": self.diagnostics, "httpStatuses": self.http_errors,
                "pageReplacements": self.page_replacements,
                "courseEntries": self.course_entries,
                "categories": {name: {**value, "seconds": round(value["seconds"], 3)}
                               for name, value in self.values.items()}}


class Session:
    def __init__(self, page, metrics, clock=time.monotonic):
        self.page, self.metrics, self.clock = page, metrics, clock
        self.last_request = None
        self.course_id = None
        self.urls = {}
        self.needs_recovery = False
        self.metrics.page_trace = PageTrace(page, metrics)

    def before_request(self):
        # At least one second between navigation starts, including response time.
        # Do not add a full second after a slow response or perform parallel reads.
        now = self.clock()
        if self.last_request is not None:
            remaining = 1 - (now - self.last_request)
            if remaining > 0:
                self.page.wait_for_timeout(remaining * 1000)
        self.last_request = self.clock()

    def detail_attempt(self):
        self.metrics.values[self.metrics.active]["details"] += 1

    def recover(self):
        self.needs_recovery = True
        self.course_id, self.urls = None, {}
        with self.metrics.diagnose("recovery"):
            old = self.page
            context = old.context
            # Discard the broken document, retaining only the current login context.
            # The collector never edits forms; do not run beforeunload on disposal.
            self.page = context.new_page()
            self.metrics.page_replacements += 1
            self.metrics.page_trace = PageTrace(self.page, self.metrics)
            try:
                old.close(run_before_unload=False)
            except BrowserError:
                pass
            self.before_request()
            navigate_main(self.page)
            ensure_authenticated(settle_auth(self.page))
            self.page.locator('div.item[onclick]').first.wait_for(state="attached", timeout=10000)
            self.needs_recovery = False

    def ensure_ready(self):
        if self.needs_recovery:
            self.recover()

    def menu(self, course, category):
        if self.course_id != course.course_id:
            self.course_id, self.urls = None, {}
            self.before_request()
            page = self.page
            handler = f"classRoomMain('{course.course_id}', '{course.course_type}')"
            # Wait for course controls rather than sleeping before inspecting DOM.
            page.locator('div.item[onclick]').first.wait_for(state="attached", timeout=10000)
            targets = [n for n in page.locator('div.item[onclick]').all() if n.get_attribute("onclick") == handler]
            if len(targets) != 1:
                raise NoticeReadError("Course menu unavailable.")
            with page.expect_response(lambda r: matches(r, "/bbs/bbsLect/menuBbsInfoList") and
                                      parse_qs(r.request.post_data or "").get("crsCreCd") == [course.course_id], timeout=30000) as menu:
                targets[0].locator("xpath=../..").click()
                targets[0].click()
            checked(menu.value)
            page.wait_for_function("""course => [...document.querySelectorAll('a[href]')].some(a => {
                const url = new URL(a.href, location.href);
                return url.pathname === '/bbs/bbsLect/Form/atclListForm' && url.searchParams.get('crsCreCd') === course;
            })""", arg=course.course_id, timeout=10000)
            self.urls = menu_urls(page.locator('a[href]').evaluate_all("nodes => nodes.map(n => n.getAttribute('href'))"), course.course_id)
            self.course_id = course.course_id
            self.metrics.course_entries += 1
        if category not in self.urls:
            raise NoticeReadError("Course menu unavailable or ambiguous.")
        return self.urls[category]


@contextmanager
def open_session(path, channel, metrics):
    state = read_state(path)
    with sync_playwright() as playwright:
        browser = launch_browser(playwright, channel, headed=False)
        try:
            context = browser.new_context(storage_state=state, accept_downloads=False)
            context.route("**/*", lambda route: route.abort() if route.request.resource_type == "media" else route.continue_())
            context.on("request", metrics.request)
            context.on("response", metrics.response)
            page = context.new_page()
            session = Session(page, metrics)
            with metrics.measure("setup"), metrics.diagnose("setup"):
                snapshot = discover_enrollment_from_page(page)
            yield session, snapshot.courses
        finally:
            browser.close()
