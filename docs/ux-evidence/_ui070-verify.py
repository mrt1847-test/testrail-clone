"""UI-070 live verify: panel hierarchy — no duplicate meta, instructions first, stacked edit."""
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
    project = api("POST", "/api/projects", token, {"name": f"UI-070 Panel {stamp}"})["data"]
    pid = project["id"]
    suite_id = next(s["id"] for s in api("GET", f"/api/projects/{pid}/suites", token)["data"] if s.get("isMaster"))
    sec = api("POST", f"/api/suites/{suite_id}/sections", token, {"name": "Login"})["data"]
    templates = api("GET", f"/api/projects/{pid}/settings/templates", token).get("data") or []
    steps_tid = next((t["id"] for t in templates if "step" in (t.get("name") or "").lower()), None)
    text_tid = next((t["id"] for t in templates if "text" in (t.get("name") or "").lower()), None)

    steps_case = api(
        "POST",
        f"/api/sections/{sec['id']}/cases",
        token,
        {
            "title": "Very long title for panel hierarchy review of the login and session flow",
            "priority": "high",
            "type": "Functional",
            "preconditions": "User is on the login page with a valid account",
            "expectedResult": "Dashboard opens after sign-in",
            **({"caseTemplateId": steps_tid} if steps_tid else {}),
        },
    )["data"]
    cid = int(steps_case["id"])
    for order, action, expected in [
        (1, "Enter email", "Field accepts email"),
        (2, "Enter password", "Field accepts password"),
        (3, "Click Sign in", "Session starts"),
    ]:
        api(
            "POST",
            f"/api/cases/{cid}/steps",
            token,
            {"content": action, "expectedResult": expected},
        )

    text_case = api(
        "POST",
        f"/api/sections/{sec['id']}/cases",
        token,
        {
            "title": "Text template case",
            "priority": "medium",
            "preconditions": "App is open",
            "expectedResult": "Home loads",
            **({"caseTemplateId": text_tid} if text_tid else {}),
        },
    )["data"]
    empty_case = api(
        "POST",
        f"/api/sections/{sec['id']}/cases",
        token,
        {"title": "No instructions yet", "priority": "low"},
    )["data"]

    return {
        "projectId": pid,
        "suiteId": suite_id,
        "sectionId": int(sec["id"]),
        "stepsCaseId": cid,
        "textCaseId": int(text_case["id"]),
        "emptyCaseId": int(empty_case["id"]),
        "listUrl": f"{WEB}/projects/{pid}/cases?suiteId={suite_id}&sectionId={sec['id']}",
    }


def page_overflow(page):
    return page.evaluate(
        """() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1"""
    )


def panel_loc(page):
    return page.get_by_role("complementary", name=re.compile(r"test case|edit test case", re.I))


def dom_order_ok(panel, earlier: str, later: str) -> bool:
    return panel.evaluate(
        """(root, selectors) => {
          const left = root.querySelector(selectors[0]);
          const right = root.querySelector(selectors[1]);
          if (!left || !right) return false;
          const pos = left.compareDocumentPosition(right);
          return (pos & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
        }""",
        [earlier, later],
    )


def open_case(page, case_id):
    page.locator(f'[data-case-row-id="{case_id}"] [data-case-open-button]').click()
    panel = panel_loc(page)
    panel.wait_for(state="visible", timeout=10000)
    page.wait_for_timeout(400)
    return panel


def wait_instructions(panel, *, expect_steps: bool = False):
    panel.locator("[data-case-instructions]").wait_for(state="visible", timeout=10000)
    if expect_steps:
        panel.locator(".run-case-instruction__step").first.wait_for(state="visible", timeout=10000)
        panel.locator(".run-case-instruction__action").first.wait_for(state="visible", timeout=5000)


def label_counts(text: str):
    return {
        label: len(re.findall(rf"\b{re.escape(label)}\b", text, flags=re.I))
        for label in ("Type", "Priority", "Template", "Preconditions")
    }


