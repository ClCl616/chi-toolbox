"""Offline scheduling, request budgets, metrics and failure isolation."""
from contextlib import contextmanager
import json
import os
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from tempfile import TemporaryDirectory
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(os.environ.get("DJU_NOTIFIER_ROOT", "../DJU-LMS-Notifier")).resolve() / "src"))
import collection
from session import CATEGORIES, Metrics, Session, menu_urls, open_session
from dju_lms_notifier.lms.auth import AuthenticationError, AuthStatus
from dju_lms_notifier.lms.notices import TemporaryReadError, NoticeReadError


def links(course):
    from session import PATHS
    return [f"https://lms.dju.ac.kr{path}?crsCreCd={course}&mcd=x" +
            (f"&bbsId=BBS_{course}_{'N' if name == 'notices' else 'P'}" if name in ("notices", "materials") else "")
            for name, path in PATHS.items()]


class SessionTests(unittest.TestCase):
    def test_pacing_counts_response_time_and_keeps_one_second_spacing(self):
        now = [10.0]
        page = MagicMock()
        page.wait_for_timeout.side_effect = lambda ms: now.__setitem__(0, now[0] + ms / 1000)
        session = Session(page, Metrics(), clock=lambda: now[0])
        session.before_request()
        page.wait_for_timeout.assert_not_called()
        now[0] += .7
        session.before_request()
        self.assertAlmostEqual(page.wait_for_timeout.call_args.args[0], 300)
        now[0] += 2
        session.before_request()
        self.assertEqual(page.wait_for_timeout.call_count, 1)

    def test_menu_rejects_foreign_course_host_and_ambiguous_links(self):
        valid = links("A")
        self.assertEqual(set(menu_urls(valid + links("B"), "A")), set(CATEGORIES))
        self.assertEqual(menu_urls([url.replace('lms.dju.ac.kr', 'example.com') for url in valid], 'A'), {})
        self.assertNotIn('assignments', menu_urls(valid + [valid[2] + '&duplicate=1'], 'A'))
        self.assertEqual(menu_urls([valid[0].replace('bbsId=BBS_A_N', 'bbsId=BBS_B_N')], 'A'), {})

    def test_menu_shared_within_course_and_invalidated_after_recovery(self):
        page = MagicMock()
        tile = MagicMock()
        tile.get_attribute.return_value = "classRoomMain('A', 'UNI')"
        page.locator.return_value.all.return_value = [tile]
        page.locator.return_value.evaluate_all.return_value = links('A')
        page.expect_response.return_value.__enter__.return_value.value.status = 200
        session = Session(page, Metrics())
        course = SimpleNamespace(course_id='A', course_type='UNI')
        with patch.object(session, 'before_request'), patch('session.navigate_main') as navigate:
            for category in CATEGORIES:
                self.assertEqual(session.menu(course, category), links('A')[CATEGORIES.index(category)])
            self.assertEqual(tile.click.call_count, 1)
            session.recover()
            session.menu(course, 'exams')
            self.assertEqual(tile.click.call_count, 2)
            navigate.assert_called_once_with(page)

    def test_browser_and_enrollment_created_once_and_closed_on_failure(self):
        metrics = Metrics()
        browser = MagicMock()
        with patch('session.read_state', return_value={}), patch('session.sync_playwright'), \
                patch('session.launch_browser', return_value=browser) as launch, \
                patch('session.discover_enrollment_from_page', return_value=SimpleNamespace(courses=())) as discover:
            with self.assertRaises(ValueError):
                with open_session('unused', 'msedge', metrics):
                    raise ValueError('synthetic')
            launch.assert_called_once()
            discover.assert_called_once()
            browser.close.assert_called_once()

    def test_metrics_have_counts_without_urls_or_private_identifiers(self):
        metrics = Metrics()
        with metrics.measure('assignments'):
            metrics.request(SimpleNamespace(url='https://lms.dju.ac.kr/private?token=SECRET', resource_type='document'))
            metrics.request(SimpleNamespace(url='https://example.com/private', resource_type='xhr'))
        metrics.result('assignments', collection.RESULTS['assignments']('PRIVATE_COURSE', (), attempts=2))
        payload = metrics.snapshot()
        self.assertEqual(payload['categories']['assignments']['requests'], 1)
        self.assertEqual(payload['categories']['assignments']['retries'], 1)
        self.assertNotIn('SECRET', json.dumps(payload))
        self.assertNotIn('PRIVATE_COURSE', json.dumps(payload))


