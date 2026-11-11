"""Offline board request budgets and real v5 change detection, temporary DB only."""
from datetime import datetime, timedelta, timezone
from pathlib import Path
import os
import sys
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(os.environ.get("DJU_NOTIFIER_ROOT", "../DJU-LMS-Notifier")).resolve() / "src"))
from boards import BoardPolicy, Titles, collect_course
from dju_lms_notifier.storage.database import Database
from dju_lms_notifier.lms.notices import CourseNoticeResult
from dju_lms_notifier.parsers.notices import Notice, NoticeRef, BoardPage

NOW = datetime(2026, 11, 11, tzinfo=timezone.utc)
REF = NoticeRef("BBS_SYNTH_N", "article", "1", "javascript:viewAtcl('BBS_SYNTH_N','article','1')")
ITEM = Notice(REF.board_id, REF.article_id, "Title", "body", "body")


class BoardTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.db = Database(Path(self.temp.name) / "test.sqlite3")
        self.addCleanup(self.db.close)
        self.state = {}

    def result(self, items):
        return CourseNoticeResult("SYNTH", tuple(items))

    def policy(self, now=NOW):
        return BoardPolicy(self.state, self.db._connection, now)

    def seed(self):
        policy = self.policy()
        policy.remember(REF, "title", ITEM)
        result = self.result([ITEM])
        self.db.process_results([result])
        policy.committed([result])

    def test_new_unchanged_title_change_and_daily_body_review(self):
        self.assertTrue(self.policy().due(REF, "title"))
        self.seed()
        self.assertFalse(self.policy(NOW + timedelta(minutes=30)).due(REF, "title"))
        self.assertTrue(self.policy().due(REF, "changed"))
        self.assertTrue(self.policy(NOW + timedelta(days=1)).due(REF, "title"))
        self.assertTrue(self.policy(NOW - timedelta(seconds=1)).due(REF, "title"))

    def test_failed_course_does_not_advance_check_time_and_retry_reuses_detail(self):
        policy = self.policy()
        policy.remember(REF, "title", ITEM)
        policy.committed([CourseNoticeResult("SYNTH", None, "temporary_failure")])
        self.assertEqual(self.state, {})
        self.assertEqual(policy.reuse(REF, "title"), ITEM)
        self.assertIsNone(policy.reuse(REF, "different"))

    def test_missing_database_baseline_forces_read_even_with_clock(self):
        self.state["BBS_SYNTH_N:article"] = {"signature": "title", "detailCheckedAt": NOW.isoformat()}
        self.assertTrue(self.policy().due(REF, "title"))

    def test_skipped_body_is_not_saved_as_a_new_observation(self):
        self.seed()
        self.db.process_results([self.result([])])
        self.assertEqual(self.db._connection.execute("SELECT count(*) FROM snapshots").fetchone()[0], 1)
        self.assertEqual(self.db._connection.execute("SELECT count(*) FROM accepted_items").fetchone()[0], 1)
        self.assertEqual(self.db._connection.execute("SELECT count(*) FROM changes").fetchone()[0], 0)
        modified = Notice(REF.board_id, REF.article_id, "Title", "edited", "edited")
        self.db.process_results([self.result([modified])])
        self.assertEqual(self.db._connection.execute("SELECT kind FROM changes").fetchone()[0], "modified")

    def test_new_post_emits_event_without_reobserving_old_post(self):
        self.seed()
        new = Notice(REF.board_id, "new", "New title", "new body", "new body")
        self.db.process_results([self.result([new])])
        self.assertEqual([r[0] for r in self.db._connection.execute("SELECT kind FROM changes")], ["new"])
        self.assertEqual(self.db._connection.execute("SELECT count(*) FROM accepted_items").fetchone()[0], 2)

    def test_material_attachment_and_link_edits_still_emit_changes(self):
        from dju_lms_notifier.parsers.materials import Material, Attachment
        from dju_lms_notifier.lms.materials import CourseMaterialResult
        for index, (file, link) in enumerate((("one.pdf", "a"), ("two.pdf", "b"))):
            item = Material("BBS_SYNTH_P", "material", "Material", "body", f'<a href="https://example.com/{link}">body</a>', (Attachment("opaque", file),))
            self.db.process_results([CourseMaterialResult("SYNTH", (item,))])
            if index == 0:
                self.db.process_results([CourseMaterialResult("SYNTH", ())])
        self.assertEqual([r[0] for r in self.db._connection.execute("SELECT kind FROM changes")], ["modified"])

    def test_view_count_and_link_page_do_not_change_signature(self):
        signatures = []
        for count, page in ((10, 1), (11, 2)):
            parser = Titles()
            parser.feed(f"<a href=\"javascript:viewAtcl('B','A','{page}')\"><span>Same title</span></a><li>{count}</li>")
            signatures.append(parser.signatures)
        self.assertEqual(*signatures)

    def test_empty_title_is_rejected(self):
        from boards import NoticeReadError
        with self.assertRaises(NoticeReadError):
            Titles().feed("<a href=\"javascript:viewAtcl('B','A','1')\"></a>")

    def page(self):
        page = MagicMock()
        course = SimpleNamespace(course_id="SYNTH", course_type="UNI")
        tile = MagicMock()
        tile.get_attribute.return_value = "classRoomMain('SYNTH', 'UNI')"
        menu = MagicMock()
        menu.get_attribute.return_value = "https://lms.dju.ac.kr/bbs/bbsLect/Form/atclListForm?bbsId=BBS_SYNTH_N&crsCreCd=SYNTH&mcd=x"
        article = MagicMock()
        article.get_attribute.return_value = REF.href
        def locator(selector):
            obj = MagicMock()
            obj.count.return_value = 1
            obj.all.return_value = ([tile] if selector == 'div.item[onclick]' else
                                   [menu] if "atclListForm" in selector else [article])
            return obj
        page.locator.side_effect = locator
        page.expect_response.return_value.__enter__.return_value.value.status = 200
        page.expect_navigation.return_value.__enter__.return_value.value.status = 200
        page.goto.return_value.status = 200
        page.url = "https://lms.dju.ac.kr/list"
        return page, course, article

    def collect(self, policy):
        page, course, article = self.page()
        listing = BoardPage(1, (REF,), ())
        with patch("boards.parse_board_page", return_value=listing), patch("boards.read_listing", return_value=((REF,), {REF.article_id: "title"})):
            result = collect_course(page, course, "N", lambda *_: ITEM, policy)
        return result, article.click.call_count

    def test_unchanged_course_opens_no_detail(self):
        self.seed()
        items, visits = self.collect(self.policy(NOW + timedelta(minutes=30)))
        self.assertEqual((items, visits), ((), 0))

    def test_daily_review_reads_once_and_retry_does_not_reopen(self):
        self.seed()
        policy = self.policy(NOW + timedelta(days=1))
        self.assertEqual(self.collect(policy), ((ITEM,), 1))
        self.assertEqual(self.collect(policy), ((ITEM,), 0))


if __name__ == "__main__":
    unittest.main()
