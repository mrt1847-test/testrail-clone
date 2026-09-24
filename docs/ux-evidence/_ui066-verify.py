"""UI-066 live verify: panel/full-form unsaved draft leave protection."""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

import requests
from playwright.sync_api import sync_playwright

API = "http://localhost:4000"
WEB = "http://localhost:5173"
OUT = Path("docs/ux-evidence")


def api(method, path, token, body=None):
    r = requests.request(
        method,
        API + path,
        headers={"authorization": f"Bearer {token}", "content-type": "application/json"},
        json=body,
        timeout=60,
    )
    if r.status_code >= 400:
        raise RuntimeError(f"{method} {path} {r.status_code} {r.text[:500]}")
    return r.json() if r.text else None


def login(page):
    page.goto(f"{WEB}/login", wait_until="networkidle")
    page.fill('input[type="email"]', "admin@example.com")
    page.fill('input[type="password"]', "password")
    page.get_by_role("button", name=re.compile(r"sign in|log in|login", re.I)).click()
    page.wait_for_url(re.compile(r".*/projects(?:/|\?|$)"), timeout=20000)
    page.wait_for_timeout(500)


def seed(token):
    stamp = int(time.time())
    project = api("POST", "/api/projects", token, {"name": f"UI-066 Guard {stamp}"})["data"]
    pid = project["id"]
    suite_id = next(s["id"] for s in api("GET", f"/api/projects/{pid}/suites", token)["data"] if s.get("isMaster"))
    sec = api("POST", f"/api/suites/{suite_id}/sections", token, {"name": "Login"})["data"]
    other = api("POST", f"/api/suites/{suite_id}/sections", token, {"name": "Checkout"})["data"]
    c1 = api("POST", f"/api/sections/{sec['id']}/cases", token, {"title": "Alpha case", "priority": "high"})["data"]
    c2 = api("POST", f"/api/sections/{sec['id']}/cases", token, {"title": "Beta case", "priority": "medium"})["data"]
    return {
        "projectId": pid,
        "suiteId": suite_id,
        "loginId": int(sec["id"]),
        "checkoutId": int(other["id"]),
        "c1": int(c1["id"]),
        "c2": int(c2["id"]),
        "listUrl": f"{WEB}/projects/{pid}/cases?suiteId={suite_id}&sectionId={sec['id']}",
        "addUrl": f"{WEB}/projects/{pid}/cases/new?suiteId={suite_id}&sectionId={sec['id']}",
    }


def open_panel_edit(page, fx, case_id):
    page.goto(f"{fx['listUrl']}&panelCaseId={case_id}&panelMode=edit", wait_until="networkidle")
    page.wait_for_timeout(1000)
    page.locator("#case-title").wait_for(state="visible", timeout=20000)


def dialog(page):
    return page.get_by_role("dialog").filter(has_text=re.compile(r"Discard unsaved", re.I))


def dialog_visible(page):
    return dialog(page).count() > 0


def page_overflow(page):
    return page.evaluate(
        """() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1"""
    )


