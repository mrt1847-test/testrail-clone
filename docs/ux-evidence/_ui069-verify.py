"""UI-069 live verify: header full authoring vs section quiet Add Case."""
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
    project = api("POST", "/api/projects", token, {"name": f"UI-069 Entries {stamp}"})["data"]
    pid = project["id"]
    suite_id = next(s["id"] for s in api("GET", f"/api/projects/{pid}/suites", token)["data"] if s.get("isMaster"))
    login_sec = api("POST", f"/api/suites/{suite_id}/sections", token, {"name": "Login"})["data"]
    empty_sec = api("POST", f"/api/suites/{suite_id}/sections", token, {"name": "Empty"})["data"]
    twin = api("POST", f"/api/suites/{suite_id}/sections", token, {"name": "Login", "parentSectionId": empty_sec["id"]})["data"]
    api("POST", f"/api/sections/{login_sec['id']}/cases", token, {"title": "Existing case", "priority": "medium"})
    return {
        "projectId": pid,
        "suiteId": suite_id,
        "loginId": int(login_sec["id"]),
        "emptyId": int(empty_sec["id"]),
        "nestedLoginId": int(twin["id"]),
        "listUrl": f"{WEB}/projects/{pid}/cases?suiteId={suite_id}&sectionId={login_sec['id']}",
        "emptyUrl": f"{WEB}/projects/{pid}/cases?suiteId={suite_id}&sectionId={empty_sec['id']}",
        "nestedUrl": f"{WEB}/projects/{pid}/cases?suiteId={suite_id}&sectionId={twin['id']}",
    }


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

        page.goto(fx["listUrl"], wait_until="networkidle")
        page.wait_for_timeout(800)

        header_add = page.get_by_role("link", name=re.compile(r"^Add Test Case$", re.I))
        header_ok = header_add.count() > 0
        header_add.first.click()
        page.wait_for_url(re.compile(r".*/cases/new"), timeout=15000)
        page.locator("#case-title").wait_for(state="visible", timeout=20000)
        full_form = "/cases/new" in page.url and page.locator("#case-title").is_visible()
        section_in_url = f"sectionId={fx['loginId']}" in page.url
        suite_in_url = f"suiteId={fx['suiteId']}" in page.url
        page.screenshot(path=str(OUT / "ui-069-after-1280x720-full-form.png"), full_page=False)
        report["checks"]["headerFullAuthoring"] = {
            "ok": header_ok and full_form and section_in_url and suite_in_url,
            "headerLink": header_ok,
            "fullForm": full_form,
            "url": page.url,
        }

        page.goto(fx["listUrl"], wait_until="networkidle")
        page.wait_for_timeout(600)
        more = page.get_by_role("button", name=re.compile(r"More actions", re.I))
        more_open = False
        overflow_has_add_test_case = False
        if more.count():
            more.first.click()
            page.wait_for_timeout(300)
            more_open = page.get_by_role("menu").count() > 0 or page.locator("[role='menuitem']").count() > 0
            overflow_has_add_test_case = page.get_by_role("menuitem", name=re.compile(r"Add Test Case", re.I)).count() > 0
            page.keyboard.press("Escape")
        report["checks"]["noDuplicateOverflow"] = {
            "ok": more_open and not overflow_has_add_test_case,
            "menuOpen": more_open,
            "hasAddTestCase": overflow_has_add_test_case,
        }

        # Section quiet Add Case — title outline, not full form
        section_add = page.get_by_role("button", name=re.compile(r"^Add Case to Login$", re.I))
        if section_add.count() == 0:
            section_add = page.get_by_role("button", name=re.compile(r"^Add Case$", re.I))
        section_add.first.click()
        page.wait_for_timeout(400)
        outline = page.locator(f"#case-outline-{fx['loginId']}")
        outline.wait_for(state="visible", timeout=8000)
        stayed_list = "/cases/new" not in page.url
        page.screenshot(path=str(OUT / "ui-069-after-1280x720-outline.png"), full_page=False)
        titles = [f"Quick {i}" for i in range(1, 6)]
        for title in titles:
            outline.locator("input[type='text']").fill(title)
            outline.locator("input[type='text']").press("Enter")
            page.wait_for_timeout(700)
        still_focus_outline = outline.locator("input[type='text']").evaluate(
            "el => document.activeElement === el"
        )
        listed = [page.get_by_text(t, exact=True).count() > 0 for t in titles]
        report["checks"]["sectionOutlineFive"] = {
            "ok": stayed_list and outline.is_visible() and still_focus_outline and all(listed),
            "stayedList": stayed_list,
            "focus": still_focus_outline,
            "listed": listed,
        }

        # Empty section
        page.goto(fx["emptyUrl"], wait_until="networkidle")
        page.wait_for_timeout(600)
        empty_add = page.get_by_role("button", name=re.compile(r"Add Case", re.I)).first
        empty_add.click()
        page.wait_for_timeout(400)
        empty_outline = page.locator(f"#case-outline-{fx['emptyId']}")
        empty_ok = empty_outline.count() > 0 and "/cases/new" not in page.url
        report["checks"]["emptySectionOutline"] = {"ok": empty_ok}

        # Same-named nested Login still targets its own section via aria path
        page.goto(fx["nestedUrl"], wait_until="networkidle")
        page.wait_for_timeout(600)
        nested_btn = page.get_by_role("button", name=re.compile(r"Add Case to .*Login", re.I))
        nested_ok = nested_btn.count() > 0
        if nested_ok:
            nested_btn.first.click()
            page.wait_for_timeout(300)
            nested_ok = page.locator(f"#case-outline-{fx['nestedLoginId']}").count() > 0
        report["checks"]["nestedSameName"] = {"ok": nested_ok}

        # Tree + opens outline for selected section
        page.goto(fx["listUrl"], wait_until="networkidle")
        page.wait_for_timeout(500)
        tree_plus = page.get_by_role("button", name=re.compile(r"^Add case to Login$", re.I))
        tree_ok = False
        if tree_plus.count():
            tree_plus.first.click()
            page.wait_for_timeout(400)
            tree_ok = page.locator(f"#case-outline-{fx['loginId']}").count() > 0 and "/cases/new" not in page.url
        report["checks"]["treePlusOutline"] = {"ok": tree_ok}

        # 1440 — one primary header CTA
        page.set_viewport_size({"width": 1440, "height": 1000})
        page.goto(fx["listUrl"], wait_until="networkidle")
        page.wait_for_timeout(500)
        header_links = page.get_by_role("link", name=re.compile(r"^Add Test Case$", re.I)).count()
        header_buttons = page.get_by_role("button", name=re.compile(r"^Add Test Case$", re.I)).count()
        page.screenshot(path=str(OUT / "ui-069-after-1440x1000.png"), full_page=False)
        report["checks"]["desktop1440"] = {
            "ok": header_links + header_buttons == 1 and not page_overflow(page),
            "primaryCount": header_links + header_buttons,
            "overflow": page_overflow(page),
        }

        # 390
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(fx["listUrl"], wait_until="networkidle")
        page.wait_for_timeout(500)
        mobile_header = page.get_by_role("link", name=re.compile(r"^Add Test Case$", re.I))
        mobile_header.first.click()
        page.wait_for_url(re.compile(r".*/cases/new"), timeout=15000)
        page.locator("#case-title").wait_for(state="visible", timeout=20000)
        mobile_form = page.locator("#case-title").is_visible()
        page.screenshot(path=str(OUT / "ui-069-after-390x844-full-form.png"), full_page=False)
        page.goto(fx["listUrl"], wait_until="networkidle")
        page.wait_for_timeout(400)
        page.get_by_role("button", name=re.compile(r"Add Case", re.I)).first.click()
        page.wait_for_timeout(400)
        mobile_outline = page.locator(f"#case-outline-{fx['loginId']}").count() > 0
        page.screenshot(path=str(OUT / "ui-069-after-390x844-outline.png"), full_page=False)
        report["checks"]["mobile390"] = {
            "ok": mobile_form and mobile_outline and not page_overflow(page),
            "fullForm": mobile_form,
            "outline": mobile_outline,
            "overflow": page_overflow(page),
        }

        browser.close()

    report["allOk"] = all(c.get("ok") for c in report["checks"].values())
    OUT.joinpath("ui-069-live-verify.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"allOk": report["allOk"], "checks": {k: v.get("ok") for k, v in report["checks"].items()}}, indent=2))
    if not report["allOk"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
