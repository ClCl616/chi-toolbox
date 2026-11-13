"""Failure diagnostics must never retain request or exception contents."""
import json
import os
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(os.environ.get("DJU_NOTIFIER_ROOT", "../DJU-LMS-Notifier")).resolve() / "src"))
from playwright.sync_api import TimeoutError as BrowserTimeout
from dju_lms_notifier.lms.notices import TemporaryReadError
from session import Metrics


class DiagnosticsTests(unittest.TestCase):
    def test_private_exception_and_url_are_not_retained(self):
        metrics = Metrics()
        secret = "PRIVATE_COOKIE_AND_COURSE_TITLE"
        error = BrowserTimeout(secret)
        with self.assertRaises(BrowserTimeout) as raised:
            with metrics.diagnose("collect"):
                metrics.response(SimpleNamespace(url="https://lms.dju.ac.kr/" + secret, status=503))
                raise error
        self.assertIs(raised.exception, error)
        encoded = json.dumps(metrics.snapshot())
        self.assertNotIn(secret, encoded)
        self.assertNotIn("https", encoded)
        self.assertEqual(metrics.diagnostics[0]["kind"], "timeout")
        self.assertEqual(metrics.diagnostics[0]["httpStatuses"], {"503": 1})

    def test_http_failures_and_recovery_are_distinct_and_bounded(self):
        metrics = Metrics()
        for _ in range(105):
            with self.assertRaises(TemporaryReadError):
                with metrics.diagnose("recovery"):
                    raise TemporaryReadError("private")
        self.assertEqual(len(metrics.diagnostics), 100)
        self.assertEqual(metrics.diagnostics[0]["kind"], "http_5xx")
        self.assertEqual(metrics.diagnostics[0]["stage"], "recovery")

    def test_success_and_non_lms_responses_do_not_report_failures(self):
        metrics = Metrics()
        with metrics.diagnose("collect"):
            metrics.response(SimpleNamespace(url="https://other.example/private", status=500))
            metrics.response(SimpleNamespace(url="https://lms.dju.ac.kr/private", status=200))
        self.assertEqual(metrics.diagnostics, [])
        self.assertEqual(metrics.http_errors, {})
