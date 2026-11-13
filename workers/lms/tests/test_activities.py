"""Browser smoke with real upstream parsers and synthetic routed responses."""
import json
import os
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from urllib.parse import urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(os.environ.get("DJU_NOTIFIER_ROOT", "../DJU-LMS-Notifier")).resolve() / "src"))
from playwright.sync_api import sync_playwright, Error as BrowserError
from unittest.mock import patch
from dju_lms_notifier.lms.auth import AuthStatus
from activities import collect_assignments, collect_exams, collect_lessons
from dju_lms_notifier.lms import assignments, exams, lessons
from session import Session, Metrics, PageTrace

FIXTURES = Path(__file__).parent / 'fixtures'
BASE = 'https://lms.dju.ac.kr'
COURSE = SimpleNamespace(course_id='COURSE_SYNTH')


class ActivityBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(channel='msedge', headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def verify(self, category, module, collector, body, cards, detail_path=None, function=None):
        context = self.browser.new_context()
        self.addCleanup(context.close)
        page = context.new_page()
        listing = (FIXTURES / cards).read_text(encoding='utf-8')
        detail = (FIXTURES / (category[:-1] + '_detail.html')).read_text(encoding='utf-8') if detail_path else ''
        detail_url = BASE + detail_path if detail_path else None
        visited = []
        def respond(route):
            path = urlsplit(route.request.url).path
            visited.append((route.request.method, path))
            if path == module.MENU_PATH:
                script = (f'window.{function}=()=>location.href={json.dumps(detail_url)};' if function else '')
                script += f'''fetch({json.dumps(module.LIST_PATH)}, {{method:'POST',headers:{{'Content-Type':'application/x-www-form-urlencoded'}},body:{json.dumps(body)}}})
                    .then(r=>r.text()).then(html=>setTimeout(()=>document.getElementById('items').innerHTML=html,150));'''
                route.fulfill(content_type='text/html; charset=utf-8', body='<div id="items"></div><script>'+script+'</script>')
            elif path == module.LIST_PATH:
                route.fulfill(content_type='text/html; charset=utf-8', body=listing)
            elif detail_path and path == urlsplit(detail_url).path:
                route.fulfill(content_type='text/html; charset=utf-8', body=detail)
            else:
                self.fail('Unexpected synthetic browser request')
        context.route('**/*', respond)
        metrics = Metrics()
        context.on('request', metrics.request)
        session = Session(page, metrics)
        with metrics.measure(category):
            actual = collector(page, COURSE, BASE + module.MENU_PATH, session)
        if category == 'assignments':
            ref, = assignments.parse_assignment_list(listing, COURSE.course_id, 10)
            expected = (assignments.parse_assignment_detail(detail, COURSE.course_id, ref, detail_url),)
        elif category == 'exams':
            ref, = exams.parse_exam_list(listing, COURSE.course_id, 1000)
            expected = (exams.parse_exam_detail(detail, COURSE.course_id, ref, detail_url),)
        else:
            expected = lessons.parse_lesson_list(listing, COURSE.course_id)
        self.assertEqual(actual, expected)
        self.assertEqual(metrics.values[category]['details'], 1 if detail_path else 0)
        self.assertEqual(len(visited), 3 if detail_path else 2)

    def test_assignment_result_and_single_detail_with_delayed_dom(self):
        self.verify('assignments', assignments, collect_assignments,
            'crsCreCd=COURSE_SYNTH&pageIndex=1&listScale=10', 'assignment_cards.html',
            '/asmnt/asmntLect/Form/asmntStuMain?asmntCd=ASMNT_SYNTH_1&crsCreCd=COURSE_SYNTH', 'asmntView')

    def test_exam_result_and_single_detail_with_delayed_dom(self):
        self.verify('exams', exams, collect_exams,
            'crsCreCd=COURSE_SYNTH&pageIndex=1&listScale=1000&examTypeCd=OFF&examSubmitYn=Y&useYn=Y&searchValue=',
            'exam_cards.html', '/exam/examLect/Form/viewStuExamMain?examCd=EXAM_SYNTH_1&crsCreCd=COURSE_SYNTH&tabCd=0', 'examView')

    def test_lesson_results_without_content_requests(self):
        self.verify('lessons', lessons, collect_lessons,
            'crsCreCd=COURSE_SYNTH&pageIndex=1&subParam=GRID&progressTypeCd=WEEK&lessonScheduleId=&searchValue=',
            'lesson_list.html')

    def test_beforeunload_diagnostic_without_dialog_text(self):
        context = self.browser.new_context()
        self.addCleanup(context.close)
        context.route('**/*', lambda route: route.fulfill(content_type='text/html', body='<button>activate</button>'))
        page = context.new_page()
        metrics = Metrics()
        trace = PageTrace(page, metrics)
        page.goto(BASE + '/synthetic')
        page.locator('button').click()
        page.evaluate("window.addEventListener('beforeunload', e => { e.preventDefault(); e.returnValue='PRIVATE_TEXT'; })")
        with self.assertRaises(BrowserError):
            page.goto(BASE + '/next', timeout=1000)
        data = trace.snapshot()
        self.assertTrue(any(e['event'] == 'dialog' and e['kind'] == 'beforeunload' for e in data['events']))
        self.assertNotIn('PRIVATE_TEXT', json.dumps(data))
        self.assertNotIn(BASE, json.dumps(data))

    def test_recovery_discards_blocked_document_and_preserves_context(self):
        context = self.browser.new_context()
        self.addCleanup(context.close)
        context.route('**/*', lambda route: route.fulfill(content_type='text/html', body='<button>activate</button><div class="item" onclick=""></div>'))
        page = context.new_page()
        page.goto(BASE + '/synthetic')
        page.locator('button').click()
        page.evaluate("window.addEventListener('beforeunload', e => { e.preventDefault(); e.returnValue=''; })")
        context.add_cookies([{'name': 'synthetic', 'value': 'preserved', 'url': BASE}])
        session = Session(page, Metrics())
        with patch('session.navigate_main', side_effect=lambda fresh: fresh.goto(BASE + '/main')), \
                patch('session.settle_auth', return_value=AuthStatus.AUTHENTICATED):
            session.recover()
        self.assertTrue(page.is_closed())
        self.assertEqual(session.page.context, context)
        self.assertEqual(context.cookies()[0]['value'], 'preserved')
        self.assertFalse(session.needs_recovery)

    def test_trace_distinguishes_response_from_dom_blocked_by_script(self):
        context = self.browser.new_context()
        self.addCleanup(context.close)
        held = []
        self.addCleanup(lambda: [route.abort() for route in held])
        def respond(route):
            if route.request.resource_type == 'document':
                route.fulfill(content_type='text/html', body='<script src="/PRIVATE_SCRIPT.js"></script>')
            else:
                held.append(route)
            # Deliberately hold the synthetic script request without any network I/O.
        context.route('**/*', respond)
        page = context.new_page()
        trace = PageTrace(page, Metrics())
        with self.assertRaises(BrowserError):
            page.goto(BASE + '/synthetic', wait_until='domcontentloaded', timeout=1000)
        data = trace.snapshot()
        self.assertTrue(any(e['event'] == 'document_response' and e['status'] == 200 for e in data['events']))
        self.assertTrue(any(e['event'] == 'document_committed' for e in data['events']))
        self.assertFalse(any(e['event'] == 'dom_ready' for e in data['events']))
        self.assertEqual(data['pending']['script:lms']['count'], 1)
        self.assertNotIn('PRIVATE_SCRIPT', json.dumps(data))