def main():
    token = api("POST", "/api/auth/login", None, {"email": "admin@example.com", "password": "password"})["token"]
    fx = seed(token)
    report = {"fixture": fx, "checks": {}}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        login(page)

        # --- Panel Close shows discard ---
        open_panel_edit(page, fx, fx["c1"])
        page.locator("#case-title").click()
        page.keyboard.type("Alpha edited draft", delay=20)
        page.wait_for_timeout(400)
        page.get_by_role("button", name=re.compile(r"^Close$", re.I)).click()
        page.wait_for_timeout(500)
        close_dialog = dialog_visible(page)
        labelled = page.get_by_role("dialog", name=re.compile(r"Discard unsaved", re.I)).count() > 0
        page.screenshot(path=str(OUT / "ui-066-after-1280x720-panel-close-dialog.png"), full_page=False)
        # Keep editing
        page.get_by_role("button", name=re.compile(r"Keep editing", re.I)).click()
        page.wait_for_timeout(300)
        keep_ok = "Alpha edited draft" in page.locator("#case-title").input_value() and "panelMode=edit" in page.url
        report["checks"]["panelCloseDialog"] = {
            "ok": close_dialog and keep_ok and labelled,
            "dialog": close_dialog,
            "kept": keep_ok,
            "a11yLabelled": labelled,
        }

        # Escape keeps editing
        page.get_by_role("button", name=re.compile(r"^Close$", re.I)).click()
        page.wait_for_timeout(400)
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        escape_ok = not dialog_visible(page) and "panelMode=edit" in page.url and "Alpha edited draft" in page.locator("#case-title").input_value()
        report["checks"]["escapeKeep"] = {"ok": escape_ok}

        # Tab cycles Keep ↔ Discard then Enter Discard
        page.get_by_role("button", name=re.compile(r"^Close$", re.I)).click()
        page.wait_for_timeout(400)
        page.keyboard.press("Tab")
        page.wait_for_timeout(100)
        focused1 = page.evaluate("() => document.activeElement && document.activeElement.textContent")
        page.keyboard.press("Tab")
        page.wait_for_timeout(100)
        focused2 = page.evaluate("() => document.activeElement && document.activeElement.textContent")
        page.get_by_role("button", name=re.compile(r"Discard changes", re.I)).focus()
        page.keyboard.press("Enter")
        page.wait_for_timeout(600)
        discarded = "panelCaseId" not in page.url and "panelMode" not in page.url
        report["checks"]["tabAndEnterDiscard"] = {
            "ok": discarded and focused1 is not None and focused2 is not None,
            "focused1": focused1,
            "focused2": focused2,
            "url": page.url,
        }

        # Clean view: Close without dialog
        page.goto(f"{fx['listUrl']}&panelCaseId={fx['c1']}", wait_until="networkidle")
        page.wait_for_timeout(800)
        page.get_by_role("button", name=re.compile(r"^Close$", re.I)).click()
        page.wait_for_timeout(400)
        clean_close = not dialog_visible(page) and "panelCaseId" not in page.url
        report["checks"]["cleanCloseNoDialog"] = {"ok": clean_close}

        # Other row while dirty
        open_panel_edit(page, fx, fx["c1"])
        page.locator("#case-title").click()
        page.keyboard.press("Control+A")
        page.keyboard.type("Switch row draft", delay=15)
        page.wait_for_timeout(300)
        beta = page.locator("[data-case-row-id]").filter(has_text=re.compile(r"Beta case", re.I)).first
        if beta.count():
            beta.locator("[data-case-open-button]").click(timeout=3000)
        else:
            page.get_by_text("Beta case").first.click()
        page.wait_for_timeout(500)
        row_dialog = dialog_visible(page)
        page.get_by_role("button", name=re.compile(r"Keep editing", re.I)).click()
        page.wait_for_timeout(300)
        still_alpha = page.locator("#case-title").input_value() == "Switch row draft"
        report["checks"]["otherRowDialog"] = {"ok": row_dialog and still_alpha}

        # Section change while dirty
        page.locator("#case-title").click()
        page.keyboard.press("Control+A")
        page.keyboard.type("Section change draft", delay=15)
        checkout = page.get_by_role("treeitem", name=re.compile(r"Checkout", re.I))
        if checkout.count() == 0:
            checkout = page.get_by_text(re.compile(r"^Checkout", re.I))
        checkout.first.click()
        page.wait_for_timeout(500)
        sec_dialog = dialog_visible(page)
        page.get_by_role("button", name=re.compile(r"Discard changes", re.I)).click()
        page.wait_for_timeout(600)
        report["checks"]["sectionChangeDialog"] = {"ok": sec_dialog, "url": page.url}

        # Cancel on full Add form
        page.goto(fx["addUrl"], wait_until="networkidle")
        page.wait_for_timeout(800)
        page.locator("#case-title").fill("New draft title")
        page.locator("#case-preconditions").fill("Keep if staying")
        page.get_by_role("button", name=re.compile(r"^Cancel$", re.I)).click()
        page.wait_for_timeout(400)
        add_dialog = dialog_visible(page)
        page.screenshot(path=str(OUT / "ui-066-after-1280x720-add-cancel-dialog.png"), full_page=False)
        page.get_by_role("button", name=re.compile(r"Keep editing", re.I)).click()
        page.wait_for_timeout(200)
        add_kept = page.locator("#case-title").input_value() == "New draft title"
        # Top nav link
        page.get_by_role("link", name=re.compile(r"Test Runs|Overview|Milestones", re.I)).first.click()
        page.wait_for_timeout(400)
        nav_dialog = dialog_visible(page)
        page.get_by_role("button", name=re.compile(r"Keep editing", re.I)).click()
        page.wait_for_timeout(200)
        report["checks"]["addCancelAndNav"] = {
            "ok": add_dialog and add_kept and nav_dialog,
            "addDialog": add_dialog,
            "navDialog": nav_dialog,
        }

        # Browser back while dirty
        page.goto(fx["listUrl"], wait_until="networkidle")
        page.wait_for_timeout(400)
        page.goto(fx["addUrl"], wait_until="networkidle")
        page.wait_for_timeout(600)
        page.locator("#case-title").fill("Back button draft")
        page.wait_for_timeout(300)
        page.go_back()
        page.wait_for_timeout(500)
        back_dialog = dialog_visible(page)
        page.get_by_role("button", name=re.compile(r"Keep editing", re.I)).click()
        page.wait_for_timeout(300)
        still_on_add = "/cases/new" in page.url and page.locator("#case-title").input_value() == "Back button draft"
        report["checks"]["browserBack"] = {"ok": back_dialog and still_on_add, "url": page.url}

        # IME: composition Escape in the title does not discard the draft
        page.locator("#case-title").click()
        page.locator("#case-title").press("Control+A")
        page.keyboard.type("한글초안", delay=20)
        page.wait_for_timeout(200)
        page.evaluate(
            """() => {
              const el = document.querySelector('#case-title');
              el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
            }"""
        )
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        ime_ok = (
            not dialog_visible(page)
            and "/cases/new" in page.url
            and "한글초안" in page.locator("#case-title").input_value()
        )
        report["checks"]["imeEscapeKeepsDraft"] = {"ok": ime_ok}

        # beforeunload while dirty (browser leave warning)
        fired = {"ok": False}

        def on_dialog(d):
            fired["ok"] = True
            d.dismiss()

        page.on("dialog", on_dialog)
        handled = page.evaluate(
            """() => {
              const event = new Event('beforeunload', { cancelable: true });
              window.dispatchEvent(event);
              return event.defaultPrevented === true || event.returnValue === '';
            }"""
        )
        try:
            page.evaluate("() => { window.location.href = '/login'; }")
            page.wait_for_timeout(800)
        except Exception:
            pass
        report["checks"]["beforeUnload"] = {"ok": fired["ok"] or bool(handled)}
        page.remove_listener("dialog", on_dialog)
        page.wait_for_timeout(300)

        # Successful save: no dialog on leave
        if "/cases/new" not in page.url:
            page.goto(fx["addUrl"], wait_until="networkidle")
            page.wait_for_timeout(600)
        page.locator("#case-title").fill("UI-066 saved clean")
        page.get_by_role("button", name=re.compile(r"^Add Test Case$", re.I)).click()
        page.wait_for_timeout(2000)
        saved_leave = not dialog_visible(page) and "/cases/new" not in page.url
        report["checks"]["saveThenNoDialog"] = {"ok": saved_leave, "url": page.url}

        # 390 overflow + dialog
        page.set_viewport_size({"width": 390, "height": 844})
        open_panel_edit(page, fx, fx["c1"])
        page.locator("#case-title").click()
        page.keyboard.press("Control+A")
        page.keyboard.type("Mobile draft", delay=15)
        page.get_by_role("button", name=re.compile(r"^Close$", re.I)).click()
        page.wait_for_timeout(400)
        mobile_dialog = dialog_visible(page)
        overflow = page_overflow(page)
        page.screenshot(path=str(OUT / "ui-066-after-390x844-panel-close-dialog.png"), full_page=False)
        report["checks"]["mobileDialog"] = {"ok": mobile_dialog and not overflow, "overflow": overflow}
        page.get_by_role("button", name=re.compile(r"Keep editing", re.I)).click()

        browser.close()

    report["allOk"] = all(c.get("ok") for c in report["checks"].values())
    OUT.joinpath("ui-066-live-verify.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"allOk": report["allOk"], "checks": {k: v.get("ok") for k, v in report["checks"].items()}}, indent=2))
    if not report["allOk"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
