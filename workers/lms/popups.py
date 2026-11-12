"""Toolbox-only handling of the observed LMS main-page notice windows."""
import re

from playwright.sync_api import Error as BrowserError

VISIBLE_POPUPS = "#mainPopup .layerPopup:visible"


class PopupBlocked(RuntimeError):
    def __init__(self):
        super().__init__("LMS notice popup could not be closed.")


def dismiss_popups(page):
    # A safety budget, not an expected popup count. Never click notice contents
    # or the persistent 'do not show today' checkbox, nor remove DOM overlays.
    try:
        for _ in range(20):
            popup = page.locator(VISIBLE_POPUPS).last
            if not popup.count():
                return
            window_id = popup.get_attribute("id") or ""
            if not re.fullmatch(r"window\d+", window_id):
                raise PopupBlocked()
            close = popup.locator(f".header #closeButton{window_id[6:]}")
            if close.count() != 1:
                raise PopupBlocked()
            # LMS windows overlap each other. Invoke only the verified close
            # control's own click event, then require that window to disappear.
            # Page-level evaluation avoids recursively running the locator
            # handler while explicitly clearing a newly navigated page.
            page.evaluate("id => document.querySelector('#mainPopup #' + id + ' .header #closeButton' + id.slice(6)).click()", window_id)
            page.wait_for_function("""id => {
                const el = document.querySelector('#mainPopup #' + id);
                return !el || !el.getClientRects().length || getComputedStyle(el).visibility === 'hidden';
            }""", arg=window_id, timeout=2000)
        if page.locator(VISIBLE_POPUPS).count():
            raise PopupBlocked()
    except BrowserError:
        raise PopupBlocked() from None


def install():
    """Call before importing collectors: their by-name auth imports must agree.

    Source files in the independent Discord Notifier are never changed.
    """
    from dju_lms_notifier.lms import auth

    if getattr(auth.navigate_main, "_toolbox_popups", False):
        return
    original_navigate = auth.navigate_main
    original_inspect = auth.inspect_auth

    def navigate(page):
        if not getattr(page, "_toolbox_popups", False):
            # Late notices are handled again before Playwright actions such as
            # opening the term menu. Registration survives document navigation.
            page.add_locator_handler(page.locator(VISIBLE_POPUPS).first, lambda: dismiss_popups(page))
            page._toolbox_popups = True
        original_navigate(page)
        dismiss_popups(page)

    def inspect(page):
        # Manual login polls this function, including after the login redirect.
        dismiss_popups(page)
        return original_inspect(page)

    navigate._toolbox_popups = True
    auth.navigate_main = navigate
    auth.inspect_auth = inspect
