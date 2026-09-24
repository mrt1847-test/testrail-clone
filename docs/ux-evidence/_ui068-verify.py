"""UI-068 live verify: partial save failure stays on the draft and retries leftover work."""
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
    page.wait_for_timeout(400)


def seed(token):
    stamp = int(time.time())
    project = api("POST", "/api/projects", token, {"name": f"UI-068 Partial {stamp}"})["data"]
    pid = project["id"]
    suite_id = next(s["id"] for s in api("GET", f"/api/projects/{pid}/suites", token)["data"] if s.get("isMaster"))
    login_sec = api("POST", f"/api/suites/{suite_id}/sections", token, {"name": "Login"})["data"]
    checkout = api("POST", f"/api/suites/{suite_id}/sections", token, {"name": "Checkout"})["data"]
    templates = api("GET", f"/api/projects/{pid}/settings/templates", token).get("data") or []
    steps_tid = next((t["id"] for t in templates if "step" in (t.get("name") or "").lower()), None)
    panel = api(
        "POST",
        f"/api/sections/{login_sec['id']}/cases",
        token,
        {"title": "Panel case", "priority": "high", **({"caseTemplateId": steps_tid} if steps_tid else {})},
    )["data"]
    other = api("POST", f"/api/sections/{login_sec['id']}/cases", token, {"title": "Other case", "priority": "medium"})["data"]
    return {
        "projectId": pid,
        "suiteId": suite_id,
        "sectionId": int(login_sec["id"]),
        "checkoutId": int(checkout["id"]),
        "panelId": int(panel["id"]),
        "otherId": int(other["id"]),
        "listUrl": f"{WEB}/projects/{pid}/cases?suiteId={suite_id}&sectionId={login_sec['id']}",
        "addUrl": f"{WEB}/projects/{pid}/cases/new?suiteId={suite_id}&sectionId={login_sec['id']}",
    }


def list_cases(token, section_id):
    payload = api("GET", f"/api/sections/{section_id}/cases?page=1&pageSize=50", token)
    return payload.get("data") or []


def page_overflow(page):
    return page.evaluate(
        """() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1"""
    )


def install_step_fail(page, remaining):
    state = {"remaining": remaining}

    def handler(route):
        req = route.request
        if req.method in ("POST", "PATCH") and (
            (req.method == "POST" and "/steps" in req.url and "/attachments" not in req.url)
            or (req.method == "PATCH" and "/case-steps/" in req.url)
        ):
            if state["remaining"] > 0:
                state["remaining"] -= 1
                route.fulfill(
                    status=500,
                    content_type="application/json",
                    body='{"error":{"code":"INTERNAL","message":"injected step fail"}}',
                )
                return
        route.continue_()

    page.route("**/api/cases/**", handler)
    page.route("**/api/case-steps/**", handler)
    return state


def uninstall_step_fail(page):
    page.unroute("**/api/cases/**")
    page.unroute("**/api/case-steps/**")


