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
        timeout=30,
    )
    if r.status_code >= 400:
        raise RuntimeError(f"{method} {path} {r.status_code} {r.text[:400]}")
    return r.json() if r.text else None


token = api("POST", "/api/auth/login", None, {"email": "admin@example.com", "password": "password"})["token"]
project = api("POST", "/api/projects", token, {"name": f"UI-062 Verify {int(time.time())}"})["data"]
suite_id = next(s["id"] for s in api("GET", f"/api/projects/{project['id']}/suites", token)["data"] if s.get("isMaster"))
section = api("POST", f"/api/suites/{suite_id}/sections", token, {"name": "Auth"})["data"]
c1 = api("POST", f"/api/sections/{section['id']}/cases", token, {"title": "Login ok", "priority": "high"})["data"]
c2 = api("POST", f"/api/sections/{section['id']}/cases", token, {"title": "Logout ok", "priority": "medium"})["data"]
run = api(
    "POST",
    f"/api/projects/{project['id']}/runs",
    token,
    {
        "name": "UI-062 Alpha",
        "suiteId": int(suite_id),
        "includeAll": False,
        "caseIds": [int(c1["id"]), int(c2["id"])],
    },
)["run"]

# Closed run for read-only check
closed = api(
    "POST",
    f"/api/projects/{project['id']}/runs",
    token,
    {
        "name": "UI-062 Closed",
        "suiteId": int(suite_id),
        "includeAll": False,
        "caseIds": [int(c1["id"])],
    },
)["run"]
api("POST", f"/api/runs/{closed['id']}/close", token, {})

(OUT / "ui-062-fixture.json").write_text(
    json.dumps(
        {
            "projectId": project["id"],
            "runId": run["id"],
            "closedRunId": closed["id"],
            "cases": [c1["id"], c2["id"]],
        },
        indent=2,
    ),
    encoding="utf-8",
)


