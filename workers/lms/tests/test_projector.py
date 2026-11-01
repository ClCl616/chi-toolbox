"""Synthetic fixtures only. Upstream code is read, never its runtime database."""
from dataclasses import replace
from datetime import datetime
import os
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(os.environ.get('DJU_NOTIFIER_ROOT', '../DJU-LMS-Notifier')).resolve() / 'src'))
from projector import project, date_value, public_snapshot
from dju_lms_notifier.storage.database import Database
from dju_lms_notifier.lms.notices import CourseNoticeResult
from dju_lms_notifier.parsers.notices import Notice
from dju_lms_notifier.lms.assignments import CourseAssignmentResult
from dju_lms_notifier.parsers.assignments import Assignment, AssignmentRef

NOW = '2026-11-02T00:00:00+00:00'

class ProjectionTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.db = Database(Path(self.temp.name) / 'test.sqlite3')
        self.addCleanup(self.db.close)

    def project(self, prior=None, results=(), issues=(), offset=None):
        return project(self.db._connection, prior, results, issues, NOW, offset)

    def test_baseline_silent_later_new_and_changed_news_once(self):
        old = Notice('BBS_SYNTH_N', 'a', 'old', 'body', '<p>body</p>')
        initial = CourseNoticeResult('SYNTH', (old,), course_name='Synthetic')
        self.db.process_results([initial])
        state = self.project(results=[initial])
        self.assertEqual(state['events'], [])
        changed = replace(initial, items=(replace(old, title='changed'), replace(old, article_id='b', title='new')))
        self.db.process_results([changed])
        state = self.project(state, [changed])
        self.assertEqual([e['title'] for e in state['events']], ['changed', 'new'])
        self.assertEqual(self.project(state, [changed])['events'], state['events'])
        self.assertFalse(state['assignmentsReady'])

    def test_fault_dedup_reason_change_and_recovery_once(self):
        state = self.project(issues=['auth_login_required'])
        self.assertEqual(state['status'], 'login_required')
        state = self.project(state, issues=['auth_login_required'])
        self.assertEqual(len(state['events']), 1)
        state = self.project(state, issues=['notices:operation_failed'])
        self.assertEqual(len(state['events']), 2)
        state = self.project(state)
        self.assertIn('복구', state['events'][-1]['title'])
        self.assertEqual(len(self.project(state)['events']), 3)
        self.assertFalse(any(key.startswith('_') for key in public_snapshot(state)))

    def test_assignments_retained_on_missing_and_failure_unknown_timezone(self):
        ref = AssignmentRef('A', 'https://invalid.test', 'assignment', datetime(2026,11,1), datetime(2026,11,3), 'progress', False, 'not submitted', False, 'no')
        result = CourseAssignmentResult('SYNTH', (Assignment(ref, 'body', '<p>body</p>', ''),), course_name='Synthetic')
        self.db.process_results([result])
        state = self.project(results=[result])
        self.assertTrue(state['assignmentsReady'])
        self.assertIsNone(state['assignments'][0]['deadline'])
        state = self.project(state, [result], offset=540)
        self.assertEqual(state['assignments'][0]['deadline'], '2026-11-03T00:00:00+09:00')
        empty = replace(result, items=())
        self.db.process_results([empty])
        state = self.project(state, [empty])
        self.assertEqual(len(state['assignments']), 1)
        self.assertTrue(state['assignments'][0]['stale'])
        failed = self.project(state, issues=['auth_login_required'])
        self.assertEqual(failed['assignments'], state['assignments'])
        self.assertEqual(failed['lastSuccess'], state['lastSuccess'])

    def test_dates_not_guessed(self):
        self.assertIsNone(date_value('비허용', 540))
        self.assertIsNone(date_value('2026-11-02T12:00:00'))
        self.assertEqual(date_value('2026-11-02T12:00:00', 540), '2026-11-02T12:00:00+09:00')

if __name__ == '__main__':
    unittest.main()
