"""UI-071 live verify: stage images on Add, upload only after caseId, partial fail Retry."""
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
    project = api("POST", "/api/projects", token, {"name": f"UI-071 Attach {stamp}"})["data"]
    pid = project["id"]
    suite_id = next(s["id"] for s in api("GET", f"/api/projects/{pid}/suites", token)["data"] if s.get("isMaster"))
    sec = api("POST", f"/api/suites/{suite_id}/sections", token, {"name": "Login"})["data"]
    return {
        "projectId": pid,
        "suiteId": suite_id,
        "sectionId": int(sec["id"]),
        "addUrl": f"{WEB}/projects/{pid}/cases/new?suiteId={suite_id}&sectionId={sec['id']}",
        "listUrl": f"{WEB}/projects/{pid}/cases?suiteId={suite_id}&sectionId={sec['id']}",
    }


def list_cases(token, section_id):
    payload = api("GET", f"/api/sections/{section_id}/cases?page=1&pageSize=50", token)
    return payload.get("data") or []


def page_overflow(page):
    return page.evaluate(
        """() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1"""
    )


def tiny_png_bytes():
    # 1x1 PNG
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
        b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def install_upload_ok(page, tracker):
    def on_presign(route):
        req = route.request
        if req.method != "POST":
            route.continue_()
            return
        body = req.post_data_json or {}
        case_id = re.search(r"/api/cases/(\d+)/attachments/presign", req.url)
        cid = case_id.group(1) if case_id else "0"
        name = body.get("fileName") or "file.png"
        tracker["presignCalls"].append({"caseId": cid, "fileName": name})
        storage = f"local://cases/{cid}/{name}"
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(
                {
                    "data": {
                        "storagePath": storage,
                        "uploadUrl": f"{API}/__ui071-mock-upload",
                        "method": "PUT",
                        "expiresAt": "2099-01-01T00:00:00.000Z",
                    }
                }
            ),
        )

    def on_mock_put(route):
        tracker["putCalls"] += 1
        route.fulfill(status=200, body=b"ok")

    page.route("**/api/cases/*/attachments/presign", on_presign)
    page.route(f"{API}/__ui071-mock-upload**", on_mock_put)


def install_upload_fail_once(page, tracker):
    state = {"failRemaining": 1}

    def on_presign(route):
        req = route.request
        if req.method != "POST":
            route.continue_()
            return
        body = req.post_data_json or {}
        case_id = re.search(r"/api/cases/(\d+)/attachments/presign", req.url)
        cid = case_id.group(1) if case_id else "0"
        name = body.get("fileName") or "file.png"
        tracker["presignCalls"].append({"caseId": cid, "fileName": name, "fail": state["failRemaining"] > 0})
        if state["failRemaining"] > 0:
            state["failRemaining"] -= 1
            route.fulfill(
                status=500,
                content_type="application/json",
                body=json.dumps({"error": {"code": "UPLOAD_FAILED", "message": "forced attach fail"}}),
            )
            return
        storage = f"local://cases/{cid}/{name}"
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(
                {
                    "data": {
                        "storagePath": storage,
                        "uploadUrl": f"{API}/__ui071-mock-upload",
                        "method": "PUT",
                        "expiresAt": "2099-01-01T00:00:00.000Z",
                    }
                }
            ),
        )

    def on_mock_put(route):
        tracker["putCalls"] += 1
        route.fulfill(status=200, body=b"ok")

    page.route("**/api/cases/*/attachments/presign", on_presign)
    page.route(f"{API}/__ui071-mock-upload**", on_mock_put)


def fill_title(page, title: str):
    page.locator("#case-title").wait_for(state="visible", timeout=20000)
    page.locator("#case-title").fill(title)


def stage_png(page, name: str):
    panel = page.locator("[data-case-attachment-staging]")
    panel.wait_for(timeout=10000)
    panel.locator('input[type="file"]').set_input_files(
        {"name": name, "mimeType": "image/png", "buffer": tiny_png_bytes()}
    )
    page.wait_for_timeout(200)