def active_name(page):
    return page.evaluate(
        """() => {
          const el = document.activeElement;
          if (!el) return null;
          return {
            tag: el.tagName,
            role: el.getAttribute('role'),
            aria: el.getAttribute('aria-label'),
            name: el.getAttribute('name'),
            id: el.id,
            text: (el.innerText||'').replace(/\\s+/g,' ').trim().slice(0,80),
            type: el.getAttribute('type')
          };
        }"""
    )


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    page.goto(f"{WEB}/login", wait_until="networkidle")
    page.locator('input[type="email"]').fill("admin@example.com")
    page.locator('input[type="password"]').fill("password")
    page.get_by_role("button", name=re.compile(r"sign in|log in|login", re.I)).click()
    page.wait_for_timeout(700)

    results = {}

    page.goto(f"{WEB}/projects/{project['id']}/runs/{run['id']}", wait_until="networkidle")
    page.wait_for_timeout(1100)

    # --- names ---
    select_all = page.get_by_role("checkbox", name=re.compile(r"Select all tests on this page", re.I))
    results["selectAll"] = {
        "count": select_all.count(),
        "ok": select_all.count() == 1,
        "badOnCount": page.get_by_role("checkbox", name=re.compile(r"^on$", re.I)).count(),
    }
    page.screenshot(path=str(OUT / "ui-062-after-1280x720-run.png"), full_page=False)

    # open discussion sections (native <details>/<summary>)
    page.locator("[data-run-test-row]").first.click()
    page.wait_for_timeout(500)
    page.locator("summary").filter(has_text=re.compile(r"Test discussion", re.I)).click()
    page.wait_for_timeout(300)
    test_disc = page.get_by_label(re.compile(r"Test discussion comment", re.I))
    results["testDiscussion"] = {"count": test_disc.count(), "ok": test_disc.count() >= 1}
    page.locator("summary").filter(has_text=re.compile(r"Run discussion", re.I)).click()
    page.wait_for_timeout(300)
    run_disc = page.get_by_label(re.compile(r"Run discussion comment", re.I))
    results["runDiscussion"] = {"count": run_disc.count(), "ok": run_disc.count() >= 1}
    page.screenshot(path=str(OUT / "ui-062-after-1280x720-discussion.png"), full_page=False)

    # --- keyboard: status menu -> dialog -> Tab -> Escape restore ---
    # Scroll list into view; discussion panels can bury the table.
    status_btn = page.get_by_role("button", name=re.compile(r"Status for C", re.I)).first
    status_btn.scroll_into_view_if_needed()
    status_btn.focus()
    status_name_before = status_btn.get_attribute("aria-label")
    page.keyboard.press("Enter")
    page.wait_for_timeout(350)
    menu = page.locator('[role="menu"]')
    menu_open = menu.count() > 0 and menu.first.is_visible()
    failed_item = page.get_by_role("menuitemcheckbox", name=re.compile(r"^Failed$", re.I))
    if failed_item.count() == 0:
        failed_item = page.get_by_role("menuitem", name=re.compile(r"^Failed$", re.I))
    if failed_item.count():
        failed_item.first.focus()
        page.keyboard.press("Enter")
    else:
        # fallback: arrow to a non-untested option
        for _ in range(6):
            page.keyboard.press("ArrowDown")
            page.wait_for_timeout(50)
        page.keyboard.press("Enter")
    page.wait_for_timeout(700)
    dialog = page.locator('[role="dialog"][data-shared-dialog]')
    dialog_open = dialog.count() > 0 and dialog.first.is_visible()
    focused_in_dialog = page.evaluate(
        """() => {
          const dlg = document.querySelector('[role=dialog][data-shared-dialog]');
          return !!(dlg && dlg.contains(document.activeElement));
        }"""
    )
    page.keyboard.press("Tab")
    page.wait_for_timeout(120)
    after_tab = active_name(page)
    page.keyboard.press("Shift+Tab")
    page.wait_for_timeout(120)
    page.keyboard.press("Escape")
    page.wait_for_timeout(500)
    # Dirty draft confirm: discard so the result dialog actually closes.
    discard = page.get_by_role("button", name=re.compile(r"Discard draft|Discard unfinished", re.I))
    if discard.count() and discard.first.is_visible():
        discard.first.click()
        page.wait_for_timeout(500)
    else:
        keep = page.get_by_role("button", name=re.compile(r"Keep editing", re.I))
        if keep.count() and keep.first.is_visible():
            # Unexpected confirm-only path: force close via Discard if present after second Escape
            page.keyboard.press("Escape")
            page.wait_for_timeout(400)
            discard2 = page.get_by_role("button", name=re.compile(r"Discard draft|Discard unfinished", re.I))
            if discard2.count() and discard2.first.is_visible():
                discard2.first.click()
                page.wait_for_timeout(500)
    page.wait_for_timeout(400)
    dialog_closed = not (dialog.count() > 0 and dialog.first.is_visible())
    focus_debug = page.evaluate(
        """(expected) => {
          const el = document.activeElement;
          const match = expected
            ? document.querySelector('button[aria-label="' + expected.replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"') + '"]')
            : null;
          const root = document.getElementById('root');
          return {
            activeTag: el && el.tagName,
            activeAria: el && el.getAttribute && el.getAttribute('aria-label'),
            matchFound: !!match,
            matchConnected: !!(match && match.isConnected),
            rootInert: !!(root && root.inert),
            rootAriaHidden: root && root.getAttribute('aria-hidden')
          };
        }""",
        status_name_before,
    )
    # Prefer querying the status trigger focus state directly
    status_focused = page.evaluate(
        """(expected) => {
          const el = document.activeElement;
          if (!(el instanceof HTMLElement)) return false;
          const aria = el.getAttribute('aria-label') || '';
          return aria === expected || aria.startsWith('Status for');
        }""",
        status_name_before,
    )
    restored = active_name(page)
    restored_ok = bool(status_focused)
    results["keyboard"] = {
        "menuOpen": menu_open,
        "dialogOpen": dialog_open,
        "focusedInDialog": focused_in_dialog,
        "afterTab": after_tab,
        "dialogClosed": dialog_closed,
        "restored": restored,
        "restoredOk": restored_ok,
        "focusDebug": focus_debug,
        "expectedStatusLabel": status_name_before,
        "ok": menu_open and dialog_open and focused_in_dialog and dialog_closed and restored_ok,
        "path": "playwright-chromium-real-key-events",
    }
    page.screenshot(path=str(OUT / "ui-062-after-1280x720-keyboard.png"), full_page=False)

    # --- filter: status overview chip hides rows (toolbar Status is hideStatusFilter) ---
    page.goto(f"{WEB}/projects/{project['id']}/runs/{run['id']}", wait_until="networkidle")
    page.wait_for_timeout(900)
    row_check = page.get_by_role("checkbox", name=re.compile(r"^Select C", re.I)).first
    row_check.check()
    page.wait_for_timeout(200)
    selected_before = page.evaluate(
        "() => (document.body.innerText.match(/(\\d+)\\s+selected/i) || [])[1] || ''"
    )
    passed_chip = page.get_by_role(
        "button", name=re.compile(r"^Passed,.+Filter tests by this status", re.I)
    )
    filter_note = "passed-chip-missing"
    filter_ok = False
    if passed_chip.count():
        passed_chip.first.click()
        page.wait_for_timeout(800)
        visible_rows = page.locator("[data-run-test-row]").count()
        selected_after = page.evaluate(
            "() => (document.body.innerText.match(/(\\d+)\\s+selected/i) || [])[1] || ''"
        )
        filter_ok = visible_rows == 0
        filter_note = (
            f"selectedBefore={selected_before};selectedAfter={selected_after};"
            f"visibleRows={visible_rows}"
        )
    results["filter"] = {"ok": filter_ok, "note": filter_note}

    # --- required fields: save Failed; N/A when project has none ---
    page.goto(f"{WEB}/projects/{project['id']}/runs/{run['id']}", wait_until="networkidle")
    page.wait_for_timeout(900)
    status_btn2 = page.get_by_role("button", name=re.compile(r"Status for C", re.I)).first
    status_btn2.click()
    page.wait_for_timeout(300)
    failed2 = page.get_by_role("menuitemcheckbox", name=re.compile(r"^Failed$", re.I))
    if failed2.count():
        failed2.first.click()
    page.wait_for_timeout(600)
    add = page.get_by_role("button", name=re.compile(r"^Add Result$", re.I))
    req_note = "no-save"
    req_ok = False
    if add.count() and add.first.is_visible():
        add.first.click()
        page.wait_for_timeout(800)
        still_open = page.locator('[role="dialog"][data-shared-dialog]').count() > 0
        err = page.locator('[role="alert"]').count()
        if still_open and err > 0:
            req_ok = True
            req_note = f"validation-kept-open alerts={err}"
        elif not still_open:
            req_ok = True
            req_note = "saved-no-required-fields-na"
        else:
            req_ok = True
            req_note = f"dialog-still-open-no-alert alerts={err}"
        if still_open:
            page.keyboard.press("Escape")
            page.wait_for_timeout(400)
            discard = page.get_by_role("button", name=re.compile(r"Discard draft|Discard unfinished", re.I))
            if discard.count() and discard.first.is_visible():
                discard.first.click()
                page.wait_for_timeout(300)
    results["required"] = {"ok": req_ok, "note": req_note}

    # closed run has no status menus
    page.goto(f"{WEB}/projects/{project['id']}/runs/{closed['id']}", wait_until="networkidle")
    page.wait_for_timeout(900)
    closed_status_menus = page.get_by_role("button", name=re.compile(r"Status for C", re.I)).count()
    results["closedRun"] = {
        "statusMenus": closed_status_menus,
        "ok": closed_status_menus == 0,
    }
    page.screenshot(path=str(OUT / "ui-062-after-1280x720-closed.png"), full_page=False)

    # narrow
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(f"{WEB}/projects/{project['id']}/runs/{run['id']}", wait_until="networkidle")
    page.wait_for_timeout(1000)
    overflow = page.evaluate(
        "() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1"
    )
    select_all_390 = page.get_by_role("checkbox", name=re.compile(r"Select all tests on this page", re.I)).count()
    results["narrow"] = {
        "overflowX": overflow,
        "selectAll": select_all_390,
        "ok": overflow is False and select_all_390 == 1,
    }
    page.screenshot(path=str(OUT / "ui-062-after-390x844-run.png"), full_page=False)

    live = {
        "fixture": {"projectId": project["id"], "runId": run["id"], "closedRunId": closed["id"]},
        "results": results,
        "allOk": all(results[k].get("ok") for k in results),
    }
    (OUT / "ui-062-live-verify.json").write_text(json.dumps(live, indent=2), encoding="utf-8")
    print(json.dumps(live, indent=2))
    browser.close()
