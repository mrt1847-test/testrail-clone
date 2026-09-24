"""Live-verify UI-065: Section changes preserve authoring draft."""
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
    project = api("POST", "/api/projects", token, {"name": f"UI-065 After {stamp}"})["data"]
    pid = project["id"]
    suite_id = next(s["id"] for s in api("GET", f"/api/projects/{pid}/suites", token)["data"] if s.get("isMaster"))
    login_sec = api("POST", f"/api/suites/{suite_id}/sections", token, {"name": "Login"})["data"]
    checkout = api("POST", f"/api/suites/{suite_id}/sections", token, {"name": "Checkout"})["data"]
    templates = api("GET", f"/api/projects/{pid}/settings/templates", token)
    tmpl = templates.get("data") or templates
    return {
        "projectId": pid,
        "suiteId": suite_id,
        "loginId": int(login_sec["id"]),
        "checkoutId": int(checkout["id"]),
        "templates": tmpl,
        "addUrl": f"{WEB}/projects/{pid}/cases/new?suiteId={suite_id}&sectionId={login_sec['id']}",
    }


def page_overflow(page):
    return page.evaluate(
        """() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
        })"""
    )


def open_add(page, url):
    page.goto(url, wait_until="networkidle")
    page.wait_for_timeout(800)
    page.locator("#case-title").wait_for(state="visible", timeout=20000)


def select_template(page, name_substr):
    select = page.locator("#case-template")
    if not select.count():
        return False
    options = select.locator("option").all()
    for opt in options:
        text = opt.inner_text()
        if name_substr.lower() in text.lower():
            select.select_option(opt.get_attribute("value"))
            page.wait_for_timeout(400)
            # Confirm dialog if template change warns
            discard = page.get_by_role("button", name=re.compile(r"change template|continue|confirm", re.I))
            if discard.count():
                try:
                    discard.first.click(timeout=800)
                except Exception:
                    pass
            return True
    return False


def fill_text_draft(page):
    page.locator("#case-title").fill("UI-065 text title")
    page.locator("#case-preconditions").fill("Signed-in shopper")
    if page.locator("#case-steps-text").count():
        page.locator("#case-steps-text").fill("Open cart\nPay")
    page.locator("#case-expected-result").fill("Order confirms")
    refs = page.locator("#case-references")
    if refs.count():
        refs.fill("UI065-REF")
        refs.press("Enter")
        page.wait_for_timeout(200)


def read_text_draft(page):
    refs_tokens = page.evaluate(
        """() => [...document.querySelectorAll('[aria-label^="Remove "]')].map(el => el.getAttribute('aria-label'))"""
    )
    return {
        "title": page.locator("#case-title").input_value(),
        "preconditions": page.locator("#case-preconditions").input_value(),
        "steps": page.locator("#case-steps-text").input_value() if page.locator("#case-steps-text").count() else None,
        "expected": page.locator("#case-expected-result").input_value()
        if page.locator("#case-expected-result").count()
        else None,
        "referencesPresent": any("UI065-REF" in (t or "") for t in refs_tokens),
        "section": page.locator("#case-section").input_value(),
        "template": page.locator("#case-template").input_value() if page.locator("#case-template").count() else None,
    }


def cycle_sections(page, a_id, b_id):
    page.locator("#case-section").select_option(str(b_id))
    page.wait_for_timeout(400)
    mid = read_text_draft(page)
    page.locator("#case-section").select_option(str(a_id))
    page.wait_for_timeout(400)
    back = read_text_draft(page)
    page.locator("#case-section").select_option(str(b_id))
    page.wait_for_timeout(400)
    final = read_text_draft(page)
    return {"atB": mid, "backA": back, "finalB": final}


def fill_steps_draft(page):
    select_template(page, "Steps")
    page.wait_for_timeout(500)
    conf = page.get_by_role("button", name=re.compile(r"change template|continue|use|confirm|switch", re.I))
    if conf.count():
        try:
            conf.first.click(timeout=1000)
        except Exception:
            pass
    page.locator("#case-title").fill("UI-065 steps title")
    page.locator("#case-preconditions").fill("Ready browser")
    add_btn = page.get_by_role("button", name=re.compile(r"Add step", re.I))
    # Ensure three step action fields
    for _ in range(5):
        actions = page.locator("[id^='case-step-action-']")
        if actions.count() >= 3:
            break
        if add_btn.count():
            add_btn.click()
            page.wait_for_timeout(200)
    actions = page.locator("[id^='case-step-action-']")
    expecteds = page.locator("[id^='case-step-expected-']")
    for i, text in enumerate(("Open login", "Enter credentials", "Submit")):
        actions.nth(i).fill(text)
    for i, text in enumerate(("Form visible", "Fields filled", "Redirected")):
        if expecteds.count() > i:
            expecteds.nth(i).fill(text)
    if page.locator("#case-expected-result").count():
        page.locator("#case-expected-result").fill("Home opens")
    refs = page.locator("#case-references")
    if refs.count():
        refs.fill("UI065-STEPS")
        refs.press("Enter")


