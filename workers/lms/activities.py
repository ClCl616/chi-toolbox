"""Toolbox activity navigation; parsers and result contracts stay upstream."""
from session import wait_for_link
from dju_lms_notifier.lms import assignments, exams, lessons
from dju_lms_notifier.lms.notices import checked, NoticeReadError
from dju_lms_notifier.parsers.notices import IncompleteNoticeList

def collect_assignments(page, course, list_url, session):
    def read_list():
        session.before_request()
        with page.expect_response(lambda r: assignments.matches_assignment_list(r, course.course_id), timeout=30000) as pending:
            checked(page.goto(list_url, wait_until="domcontentloaded", timeout=30000))
        return assignments.read_list_response(pending.value, course.course_id)

    refs = read_list()
    items = []
    for index, ref in enumerate(refs):
        if index and read_list() != refs:
            raise IncompleteNoticeList("Assignment list changed during collection.")
        wait_for_link(page, ref.href)
        links = [n for n in page.locator('a[href*="asmntView("]').all() if n.get_attribute("href") == ref.href]
        if len(links) != 1:
            raise NoticeReadError("Assignment detail link unavailable.")
        session.before_request()
        session.detail_attempt()
        with page.expect_navigation(wait_until="domcontentloaded", timeout=30000) as pending:
            links[0].click()
        checked(pending.value)
        page.locator('h2.page-title').wait_for(state="attached", timeout=10000)
        items.append(assignments.parse_assignment_detail(page.content(), course.course_id, ref, page.url))
    return tuple(items)

def collect_exams(page, course, list_url, session):
    def read_list():
        session.before_request()
        with page.expect_response(lambda r: exams.matches_exam_list(r, course.course_id), timeout=30000) as pending:
            checked(page.goto(list_url, wait_until="domcontentloaded", timeout=30000))
        return exams.read_list_response(pending.value, course.course_id)

    refs = read_list()
    # The observed OFF-filter response includes an online quiz as well.
    # Trust item labels, not an inferred meaning of the request filter.
    if any(ref.delivery_mode not in {"offline", "online"} for ref in refs):
        raise NoticeReadError("Exam delivery mode is outside the verified scope.")
    items = []
    for index, ref in enumerate(refs):
        if index and read_list() != refs:
            raise IncompleteNoticeList("Exam list changed during collection.")
        wait_for_link(page, ref.href)
        links = [n for n in page.locator('a[href*="examView("]').all() if n.get_attribute("href") == ref.href]
        if len(links) != 1:
            raise NoticeReadError("Exam detail link unavailable.")
        session.before_request()
        session.detail_attempt()
        with page.expect_navigation(wait_until="domcontentloaded", timeout=30000) as pending:
            links[0].click()
        checked(pending.value)
        page.locator('h2.page-title').wait_for(state="attached", timeout=10000)
        items.append(exams.parse_exam_detail(page.content(), course.course_id, ref, page.url))
    return tuple(items)

def collect_lessons(page, course, list_url, session):
    def read_list():
        session.before_request()
        with page.expect_response(lambda r: lessons.matches_lesson_list(r, course.course_id), timeout=30000) as pending:
            checked(page.goto(list_url, wait_until="domcontentloaded", timeout=30000))
        return lessons.read_list_response(pending.value, course.course_id)

    # All supported metadata is in the list response. Never click content,
    # OTP, player, attendance, or progress controls.
    return read_list()
