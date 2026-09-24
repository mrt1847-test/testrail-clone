"""UI-070 before: capture CA-U02 duplicate meta + attachments-above-form."""
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
    project = api("POST", "/api/projects", token, {"name": f"UI-070 Before {stamp}"})["data"]
    pid = project["id"]
    suite_id = next(s["id"] for s in api("GET", f"/api/projects/{pid}/suites", token)["data"] if s.get("isMaster"))
    sec = api("POST", f"/api/suites/{suite_id}/sections", token, {"name": "Login"})["data"]
    case = api(
        "POST",
        f"/api/sections/{sec['id']}/cases",
        token,
        {
            "title": "Very long title for panel hierarchy review of login flow",
            "priority": "high",
            "type": "Functional",
            "preconditions": "User is on the login page",
            "expectedResult": "Dashboard opens",
            "steps": [
                {"order": 1, "action": "Enter email", "expected": "Field accepts email"},
                {"order": 2, "action": "Enter password", "expected": "Field accepts password"},
                {"order": 3, "action": "Click Sign in", "expected": "Session starts"},
            ],
        },
    )["data"]
    return {
        "projectId": pid,
        "suiteId": suite_id,
        "sectionId": int(sec["id"]),
        "caseId": int(case["id"]),
        "listUrl": f"{WEB}/projects/{pid}/cases?suiteId={suite_id}&sectionId={sec['id']}",
    }


def label_hits(page, root):
    text = root.inner_text()
    labels = ["Type", "Priority", "Template", "Preconditions"]
    return {label: len(re.findall(rf"\b{re.escape(label)}\b", text, flags=re.I)) for label in labels}


def main():
    token = api("POST", "/api/auth/login", None, {"email": "admin@example.com", "password": "password"})["token"]
    fx = seed(token)
    report = {"fixture": fx, "checks": {}}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        login(page)
        page.goto(fx["listUrl"], wait_until="networkidle")
        page.wait_for_timeout(800)

        page.locator(f'[data-case-row-id="{fx["caseId"]}"] [data-case-open-button]').click()
        panel = page.get_by_role("complementary", name=re.compile(r"test case", re.I))
        panel.wait_for(state="visible", timeout=10000)
        page.wait_for_timeout(500)
        hits = label_hits(page, panel)
        report["checks"]["viewDuplicateLabels"] = hits
        report["checks"]["viewHasDuplicates"] = any(v > 1 for v in hits.values())
        page.screenshot(path=str(OUT / "ui-070-before-1280x720-panel-dirty.png"), full_page=False)

        page.get_by_role("button", name=re.compile(r"^Edit$", re.I)).first.click()
        page.wait_for_timeout(500)
        edit_text = panel.inner_text()
        images_idx = edit_text.lower().find("case images")
        steps_idx = edit_text.lower().find("preconditions")
        if steps_idx < 0:
            steps_idx = edit_text.lower().find("steps")
        report["checks"]["editImagesBeforeInstructions"] = images_idx >= 0 and (
            steps_idx < 0 or images_idx < steps_idx
        )
        page.screenshot(path=str(OUT / "ui-070-before-1280x720-edit-images-first.png"), full_page=False)

        page.set_viewport_size({"width": 390, "height": 844})
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUT / "ui-070-before-390x844-panel.png"), full_page=False)

        browser.close()

    OUT.joinpath("ui-070-before-repro.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    if not report["checks"]["viewHasDuplicates"]:
        raise SystemExit("Expected duplicate labels before fix")
    if not report["checks"]["editImagesBeforeInstructions"]:
        raise SystemExit("Expected Case images above instructions before fix")


if __name__ == "__main__":
    main()
