"""Real browser tests with intercepted synthetic pages; no LMS/network data."""
from pathlib import Path
import os
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(os.environ.get("DJU_NOTIFIER_ROOT", "../DJU-LMS-Notifier")).resolve() / "src"))
from playwright.sync_api import sync_playwright
from dju_lms_notifier.lms import auth
from popups import PopupBlocked, dismiss_popups, install


def window(number):
    return f'''<div class="layerPopup" id="window{number}"
      style="position:fixed;inset:0;background:white;z-index:{number}">
      <div class="header"><b id="closeButton{number}"
        onclick="this.closest('.layerPopup').style.display='none'">Close</b></div>
      <div class="body"><a href="/forbidden">Notice content</a></div>
      <input type="checkbox" onchange="window.persisted=true">
    </div>'''


def document(count=2, logged_in=False):
    evidence = '<a href="/user/userHome/logout">Logout</a>' if logged_in else '<input id="inputId"><input id="inputPwd">'
    return evidence + '<button id="termArea" onclick="window.termOpened=true">Term</button><div id="mainPopup">' + ''.join(window(i) for i in range(1, count + 1)) + '</div>'


class PopupTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original_navigate, cls.original_inspect = auth.navigate_main, auth.inspect_auth
        install()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(channel="msedge", headless=True)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        auth.navigate_main, auth.inspect_auth = cls.original_navigate, cls.original_inspect

    def setUp(self):
        self.context = self.browser.new_context()
        self.addCleanup(self.context.close)
        self.page = self.context.new_page()
        self.requests = []
        self.html = document()
        def serve(route):
            self.requests.append(route.request.url)
            route.fulfill(status=200, content_type="text/html", body=self.html)
        self.context.route("**/*", serve)

    def assert_clear(self):
        self.assertEqual(self.page.locator("#mainPopup .layerPopup:visible").count(), 0)
        self.assertFalse(self.page.evaluate("!!window.persisted"))
        self.assertFalse(any("forbidden" in url for url in self.requests))

    def test_login_before_after_and_reentry(self):
        auth.navigate_main(self.page)
        self.assertEqual(auth.inspect_auth(self.page), auth.AuthStatus.LOGIN_REQUIRED)
        self.assert_clear()
        self.html = document(3, logged_in=True)
        self.page.goto("https://lms.dju.ac.kr/home/mainHome/Form/myPage")
        self.assertEqual(auth.inspect_auth(self.page), auth.AuthStatus.AUTHENTICATED)
        self.assert_clear()
        auth.navigate_main(self.page)
        self.assert_clear()
        self.page.locator("#termArea").click(timeout=3000)
        self.assertTrue(self.page.evaluate("window.termOpened"))

    def test_late_popup_does_not_block_term_click(self):
        self.html = document(0)
        auth.navigate_main(self.page)
        self.page.locator("#mainPopup").evaluate("(el, html) => el.innerHTML = html", window(8) + window(9))
        self.page.locator("#termArea").click(timeout=3000)
        self.assert_clear()
        self.assertTrue(self.page.evaluate("window.termOpened"))

    def test_no_popup_and_hidden_popup_are_noops(self):
        self.page.set_content(document(0))
        dismiss_popups(self.page)
        self.page.set_content(document(1))
        dismiss_popups(self.page)
        dismiss_popups(self.page)
        self.assert_clear()

    def test_unknown_close_control_fails_without_hiding_notice(self):
        self.page.set_content(document(1).replace('id="closeButton1"', 'id="unknown"'))
        with self.assertRaises(PopupBlocked):
            dismiss_popups(self.page)
        self.assertEqual(self.page.locator(".layerPopup:visible").count(), 1)

    def test_close_that_does_not_dismiss_fails(self):
        self.page.set_content(document(1).replace("this.closest('.layerPopup').style.display='none'", "void(0)"))
        with self.assertRaises(PopupBlocked):
            dismiss_popups(self.page)

    def test_install_is_idempotent(self):
        navigate = auth.navigate_main
        install()
        self.assertIs(auth.navigate_main, navigate)
