"""Course-first orchestration with the upstream per-scope retry/error contract."""
from activities import collect_assignments, collect_exams, collect_lessons
from boards import collect_course
from session import CATEGORIES, open_session
from dju_lms_notifier.lms.auth import probe_auth
from dju_lms_notifier.lms.notices import collect_isolated, CourseNoticeResult
from dju_lms_notifier.lms.materials import CourseMaterialResult
from dju_lms_notifier.lms.assignments import CourseAssignmentResult
from dju_lms_notifier.lms.exams import CourseExamResult
from dju_lms_notifier.lms.lessons import CourseLessonResult
from dju_lms_notifier.parsers.notices import parse_notice_detail
from dju_lms_notifier.parsers.materials import parse_material_detail

RESULTS = dict(zip(CATEGORIES, (CourseNoticeResult, CourseMaterialResult,
                               CourseAssignmentResult, CourseExamResult, CourseLessonResult)))
ACTIVITIES = {"assignments": collect_assignments, "exams": collect_exams, "lessons": collect_lessons}


def collect_scope(session, course, category, policy):
    with session.metrics.diagnose("collect"):
        return collect_scope_impl(session, course, category, policy)


def collect_scope_impl(session, course, category, policy):
    url = session.menu(course, category)
    if category in ("notices", "materials"):
        kind, parser = ("N", parse_notice_detail) if category == "notices" else ("P", parse_material_detail)
        return collect_course(session.page, course, kind, parser, policy, list_url=url, session=session)
    return ACTIVITIES[category](session.page, course, url, session)


def collect_cycle(path, channel, policy, metrics):
    with open_session(path, channel, metrics) as (session, courses):
        for course in courses:
            for category in CATEGORIES:
                metrics.scope_index += 1
                with metrics.measure(category):
                    result, = collect_isolated((course,),
                        lambda current: collect_scope(session, current, category, policy),
                        session.page.wait_for_timeout, session.recover,
                        check_auth=lambda: probe_auth(session.page), result_type=RESULTS[category])
                metrics.result(category, result)
                yield category, [result]
                if result.error in ("auth_login_required", "auth_unknown"):
                    return
