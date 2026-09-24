"""Reproduce CA-F01 / UI-065 before fix: Section change clears draft."""
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
    project = api("POST", "/api/projects", token, {"name": f"UI-065 Before {stamp}"})["data"]
    pid = project["id"]
    suite_id = next(s["id"] for s in api("GET", f"/api/projects/{pid}/suites", token)["data"] if s.get("isMaster"))
    login_sec = api("POST", f"/api/suites/{suite_id}/sections", token, {"name": "Login"})["data"]
    checkout = api("POST", f"/api/suites/{suite_id}/sections", token, {"name": "Checkout"})["data"]
    return {
        "projectId": pid,
        "suiteId": suite_id,
        "loginId": login_sec["id"],
        "checkoutId": checkout["id"],
        "addUrl": f"{WEB}/projects/{pid}/cases/new?suiteId={suite_id}&sectionId={login_sec['id']}",
    }


def fill_text_draft(page):
    page.get_by_label(re.compile(r"^Title", re.I)).fill("UI-065 draft title")
    # Preconditions / Expected labels
    for label, value in (
        (r"^Preconditions", "Signed-in shopper"),
        (r"^Expected result", "Order confirms"),
        (r"^References", "UI065-REF"),
    ):
        field = page.get_by_label(re.compile(label, re.I))
        if field.count():
            field.first.fill(value)
    # Text Steps if present
    steps = page.get_by_label(re.compile(r"^Steps", re.I))
    if steps.count():
        steps.first.fill("1. Open cart\n2. Checkout")


def read_draft(page):
    def val(label):
        loc = page.get_by_label(re.compile(label, re.I))
        if not loc.count():
            return None
        return loc.first.input_value()

    return {
        "title": val(r"^Title"),
        "preconditions": val(r"^Preconditions"),
        "expected": val(r"^Expected result"),
        "references": val(r"^References"),
        "steps": val(r"^Steps"),
        "section": page.locator("#case-section").input_value() if page.locator("#case-section").count() else None,
    }


def main():
    token = api("POST", "/api/auth/login", None, {"email": "admin@example.com", "password": "password"})["token"]
    fx = seed(token)
    report = {"fixture": fx, "afterSectionChange": None, "cleared": None}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        login(page)
        page.goto(fx["addUrl"], wait_until="networkidle")
        page.wait_for_timeout(1000)
        page.get_by_label(re.compile(r"^Title", re.I)).wait_for(state="visible", timeout=15000)
        fill_text_draft(page)
        page.wait_for_timeout(300)
        before = read_draft(page)
        page.screenshot(path=str(OUT / "ui-065-before-1280x720-draft.png"), full_page=False)

        # Section Login -> Checkout
        page.locator("#case-section").select_option(str(fx["checkoutId"]))
        page.wait_for_timeout(600)
        after = read_draft(page)
        page.screenshot(path=str(OUT / "ui-065-before-1280x720-section-cleared.png"), full_page=False)

        page.set_viewport_size({"width": 390, "height": 844})
        page.wait_for_timeout(300)
        # Re-fill and clear again for 390 before (same buggy build)
        page.goto(fx["addUrl"], wait_until="networkidle")
        page.wait_for_timeout(800)
        fill_text_draft(page)
        page.locator("#case-section").select_option(str(fx["checkoutId"]))
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / "ui-065-before-390x844-section-cleared.png"), full_page=False)

        report["beforeFill"] = before
        report["afterSectionChange"] = after
        report["cleared"] = after.get("title") in ("", None) and after.get("preconditions") in ("", None)
        browser.close()

    OUT.joinpath("ui-065-before-repro.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"cleared": report["cleared"], "before": before, "after": after}, indent=2))
    if not report["cleared"]:
        raise SystemExit("Expected section change to clear draft before fix")


if __name__ == "__main__":
    main()