def main():
    token = api("POST", "/api/auth/login", None, {"email": "admin@example.com", "password": "password"})["token"]
    fx = seed(token)
    report = {"fixture": fx, "checks": {}}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # --- 1280: staging UI + success upload after caseId ---
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        login(page)
        page.goto(fx["addUrl"], wait_until="networkidle")
        page.wait_for_timeout(600)

        staging = page.locator("[data-case-attachment-staging]")
        report["checks"]["stagingVisible"] = staging.count() > 0
        report["checks"]["stagingEmptyHint"] = page.locator("[data-case-attachment-staging-empty]").count() > 0
        page.screenshot(path=str(OUT / "ui-071-after-1280x720-staging-empty.png"), full_page=False)

        tracker_ok = {"presignCalls": [], "putCalls": 0}
        install_upload_ok(page, tracker_ok)

        title_ok = f"UI071 staged ok {int(time.time())}"
        fill_title(page, title_ok)
        stage_png(page, "shot-a.png")
        stage_png(page, "shot-b.png")
        report["checks"]["stagedTwo"] = page.locator("[data-staged-case-attachment]").count() == 2
        page.locator("[data-staged-case-attachment]").first.get_by_role("button", name=re.compile(r"remove", re.I)).click()
        page.wait_for_timeout(200)
        report["checks"]["removeOne"] = page.locator("[data-staged-case-attachment]").count() == 1
        stage_png(page, "shot-c.png")
        report["checks"]["restagedTwo"] = page.locator("[data-staged-case-attachment]").count() == 2
        page.screenshot(path=str(OUT / "ui-071-after-1280x720-staged.png"), full_page=False)

        before_cases = {c.get("title") for c in list_cases(token, fx["sectionId"])}
        page.get_by_role("button", name=re.compile(r"^Add Test Case$", re.I)).click()
        page.wait_for_url(re.compile(r".*/cases(?:\?|$)"), timeout=25000)
        page.wait_for_timeout(800)
        after_cases = list_cases(token, fx["sectionId"])
        created = next((c for c in after_cases if c.get("title") == title_ok), None)
        report["checks"]["caseCreatedAfterUpload"] = created is not None and title_ok not in before_cases
        report["checks"]["presignAfterCaseId"] = (
            len(tracker_ok["presignCalls"]) >= 1
            and created is not None
            and all(str(row["caseId"]) == str(created["id"]) for row in tracker_ok["presignCalls"])
        )
        report["checks"]["mockPutUsed"] = tracker_ok["putCalls"] >= 1
        page.screenshot(path=str(OUT / "ui-071-after-1280x720-saved.png"), full_page=False)
        page.close()

        # --- 1280: partial fail keeps case, Retry, blocks Add & Next ---
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        login(page)
        page.goto(fx["addUrl"], wait_until="networkidle")
        page.wait_for_timeout(500)
        tracker_fail = {"presignCalls": [], "putCalls": 0}
        install_upload_fail_once(page, tracker_fail)

        title_fail = f"UI071 attach fail {int(time.time())}"
        fill_title(page, title_fail)
        stage_png(page, "fail-me.png")
        page.get_by_role("button", name=re.compile(r"^Add & Next$", re.I)).click()
        page.wait_for_timeout(2500)
        still_on_add = "/cases/new" in page.url
        alert = page.get_by_role("alert")
        alert_text = alert.first.inner_text() if alert.count() else ""
        retry = page.get_by_role("button", name=re.compile(r"^Retry$", re.I))
        report["checks"]["addNextBlockedOnAttachFail"] = still_on_add and retry.count() > 0
        report["checks"]["attachFailMessage"] = bool(re.search(r"saved.*could not be uploaded|Retry the failed", alert_text, re.I))
        failed_cases = [c for c in list_cases(token, fx["sectionId"]) if c.get("title") == title_fail]
        report["checks"]["caseKeptOnAttachFail"] = len(failed_cases) == 1
        if alert.count():
            alert.first.scroll_into_view_if_needed()
        page.locator("[data-case-attachment-staging]").scroll_into_view_if_needed()
        page.wait_for_timeout(200)
        page.screenshot(path=str(OUT / "ui-071-after-1280x720-attach-fail.png"), full_page=False)

        # Cancel shows pending-attachment leave copy
        page.get_by_role("button", name=re.compile(r"^Cancel$", re.I)).click()
        page.wait_for_timeout(400)
        dialog = page.get_by_role("dialog")
        dlg = dialog.inner_text() if dialog.count() else ""
        report["checks"]["leaveWarnsPendingAttach"] = bool(re.search(r"already saved.*images|not uploaded", dlg, re.I))
        page.get_by_role("button", name=re.compile(r"keep editing", re.I)).click()
        page.wait_for_timeout(300)

        retry.click()
        page.wait_for_timeout(2500)
        left_or_next = "/cases/new" not in page.url or page.get_by_text(re.compile(r"Successfully added", re.I)).count() > 0
        # Add & Next after successful retry should reset form and stay on add
        report["checks"]["retryUploadThenNext"] = (
            page.get_by_text(re.compile(r"Successfully added", re.I)).count() > 0
            or ("/cases/new" in page.url and page.locator("[data-case-attachment-staging-empty]").count() > 0)
        )
        report["checks"]["retryPresignSecondAttempt"] = len(tracker_fail["presignCalls"]) >= 2
        page.screenshot(path=str(OUT / "ui-071-after-1280x720-retry-ok.png"), full_page=False)
        page.close()

        # --- 390: staging + overflow ---
        page = browser.new_page(viewport={"width": 390, "height": 844})
        login(page)
        page.goto(fx["addUrl"], wait_until="networkidle")
        page.wait_for_timeout(500)
        report["checks"]["stagingVisible390"] = page.locator("[data-case-attachment-staging]").count() > 0
        stage_png(page, "m390.png")
        report["checks"]["staged390"] = page.locator("[data-staged-case-attachment]").count() == 1
        report["checks"]["noOverflowX390"] = not page_overflow(page)
        page.locator("[data-case-attachment-staging]").scroll_into_view_if_needed()
        page.wait_for_timeout(200)
        page.screenshot(path=str(OUT / "ui-071-after-390x844-staged.png"), full_page=False)
        page.close()

        browser.close()

    report["allOk"] = all(bool(v) for v in report["checks"].values())
    out = OUT / "ui-071-live-verify.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    if not report["allOk"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