def y_of(locator):
    box = locator.bounding_box()
    return box["y"] if box else None


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

        # --- View: no duplicate meta, instructions before attachments ---
        panel = open_case(page, fx["stepsCaseId"])
        wait_instructions(panel, expect_steps=True)
        hits = label_counts(panel.inner_text())
        meta = panel.locator("[data-case-meta-summary]")
        instr = panel.locator("[data-case-instructions]")
        report["checks"]["viewLabels"] = hits
        report["checks"]["viewNoDuplicates"] = all(v <= 1 for v in hits.values()) and hits["Preconditions"] == 1
        report["checks"]["viewOrder"] = {
            "metaBeforeInstructions": (y_of(meta) or 0) < (y_of(instr) or 9999),
            "instructionsBeforeAttachments": dom_order_ok(
                panel, "[data-case-instructions]", "[data-case-attachments]"
            ),
            "attachmentsBeforeVersions": dom_order_ok(
                panel, "[data-case-attachments]", "[data-case-versions]"
            ),
            "hasActionExpected": panel.locator(".run-case-instruction__action").count() >= 3
            and panel.locator(".run-case-instruction__expected").count() >= 3,
        }
        page.screenshot(path=str(OUT / "ui-070-after-1280x720-read.png"), full_page=False)

        # --- Edit: form before Case images, stacked fields, instructions before optional meta ---
        panel.get_by_role("button", name=re.compile(r"^Edit$", re.I)).first.click()
        page.wait_for_timeout(500)
        form = panel.locator("[data-case-authoring-form]")
        form.wait_for(state="visible")
        edit_attach = panel.locator("[data-case-attachments]")
        dest = panel.locator("[data-case-authoring-destination]")
        auth_instr = panel.locator("[data-case-authoring-instructions]")
        opt = panel.locator("[data-case-authoring-optional-meta]")
        stacked = form.get_attribute("data-stack-fields") == "true"
        cols = form.evaluate(
            """(el) => {
              const grid = el.querySelector('[data-case-authoring-optional-meta]');
              if (!grid) return null;
              return getComputedStyle(grid).gridTemplateColumns;
            }"""
        )
        multi_track = bool(cols and re.search(r"\d+(?:\.\d+)?px.+\d+(?:\.\d+)?px", cols))
        report["checks"]["edit"] = {
            "stacked": stacked,
            "formBeforeAttachments": (y_of(form) or 0) < (y_of(edit_attach) or 9999),
            "destinationBeforeInstructions": (y_of(dest) or 0) < (y_of(auth_instr) or 9999),
            "instructionsBeforeOptionalMeta": (y_of(auth_instr) or 0) < (y_of(opt) or 9999),
            "optionalMetaColumns": cols,
            "optionalMetaSingleColumn": not multi_track,
            "imagesAfterInstructions": panel.inner_text().lower().find("case images")
            > panel.inner_text().lower().find("preconditions"),
        }
        page.screenshot(path=str(OUT / "ui-070-after-1280x720-edit.png"), full_page=False)

        # Cancel edit (no dirty if we didn't type) via Close/Cancel
        if panel.locator('button:has-text("Cancel")').count():
            panel.locator('button:has-text("Cancel")').first.click()
            page.wait_for_timeout(300)
        else:
            panel.get_by_role("button", name=re.compile(r"^Close$", re.I)).click()
            page.wait_for_timeout(300)

        # Re-open if closed
        if panel_loc(page).count() == 0:
            panel = open_case(page, fx["stepsCaseId"])
        else:
            panel = panel_loc(page)

        # Force 360px panel width via localStorage key used by TestCaseWorkspace
        page.evaluate(
            f"""() => {{
              const pid = {json.dumps(fx["projectId"])};
              for (const k of Object.keys(localStorage)) {{
                if (k.startsWith('cases:detail-pane-width:') && k.endsWith(':' + pid)) {{
                  localStorage.setItem(k, '360');
                }}
              }}
            }}"""
        )
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(600)
        panel = open_case(page, fx["stepsCaseId"])
        handle = page.locator('[role="separator"]')
        if handle.count():
            handle.focus()
            for _ in range(24):
                page.keyboard.press("ArrowRight")
            page.wait_for_timeout(200)
        panel.get_by_role("button", name=re.compile(r"^Edit$", re.I)).first.click()
        page.wait_for_timeout(400)
        form = panel.locator("[data-case-authoring-form]")
        cols360 = form.evaluate(
            """(el) => {
              const grid = el.querySelector('[data-case-authoring-optional-meta]');
              return grid ? getComputedStyle(grid).gridTemplateColumns : null;
            }"""
        )
        multi360 = bool(cols360 and re.search(r"\d+(?:\.\d+)?px.+\d+(?:\.\d+)?px", cols360))
        layout_ok = panel.evaluate(
            """(el) => {
              const pane = el.getBoundingClientRect();
              const title = el.querySelector('#case-title');
              const save = [...el.querySelectorAll('button')].find((b) => /save/i.test(b.textContent || ''));
              const nodes = [title, save].filter(Boolean);
              return nodes.every((n) => {
                const r = n.getBoundingClientRect();
                return r.left >= pane.left - 1 && r.right <= pane.right + 1 && r.width > 8;
              });
            }"""
        )
        pane_w = panel.evaluate("(el) => Math.round(el.getBoundingClientRect().width)")
        report["checks"]["panel360"] = {
            "paneWidth": pane_w,
            "optionalMetaColumns": cols360,
            "singleColumn": not multi360,
            "controlsFitPane": layout_ok,
            "overflowX": page_overflow(page),
        }
        page.screenshot(path=str(OUT / "ui-070-after-1280x720-360panel-edit.png"), full_page=False)

        # Text + empty cases quick open
        panel.get_by_role("button", name=re.compile(r"^Close$", re.I)).click()
        page.wait_for_timeout(200)
        open_case(page, fx["textCaseId"])
        page.screenshot(path=str(OUT / "ui-070-after-1280x720-text-read.png"), full_page=False)
        page.get_by_role("complementary", name=re.compile(r"test case", re.I)).get_by_role("button", name=re.compile(r"^Close$", re.I)).click()
        page.wait_for_timeout(200)
        open_case(page, fx["emptyCaseId"])
        empty_ok = "No instructions" in panel_loc(page).inner_text()
        report["checks"]["emptyInstructions"] = empty_ok

        # 1440
        page.set_viewport_size({"width": 1440, "height": 1000})
        page.goto(fx["listUrl"], wait_until="networkidle")
        page.wait_for_timeout(500)
        open_case(page, fx["stepsCaseId"])
        report["checks"]["desktop1440"] = {
            "noDuplicates": all(v <= 1 for v in label_counts(panel_loc(page).inner_text()).values()),
            "overflowX": page_overflow(page),
        }
        page.screenshot(path=str(OUT / "ui-070-after-1440x1000-read.png"), full_page=False)

        # 390: open scrolls panel into view; close restores row focus
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(fx["listUrl"], wait_until="networkidle")
        page.wait_for_timeout(600)
        row_btn = page.locator(f'[data-case-row-id="{fx["stepsCaseId"]}"] [data-case-open-button]')
        row_btn.focus()
        row_btn.click()
        panel = panel_loc(page)
        panel.wait_for(state="visible")
        page.wait_for_timeout(500)
        in_view = panel.evaluate(
            """(el) => {
              const r = el.getBoundingClientRect();
              return r.top < window.innerHeight && r.bottom > 0;
            }"""
        )
        focused_in_panel = panel.evaluate("(el) => el === document.activeElement || el.contains(document.activeElement)")
        page.screenshot(path=str(OUT / "ui-070-after-390x844-read.png"), full_page=False)
        panel.get_by_role("button", name=re.compile(r"^Edit$", re.I)).first.click()
        page.wait_for_timeout(400)
        edit_in_view = panel_loc(page).evaluate(
            """(el) => {
              const r = el.getBoundingClientRect();
              return r.top < window.innerHeight && r.bottom > 0;
            }"""
        )
        page.screenshot(path=str(OUT / "ui-070-after-390x844-edit.png"), full_page=False)
        # leave without dirty
        panel_loc(page).locator('button:has-text("Cancel")').first.click()
        page.wait_for_timeout(300)
        panel_loc(page).get_by_role("button", name=re.compile(r"^Close$", re.I)).click()
        page.wait_for_timeout(400)
        focus_back = page.evaluate(
            f"""() => {{
              const el = document.activeElement;
              return !!(el && el.closest('[data-case-row-id="{fx["stepsCaseId"]}"]'));
            }}"""
        )
        report["checks"]["mobile390"] = {
            "panelInView": in_view,
            "focusInPanel": focused_in_panel,
            "editInView": edit_in_view,
            "focusRestoredToRow": focus_back,
            "overflowX": page_overflow(page),
        }

        browser.close()

    report["allOk"] = (
        report["checks"]["viewNoDuplicates"]
        and all(report["checks"]["viewOrder"].values())
        and report["checks"]["edit"]["stacked"]
        and report["checks"]["edit"]["formBeforeAttachments"]
        and report["checks"]["edit"]["destinationBeforeInstructions"]
        and report["checks"]["edit"]["instructionsBeforeOptionalMeta"]
        and report["checks"]["edit"]["optionalMetaSingleColumn"]
        and report["checks"]["panel360"]["singleColumn"]
        and report["checks"]["panel360"]["controlsFitPane"]
        and not report["checks"]["panel360"]["overflowX"]
        and report["checks"]["panel360"]["paneWidth"] is not None
        and report["checks"]["panel360"]["paneWidth"] <= 400
        and report["checks"]["emptyInstructions"]
        and report["checks"]["desktop1440"]["noDuplicates"]
        and not report["checks"]["desktop1440"]["overflowX"]
        and report["checks"]["mobile390"]["panelInView"]
        and report["checks"]["mobile390"]["focusInPanel"]
        and report["checks"]["mobile390"]["editInView"]
        and report["checks"]["mobile390"]["focusRestoredToRow"]
        and not report["checks"]["mobile390"]["overflowX"]
    )
    OUT.joinpath("ui-070-live-verify.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    if not report["allOk"]:
        raise SystemExit("UI-070 live verify failed")


if __name__ == "__main__":
    main()