def read_steps_draft(page):
    actions = [page.locator("[id^='case-step-action-']").nth(i).input_value() for i in range(min(3, page.locator("[id^='case-step-action-']").count()))]
    return {
        "title": page.locator("#case-title").input_value(),
        "preconditions": page.locator("#case-preconditions").input_value(),
        "actions": actions,
        "template": page.locator("#case-template").input_value() if page.locator("#case-template").count() else None,
        "section": page.locator("#case-section").input_value(),
        "expected": page.locator("#case-expected-result").input_value()
        if page.locator("#case-expected-result").count()
        else None,
    }


def cases_in_section(token, project_id, section_id):
    # list via suite cases or section cases
    data = api("GET", f"/api/projects/{project_id}/cases?sectionId={section_id}&page=1&pageSize=50", token)
    rows = data.get("data") or data.get("items") or []
    if isinstance(rows, dict):
        rows = rows.get("items") or rows.get("data") or []
    return rows


def main():
    token = api("POST", "/api/auth/login", None, {"email": "admin@example.com", "password": "password"})["token"]
    fx = seed(token)
    report = {"fixture": {k: v for k, v in fx.items() if k != "templates"}, "checks": {}}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        login(page)

        # --- Text preserve A→B→A→B ---
        open_add(page, fx["addUrl"])
        select_template(page, "Test Case (Text)")
        fill_text_draft(page)
        cyc = cycle_sections(page, fx["loginId"], fx["checkoutId"])
        preserved = (
            cyc["finalB"]["title"] == "UI-065 text title"
            and cyc["finalB"]["preconditions"] == "Signed-in shopper"
            and cyc["finalB"]["expected"] == "Order confirms"
            and cyc["atB"]["title"] == "UI-065 text title"
            and cyc["backA"]["title"] == "UI-065 text title"
            and str(cyc["finalB"]["section"]) == str(fx["checkoutId"])
        )
        report["checks"]["textSectionPreserve"] = {"ok": preserved, "cycle": cyc}
        page.screenshot(path=str(OUT / "ui-065-after-1280x720-preserved.png"), full_page=False)
        page.set_viewport_size({"width": 390, "height": 844})
        page.wait_for_timeout(300)
        report["checks"]["overflow390"] = page_overflow(page)
        page.screenshot(path=str(OUT / "ui-065-after-390x844-preserved.png"), full_page=False)

        # Required error keeps values
        page.set_viewport_size({"width": 1280, "height": 720})
        page.locator("#case-title").fill("")
        page.get_by_role("button", name=re.compile(r"^Add Test Case$", re.I)).click()
        page.wait_for_timeout(400)
        title_err = page.get_by_text(re.compile(r"Title is required", re.I)).count() > 0
        still = read_text_draft(page)
        report["checks"]["requiredKeepsDraft"] = {
            "ok": title_err and still["preconditions"] == "Signed-in shopper" and still["expected"] == "Order confirms",
            "still": still,
        }
        page.locator("#case-title").fill("UI-065 text title")

        # Save failure keeps draft
        page.route("**/api/sections/*/cases", lambda route: route.fulfill(status=500, body='{"error":{"message":"forced fail"}}'))
        page.get_by_role("button", name=re.compile(r"^Add Test Case$", re.I)).click()
        page.wait_for_timeout(800)
        after_fail = read_text_draft(page)
        report["checks"]["saveFailKeepsDraft"] = {
            "ok": after_fail["title"] == "UI-065 text title" and after_fail["preconditions"] == "Signed-in shopper",
            "draft": after_fail,
        }
        page.unroute("**/api/sections/*/cases")

        # Save to Checkout (B)
        page.get_by_role("button", name=re.compile(r"^Add Test Case$", re.I)).click()
        page.wait_for_timeout(1500)
        # May land on list with panel
        checkout_cases = cases_in_section(token, fx["projectId"], fx["checkoutId"])
        login_cases = cases_in_section(token, fx["projectId"], fx["loginId"])
        titles_b = [c.get("title") for c in checkout_cases]
        titles_a = [c.get("title") for c in login_cases]
        report["checks"]["savedOnlyInB"] = {
            "ok": "UI-065 text title" in titles_b and "UI-065 text title" not in titles_a and len([t for t in titles_b if t == "UI-065 text title"]) == 1,
            "checkout": titles_b,
            "login": titles_a,
        }

        # Reopen / read instructions
        saved = next((c for c in checkout_cases if c.get("title") == "UI-065 text title"), None)
        reopen_ok = False
        if saved:
            cid = saved.get("id")
            detail = api("GET", f"/api/cases/{cid}", token)
            data = detail.get("data") or detail
            reopen_ok = (
                (data.get("preconditions") or "") == "Signed-in shopper"
                and "Order confirms" in (data.get("expectedResult") or "")
            )
            # open edit page and confirm fields
            page.goto(
                f"{WEB}/projects/{fx['projectId']}/cases/{cid}/edit?suiteId={fx['suiteId']}&sectionId={fx['checkoutId']}",
                wait_until="networkidle",
            )
            page.wait_for_timeout(1000)
            if page.locator("#case-title").count():
                reopen_ok = reopen_ok and page.locator("#case-title").input_value() == "UI-065 text title"
            # Section-only dirty on edit
            page.locator("#case-section").select_option(str(fx["loginId"]))
            page.wait_for_timeout(300)
            page.get_by_role("button", name=re.compile(r"Back to cases", re.I)).click()
            page.wait_for_timeout(400)
            discard = page.get_by_role("button", name=re.compile(r"Discard", re.I))
            section_dirty = discard.count() > 0
            if section_dirty:
                page.get_by_role("button", name=re.compile(r"Keep editing", re.I)).click()
                page.wait_for_timeout(200)
                # restore section for cleanliness
                page.locator("#case-section").select_option(str(fx["checkoutId"]))
            report["checks"]["editSectionDirty"] = {"ok": section_dirty}
        report["checks"]["reopenInstructions"] = {"ok": reopen_ok, "caseId": saved.get("id") if saved else None}

        # Steps template preserve
        open_add(page, fx["addUrl"])
        fill_steps_draft(page)
        page.locator("#case-section").select_option(str(fx["checkoutId"]))
        page.wait_for_timeout(400)
        page.locator("#case-section").select_option(str(fx["loginId"]))
        page.wait_for_timeout(400)
        page.locator("#case-section").select_option(str(fx["checkoutId"]))
        page.wait_for_timeout(400)
        steps_after = read_steps_draft(page)
        steps_ok = (
            steps_after["title"] == "UI-065 steps title"
            and steps_after["preconditions"] == "Ready browser"
            and steps_after["actions"][:3] == ["Open login", "Enter credentials", "Submit"]
            and str(steps_after["section"]) == str(fx["checkoutId"])
        )
        report["checks"]["stepsSectionPreserve"] = {"ok": steps_ok, "draft": steps_after}
        page.screenshot(path=str(OUT / "ui-065-after-1280x720-steps-preserved.png"), full_page=False)

        # Save steps case to B
        page.get_by_role("button", name=re.compile(r"^Add Test Case$", re.I)).click()
        page.wait_for_timeout(2000)
        checkout_cases2 = cases_in_section(token, fx["projectId"], fx["checkoutId"])
        steps_saved = next((c for c in checkout_cases2 if c.get("title") == "UI-065 steps title"), None)
        report["checks"]["stepsSavedInB"] = {"ok": steps_saved is not None, "id": steps_saved.get("id") if steps_saved else None}

        # Add & Next does not leak previous draft
        open_add(page, fx["addUrl"])
        fill_text_draft(page)
        page.locator("#case-title").fill("UI-065 next first")
        page.get_by_role("button", name=re.compile(r"Add & Next", re.I)).click()
        page.wait_for_timeout(1500)
        after_next = read_text_draft(page)
        leak_ok = after_next["title"] == "" and (after_next["preconditions"] in ("", None))
        report["checks"]["addNextNoLeak"] = {"ok": leak_ok, "draft": after_next}
        page.screenshot(path=str(OUT / "ui-065-after-1280x720-add-next-clear.png"), full_page=False)

        # Keyboard: Tab to section, change with keys roughly - focus section and use select
        open_add(page, fx["addUrl"])
        page.locator("#case-title").fill("UI-065 keyboard")
        page.locator("#case-preconditions").fill("Keep me")
        page.locator("#case-section").focus()
        page.keyboard.press("Alt+ArrowDown")
        page.wait_for_timeout(100)
        # select Checkout via keyboard by selecting option value directly after focus (real key path limited on native select)
        page.locator("#case-section").select_option(str(fx["checkoutId"]))
        page.wait_for_timeout(300)
        kb = read_text_draft(page)
        report["checks"]["keyboardSectionPreserve"] = {
            "ok": kb["title"] == "UI-065 keyboard" and kb["preconditions"] == "Keep me",
            "draft": kb,
        }

        browser.close()

    report["allOk"] = all(c.get("ok") for c in report["checks"].values() if isinstance(c, dict) and "ok" in c)
    if report["checks"].get("overflow390"):
        report["checks"]["overflow390Ok"] = {"ok": not report["checks"]["overflow390"]["overflowX"]}
        report["allOk"] = report["allOk"] and report["checks"]["overflow390Ok"]["ok"]

    OUT.joinpath("ui-065-live-verify.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"allOk": report["allOk"], "checks": {k: v.get("ok") if isinstance(v, dict) else v for k, v in report["checks"].items()}}, indent=2))
    if not report["allOk"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
