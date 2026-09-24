"""UI-067 live verify: body+steps save refreshes editor, preview, and list without reload."""
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
STEPS_TEXT = "1. Open login\n2. Enter credentials\n3. Submit"


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
    page.wait_for_timeout(400)


def seed(token):
    stamp = int(time.time())
    project = api("POST", "/api/projects", token, {"name": f"UI-067 Save {stamp}"})["data"]
    pid = project["id"]
    suite_id = next(s["id"] for s in api("GET", f"/api/projects/{pid}/suites", token)["data"] if s.get("isMaster"))
    sec = api("POST", f"/api/suites/{suite_id}/sections", token, {"name": "Login"})["data"]
    templates = api("GET", f"/api/projects/{pid}/settings/templates", token)
    rows = templates.get("data") or []
    steps_tid = next((t["id"] for t in rows if "step" in (t.get("name") or "").lower()), None)
    c1 = api("POST", f"/api/sections/{sec['id']}/cases", token, {"title": "Outline case", "priority": "high"})["data"]
    c2_body = {"title": "Three step case", "priority": "medium"}
    if steps_tid is not None:
        c2_body["caseTemplateId"] = steps_tid
    c2 = api("POST", f"/api/sections/{sec['id']}/cases", token, c2_body)["data"]
    for content, expected in (
        ("Open settings", "Settings open"),
        ("Change language", "Language updates"),
        ("Save profile", "Profile saved"),
    ):
        api("POST", f"/api/cases/{c2['id']}/steps", token, {"content": content, "expectedResult": expected})
    return {
        "projectId": pid,
        "suiteId": suite_id,
        "sectionId": int(sec["id"]),
        "c1": int(c1["id"]),
        "c2": int(c2["id"]),
        "stepsTemplateId": steps_tid,
        "listUrl": f"{WEB}/projects/{pid}/cases?suiteId={suite_id}&sectionId={sec['id']}",
        "addUrl": f"{WEB}/projects/{pid}/cases/new?suiteId={suite_id}&sectionId={sec['id']}",
    }


def case_detail(token, case_id):
    return api("GET", f"/api/cases/{case_id}", token)["data"]


def versions(token, case_id):
    payload = api("GET", f"/api/cases/{case_id}/versions?page=1&pageSize=20", token)
    return payload.get("data") or payload.get("items") or []


def open_panel_edit(page, fx, case_id):
    page.goto(f"{fx['listUrl']}&panelCaseId={case_id}&panelMode=edit", wait_until="networkidle")
    page.wait_for_timeout(1000)
    page.locator("#case-title").wait_for(state="visible", timeout=20000)


def page_overflow(page):
    return page.evaluate(
        """() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1"""
    )


def wait_for_read_mode(page, timeout=20000):
    page.wait_for_function("() => !location.search.includes('panelMode=edit')", timeout=timeout)
    page.locator('[aria-label="Test case preview"]').wait_for(state="visible", timeout=8000)


def dialog_open(page):
    dialog = page.get_by_role("dialog")
    return dialog.count() > 0 and dialog.first.is_visible()