class CollectionTests(unittest.TestCase):
    def run_cycle(self, collect, count=2, auth=AuthStatus.AUTHENTICATED):
        metrics = Metrics()
        session = MagicMock()
        courses = [SimpleNamespace(course_id=str(i), name='Synthetic') for i in range(count)]
        @contextmanager
        def opened(*args):
            yield session, courses
        with patch('collection.open_session', side_effect=opened) as opened_mock, \
                patch('collection.collect_scope', side_effect=collect), \
                patch('collection.probe_auth', return_value=auth):
            results = list(collection.collect_cycle('unused', 'msedge', object(), metrics))
        opened_mock.assert_called_once()
        return results, metrics, session

    def test_course_first_all_scopes_once(self):
        seen = []
        def collect(session, course, category, policy):
            seen.append((course.course_id, category))
            return ()
        results, metrics, _ = self.run_cycle(collect, count=9)
        self.assertEqual(seen, [(str(i), cat) for i in range(9) for cat in CATEGORIES])
        self.assertEqual(len(results), 45)
        for cat, rows in results:
            self.assertIsInstance(rows[0], collection.RESULTS[cat])
            self.assertEqual(rows[0].items, ())
        self.assertEqual(sum(v['results'] for v in metrics.values.values()), 45)

    def test_temporary_failure_retries_only_failed_scope(self):
        seen = []
        def collect(session, course, category, policy):
            seen.append((course.course_id, category))
            if category == 'exams' and seen.count((course.course_id, category)) == 1:
                raise TemporaryReadError('synthetic')
            return ()
        results, metrics, session = self.run_cycle(collect, count=1)
        self.assertEqual([cat for _, cat in seen], ['notices', 'materials', 'assignments', 'exams', 'exams', 'lessons'])
        self.assertTrue(all(not rows[0].error for _, rows in results))
        session.recover.assert_called_once()
        session.page.wait_for_timeout.assert_called_once_with(2000)
        self.assertEqual(metrics.values['exams']['retries'], 1)

    def test_non_retryable_failure_preserves_other_scopes(self):
        def collect(session, course, category, policy):
            if category == 'materials':
                raise NoticeReadError('synthetic')
            return ()
        results, _, session = self.run_cycle(collect)
        self.assertEqual(len(results), 10)
        self.assertEqual(sum(bool(rows[0].error) for _, rows in results), 2)
        session.recover.assert_not_called()

    def test_expired_auth_stops_remaining_categories_and_courses(self):
        results, _, _ = self.run_cycle(lambda *_: (_ for _ in ()).throw(AuthenticationError(AuthStatus.LOGIN_REQUIRED)))
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0][1][0].error, 'auth_login_required')


class WorkerTests(unittest.TestCase):
    def test_incremental_commit_and_private_metrics_without_extra_observation(self):
        from worker import cycle
        from dju_lms_notifier.parsers.notices import Notice
        from dju_lms_notifier.storage.database import Database
        from dju_lms_notifier.lms.notices import CourseNoticeResult
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            data, public = root / 'private', root / 'public'
            data.mkdir()
            item = Notice('BBS_SYNTH_N', 'one', 'Synthetic', 'body', 'body')
            def baseline(path, browser, policy, metrics):
                # Match the board collector's in-memory successful-detail cache.
                policy.fresh['BBS_SYNTH_N:one'] = ('fingerprint', item)
                yield 'notices', [CourseNoticeResult('SYNTH', (item,))]
            with patch('collection.collect_cycle', side_effect=baseline):
                cycle(data, 'msedge', 540, public)
            checks = json.loads((data / 'board-checks.json').read_text(encoding='utf-8'))
            self.assertEqual(checks['details']['BBS_SYNTH_N:one']['signature'], 'fingerprint')
            self.assertTrue((data / 'metrics.json').exists())
            self.assertFalse((public / 'metrics.json').exists())
            self.assertFalse((public / 'diagnostics-history.json').exists())
            history = json.loads((data / 'diagnostics-history.json').read_text(encoding='utf-8'))
            self.assertEqual(len(history), 1)
            self.assertNotIn('SYNTH', json.dumps(history))
            (data / 'diagnostics-history.json').write_text(json.dumps(history * 100), encoding='utf-8')
            with patch('collection.collect_cycle', return_value=(row for row in [('notices', [CourseNoticeResult('SYNTH', ())])])):
                cycle(data, 'msedge', 540, public)
            with Database(data / 'notifier.sqlite3') as database:
                self.assertEqual(database._connection.execute('SELECT count(*) FROM snapshots').fetchone()[0], 1)
            snapshot = json.loads((public / 'snapshot.json').read_text(encoding='utf-8'))
            self.assertEqual(snapshot['status'], 'healthy')
            self.assertNotIn('metrics', snapshot)
            history = json.loads((data / 'diagnostics-history.json').read_text(encoding='utf-8'))
            self.assertEqual(len(history), 100)
            self.assertEqual(history[-1]['finishedAt'], snapshot['lastAttempt'])

    def test_partial_failure_publishes_committed_result_and_closes_generator(self):
        from worker import cycle
        closed = []
        def stream(*args):
            try:
                yield 'notices', [collection.RESULTS['notices']('SYNTH', ())]
                raise RuntimeError('private details must not be logged')
            finally:
                closed.append(True)
        with TemporaryDirectory() as temporary:
            data = Path(temporary)
            with patch('collection.collect_cycle', side_effect=stream):
                cycle(data, 'msedge', 540)
            snapshot = json.loads((data / 'snapshot.json').read_text(encoding='utf-8'))
            self.assertEqual(snapshot['status'], 'partial')
            self.assertEqual(closed, [True])
            self.assertNotIn('private details', (data / 'worker-state.json').read_text(encoding='utf-8'))


if __name__ == '__main__':
    unittest.main()