def main():
    token = api("POST", "/api/auth/login", None, {"email": "admin@example.com", "password": "password"})["token"]
    fx = seed(token)
    report = {"fixture": fx, "checks": {}}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        login(page)

        # --- Add Test Case: steps fail, stay, no duplicate ---
        page.goto(fx["addUrl"], wait_until="networkidle")
        page.locator("#case-title").wait_for(state="visible", timeout=20000)
        page.locator("#case-title").fill("UI-068 add case")
        if page.locator("#case-steps-text").count():
            page.locator("#case-steps-text").fill("Open login\nSubmit form")
        fail_state = install_step_fail(page, 2)
        page.get_by_role("button", name=re.compile(r"^Add Test Case$", re.I)).click()
        page.get_by_role("alert").wait_for(state="visible", timeout=15000)
        still_add = "/cases/new" in page.url
        retry_visible = page.get_by_role("button", name=re.compile(r"^Retry$", re.I)).count() > 0
        title_kept = page.locator("#case-title").input_value() == "UI-068 add case"
        steps_kept = (
            page.locator("#case-steps-text").count() == 0
            or "Open login" in page.locator("#case-steps-text").input_value()
        )
        page.screenshot(path=str(OUT / "ui-068-after-1280x720-add-step-fail.png"), full_page=False)
        cases_after_fail = [c for c in list_cases(token, fx["sectionId"]) if c.get("title") == "UI-068 add case"]
        page.get_by_role("button", name=re.compile(r"^Add Test Case$", re.I)).click()
        page.get_by_role("alert").wait_for(state="visible", timeout=15000)
        cases_after_second = [c for c in list_cases(token, fx["sectionId"]) if c.get("title") == "UI-068 add case"]
        uninstall_step_fail(page)
        page.get_by_role("button", name=re.compile(r"^Retry$", re.I)).click()
        page.wait_for_timeout(2500)
        left_after_retry = "/cases/new" not in page.url
        cases_after_retry = [c for c in list_cases(token, fx["sectionId"]) if c.get("title") == "UI-068 add case"]
        saved_id = cases_after_retry[0]["id"] if cases_after_retry else None
        api_steps = []
        if saved_id is not None:
            detail = api("GET", f"/api/cases/{saved_id}", token)["data"]
            api_steps = [s.get("content") or s.get("description") or "" for s in detail.get("steps") or []]
        report["checks"]["addStepFailRetry"] = {
            "ok": still_add
            and retry_visible
            and title_kept
            and steps_kept
            and len(cases_after_fail) == 1
            and len(cases_after_second) == 1
            and left_after_retry
            and len(cases_after_retry) == 1
            and any("Open login" in s for s in api_steps),
            "stillAdd": still_add,
            "retry": retry_visible,
            "casesAfterFail": len(cases_after_fail),
            "casesAfterSecondSave": len(cases_after_second),
            "casesAfterRetry": len(cases_after_retry),
            "apiSteps": api_steps,
            "injectedLeft": fail_state["remaining"],
        }

        # --- Add & Next does not clear the draft ---
        page.goto(fx["addUrl"], wait_until="networkidle")
        page.locator("#case-title").fill("UI-068 next case")
        if page.locator("#case-steps-text").count():
            page.locator("#case-steps-text").fill("Filter brand")
        install_step_fail(page, 1)
        page.get_by_role("button", name=re.compile(r"Add & Next", re.I)).click()
        page.get_by_role("alert").wait_for(state="visible", timeout=15000)
        next_stayed = "/cases/new" in page.url and page.locator("#case-title").input_value() == "UI-068 next case"
        next_retry = page.get_by_role("button", name=re.compile(r"^Retry$", re.I)).count() > 0
        uninstall_step_fail(page)
        report["checks"]["addNextKeepsDraft"] = {"ok": next_stayed and next_retry, "url": page.url, "retry": next_retry}

        # --- Panel steps fail, Retry, then read mode ---
        page.goto(f"{fx['listUrl']}&panelCaseId={fx['panelId']}&panelMode=edit", wait_until="networkidle")
        page.locator("#case-title").wait_for(state="visible", timeout=20000)
        if page.locator("#case-steps-text").count():
            page.locator("#case-steps-text").fill("Open settings")
        elif page.locator("[id^='case-step-action-']").count():
            page.locator("[id^='case-step-action-']").first.fill("Open settings")
        else:
            page.locator("#case-title").fill("Panel case")
        install_step_fail(page, 1)
        page.get_by_role("button", name=re.compile(r"^Save$", re.I)).click()
        page.get_by_role("alert").wait_for(state="visible", timeout=15000)
        panel_edit = "panelMode=edit" in page.url
        panel_retry = page.get_by_role("button", name=re.compile(r"^Retry$", re.I)).count() > 0
        page.screenshot(path=str(OUT / "ui-068-after-1280x720-panel-step-fail.png"), full_page=False)
        page.get_by_role("button", name=re.compile(r"^Cancel$", re.I)).click()
        dialog = page.get_by_role("dialog")
        dialog.wait_for(state="visible", timeout=8000)
        leave_text = dialog.inner_text()
        leave_mentions_saved = "already saved" in leave_text.lower()
        page.get_by_role("button", name=re.compile(r"Keep editing", re.I)).click()
        uninstall_step_fail(page)
        page.get_by_role("button", name=re.compile(r"^Retry$", re.I)).click()
        try:
            page.wait_for_function("() => !location.search.includes('panelMode=edit')", timeout=15000)
            panel_view = True
        except Exception:
            panel_view = False
        report["checks"]["panelStepFailRetry"] = {
            "ok": panel_edit and panel_retry and leave_mentions_saved and panel_view,
            "edit": panel_edit,
            "retry": panel_retry,
            "leaveMentionsSaved": leave_mentions_saved,
            "view": panel_view,
        }

        # --- Conflict ---
        page.goto(f"{fx['listUrl']}&panelCaseId={fx['otherId']}&panelMode=edit", wait_until="networkidle")
        page.locator("#case-title").wait_for(state="visible", timeout=20000)
        page.locator("#case-title").fill("Other case conflict")

        def conflict_patch(route):
            req = route.request
            if req.method == "PATCH" and "/api/cases/" in req.url and "/steps" not in req.url:
                route.fulfill(
                    status=409,
                    content_type="application/json",
                    body='{"error":{"code":"CONFLICT","message":"case has been modified by another user"}}',
                )
                return
            route.continue_()

        page.route("**/api/cases/**", conflict_patch)
        page.get_by_role("button", name=re.compile(r"^Save$", re.I)).click()
        page.get_by_role("alert").wait_for(state="visible", timeout=15000)
        conflict_text = page.get_by_role("alert").inner_text()
        uninstall_step_fail(page)
        report["checks"]["conflict"] = {
            "ok": "changed after you opened" in conflict_text.lower() and "panelMode=edit" in page.url,
            "text": conflict_text,
        }

        # --- Move fail on full edit form ---
        page.goto(
            f"{WEB}/projects/{fx['projectId']}/cases/{fx['otherId']}/edit?suiteId={fx['suiteId']}&sectionId={fx['sectionId']}",
            wait_until="networkidle",
        )
        page.locator("#case-title").wait_for(state="visible", timeout=20000)
        if page.locator("#case-section").count():
            page.locator("#case-section").select_option(str(fx["checkoutId"]))
        page.locator("#case-title").fill("Other case moved")

        def move_fail(route):
            if route.request.method == "POST" and "bulk-move" in route.request.url:
                route.fulfill(
                    status=500,
                    content_type="application/json",
                    body='{"error":{"code":"INTERNAL","message":"injected move fail"}}',
                )
                return
            route.continue_()

        page.route("**/api/projects/**/cases/bulk-move", move_fail)
        page.get_by_role("button", name=re.compile(r"^Save Test Case$", re.I)).click()
        page.get_by_role("alert").wait_for(state="visible", timeout=15000)
        move_text = page.get_by_role("alert").inner_text()
        still_edit_form = "/edit" in page.url
        page.unroute("**/api/projects/**/cases/bulk-move")
        report["checks"]["moveFail"] = {
            "ok": still_edit_form and "moved" in move_text.lower() and page.get_by_role("button", name=re.compile(r"^Retry$", re.I)).count() > 0,
            "text": move_text,
            "url": page.url,
        }

        # --- A failure must not appear on B ---
        page.goto(f"{fx['listUrl']}&panelCaseId={fx['panelId']}&panelMode=edit", wait_until="networkidle")
        page.locator("#case-title").wait_for(state="visible", timeout=20000)
        page.locator("#case-title").fill("Panel case leftover")
        if page.locator("#case-steps-text").count():
            page.locator("#case-steps-text").fill("Alpha leftover")
        elif page.locator("[id^='case-step-action-']").count():
            page.locator("[id^='case-step-action-']").first.fill("Alpha leftover")
        install_step_fail(page, 1)
        page.get_by_role("button", name=re.compile(r"^Save$", re.I)).click()
        page.get_by_role("alert").wait_for(state="visible", timeout=15000)
        uninstall_step_fail(page)
        page.get_by_role("button", name=re.compile(r"^Cancel$", re.I)).click()
        page.get_by_role("dialog").wait_for(state="visible", timeout=8000)
        page.get_by_role("button", name=re.compile(r"Discard changes", re.I)).click()
        page.wait_for_timeout(600)
        page.goto(f"{fx['listUrl']}&panelCaseId={fx['otherId']}&panelMode=edit", wait_until="networkidle")
        page.locator("#case-title").wait_for(state="visible", timeout=20000)
        b_alert = page.get_by_role("alert").count()
        b_text = page.locator("body").inner_text()
        report["checks"]["switchCaseClearsFailure"] = {
            "ok": b_alert == 0 and "Alpha leftover" not in b_text,
            "alerts": b_alert,
        }

        # 390 keyboard retry
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(fx["addUrl"], wait_until="networkidle")
        page.locator("#case-title").fill("UI-068 mobile")
        if page.locator("#case-steps-text").count():
            page.locator("#case-steps-text").fill("Mobile step")
        install_step_fail(page, 1)
        page.get_by_role("button", name=re.compile(r"^Add Test Case$", re.I)).focus()
        page.keyboard.press("Enter")
        page.get_by_role("alert").wait_for(state="visible", timeout=15000)
        mobile_retry = page.get_by_role("button", name=re.compile(r"^Retry$", re.I))
        mobile_retry.focus()
        overflow = page_overflow(page)
        page.screenshot(path=str(OUT / "ui-068-after-390x844-retry.png"), full_page=False)
        uninstall_step_fail(page)
        mobile_retry.click()
        page.wait_for_timeout(2000)
        mobile_cases = [c for c in list_cases(token, fx["sectionId"]) if c.get("title") == "UI-068 mobile"]
        report["checks"]["mobileRetry"] = {
            "ok": not overflow and len(mobile_cases) == 1,
            "overflow": overflow,
            "cases": len(mobile_cases),
        }

        browser.close()

    report["allOk"] = all(c.get("ok") for c in report["checks"].values())
    OUT.joinpath("ui-068-live-verify.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"allOk": report["allOk"], "checks": {k: v.get("ok") for k, v in report["checks"].items()}}, indent=2))
    if not report["allOk"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