def main():
    token = api("POST", "/api/auth/login", None, {"email": "admin@example.com", "password": "password"})["token"]
    fx = seed(token)
    report = {"fixture": fx, "checks": {}}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        login(page)

        # --- CA-F03: outline case + Text steps, save, no reload ---
        open_panel_edit(page, fx, fx["c1"])
        page.locator("#case-title").wait_for(state="visible", timeout=20000)
        page.locator("#case-title").fill("Outline case")
        page.locator("#case-steps-text").wait_for(state="visible", timeout=20000)
        page.locator("#case-steps-text").click()
        page.keyboard.press("Control+A")
        page.keyboard.type(STEPS_TEXT, delay=8)
        save = page.locator('[aria-label="Case editor actions"]').get_by_role("button", name=re.compile(r"^Save$", re.I))
        save.focus()
        saving_shown = False
        save_disabled_while_busy = False

        def is_patch(response):
            return response.request.method == "PATCH" and "/api/cases/" in response.url

        with page.expect_response(is_patch, timeout=20000):
            page.keyboard.press("Enter")
        try:
            page.get_by_role("button", name=re.compile(r"Saving", re.I)).first.wait_for(state="visible", timeout=2000)
            saving_shown = True
            save_disabled_while_busy = page.locator('[aria-label="Case editor actions"]').get_by_role(
                "button", name=re.compile(r"Saving", re.I)
            ).first.is_disabled()
        except Exception:
            pass
        read_ok = False
        try:
            wait_for_read_mode(page)
            read_ok = True
        except Exception:
            pass
        page.wait_for_timeout(400)
        still_edit = "panelMode=edit" in page.url
        preview = page.locator('[aria-label="Test case preview"]')
        preview_text = preview.inner_text() if preview.count() else ""
        preview_has_steps = "Open login" in preview_text and "Enter credentials" in preview_text
        empty_editor = page.locator("#case-steps-text").count() > 0 and page.locator("#case-steps-text").input_value().strip() == ""
        page.screenshot(path=str(OUT / "ui-067-after-1280x720-text-saved.png"), full_page=False)
        api_case = case_detail(token, fx["c1"])
        api_steps = " ".join(s.get("content") or s.get("description") or "" for s in api_case.get("steps") or [])
        list_has = page.get_by_text("Open login").count() > 0
        vers = versions(token, fx["c1"])
        report["checks"]["outlineTextSave"] = {
            "ok": read_ok
            and (not still_edit)
            and preview_has_steps
            and not empty_editor
            and "Open login" in api_steps
            and list_has
            and not dialog_open(page)
            and len(vers) >= 1,
            "stillEdit": still_edit,
            "preview": preview_has_steps,
            "emptyEditor": empty_editor,
            "apiSteps": api_steps[:180],
            "listHas": list_has,
            "savingShown": saving_shown,
            "saveDisabledWhileBusy": save_disabled_while_busy,
            "dialogOpen": dialog_open(page),
            "versionCount": len(vers),
        }

        # Reopen edit: fields match API without reload
        edit_btn = page.get_by_role("button", name=re.compile(r"^Edit$", re.I))
        if edit_btn.count() == 0:
            open_panel_edit(page, fx, fx["c1"])
        else:
            edit_btn.click()
        page.locator("#case-steps-text").wait_for(state="visible", timeout=15000)
        reopen_steps = page.locator("#case-steps-text").input_value() if page.locator("#case-steps-text").count() else ""
        report["checks"]["reopenMatchesApi"] = {
            "ok": "Open login" in reopen_steps and "Submit" in reopen_steps,
            "steps": reopen_steps,
        }
        page.get_by_role("button", name=re.compile(r"^Cancel$", re.I)).click()
        page.wait_for_timeout(400)

        # --- Existing 3-step edit / reorder / delete ---
        open_panel_edit(page, fx, fx["c2"])
        page.locator("[id^='case-step-action-']").first.wait_for(state="visible", timeout=20000)
        actions = page.locator("[id^='case-step-action-']")
        expecteds = page.locator("[id^='case-step-expected-']")
        if actions.count() >= 3:
            actions.nth(0).fill("Open settings first")
            expecteds.nth(0).fill("Settings still open")
            page.get_by_role("button", name=re.compile(r"Move step 2 up", re.I)).click()
            page.wait_for_timeout(150)
            page.get_by_role("button", name=re.compile(r"Remove step 3", re.I)).click()
            page.wait_for_timeout(150)
        page.get_by_role("button", name=re.compile(r"^Save$", re.I)).click()
        try:
            wait_for_read_mode(page)
        except Exception:
            pass
        page.wait_for_timeout(400)
        preview2 = page.locator("[aria-label='Test case preview'], [aria-label='Edit test case']").inner_text()
        api2 = case_detail(token, fx["c2"])
        api2_steps = [s.get("content") or s.get("description") or "" for s in api2.get("steps") or []]
        page.screenshot(path=str(OUT / "ui-067-after-1280x720-steps-saved.png"), full_page=False)
        report["checks"]["structuredStepsSave"] = {
            "ok": (
                "panelMode=edit" not in page.url
                and "Open settings first" in preview2
                and any("Open settings first" in s for s in api2_steps)
                and len(api2_steps) == 2
            ),
            "previewHas": "Open settings first" in preview2,
            "apiSteps": api2_steps,
            "stillEdit": "panelMode=edit" in page.url,
        }

        # --- Full add form: save then list/panel without extra reload ---
        page.goto(fx["addUrl"], wait_until="networkidle")
        page.wait_for_timeout(800)
        page.locator("#case-title").fill("UI-067 add form case")
        page.locator("#case-preconditions").fill("Browser ready")
        if page.locator("#case-steps-text").count():
            page.locator("#case-steps-text").fill("Open catalog\nFilter brand")
        if page.locator("#case-expected-result").count():
            page.locator("#case-expected-result").fill("Results listed")
        page.get_by_role("button", name=re.compile(r"^Add Test Case$", re.I)).click()
        page.wait_for_timeout(2500)
        left_add = "/cases/new" not in page.url
        panel_text = page.locator("body").inner_text()
        add_preview = left_add and "Open catalog" in panel_text
        report["checks"]["fullFormSave"] = {"ok": left_add and add_preview, "url": page.url, "preview": add_preview}

        # 390 keyboard save
        page.set_viewport_size({"width": 390, "height": 844})
        open_panel_edit(page, fx, fx["c1"])
        page.locator("#case-title").click()
        page.keyboard.press("End")
        page.keyboard.type(" mobile")
        page.get_by_role("button", name=re.compile(r"^Save$", re.I)).focus()
        page.keyboard.press("Enter")
        try:
            wait_for_read_mode(page)
        except Exception:
            pass
        page.wait_for_timeout(400)
        mobile_view = "panelMode=edit" not in page.url
        mobile_text = page.locator("body").inner_text()
        overflow = page_overflow(page)
        page.screenshot(path=str(OUT / "ui-067-after-390x844-saved.png"), full_page=False)
        report["checks"]["mobileSave"] = {
            "ok": mobile_view and "Open login" in mobile_text and not overflow and not dialog_open(page),
            "overflow": overflow,
            "view": mobile_view,
        }

        browser.close()

    report["allOk"] = all(c.get("ok") for c in report["checks"].values())
    OUT.joinpath("ui-067-live-verify.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"allOk": report["allOk"], "checks": {k: v.get("ok") for k, v in report["checks"].items()}}, indent=2))
    if not report["allOk"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
