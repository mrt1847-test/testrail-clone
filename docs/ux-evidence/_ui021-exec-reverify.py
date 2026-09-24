"""UI-021 integrated reverify: remaining exec paths (UX-002/030/031/040, UI-052/055/056) — no product fixes."""
from __future__ import annotations

import json
import re
import time
from pathlib import Path
from urllib.parse import parse_qs, urlparse

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


def qs(url: str) -> dict:
    return {k: v[0] if len(v) == 1 else v for k, v in parse_qs(urlparse(url).query).items()}


def page_overflow(page):
    return page.evaluate(
        """() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1"""
    )


def seed(token):
    stamp = int(time.time())
    project = api("POST", "/api/projects", token, {"name": f"UI-021 Exec {stamp}"})["data"]
    pid = project["id"]
    suite_id = next(s["id"] for s in api("GET", f"/api/projects/{pid}/suites", token)["data"] if s.get("isMaster"))
    sec = api("POST", f"/api/suites/{suite_id}/sections", token, {"name": "Login"})["data"]
    cases = []
    for i, title in enumerate(
        [
            "Exec A open catalog",
            "Exec B filter brand",
            "Exec C add to cart",
            "Exec D checkout email",
            "Exec E confirm total",
        ]
    ):
        row = api(
            "POST",
            f"/api/sections/{sec['id']}/cases",
            token,
            {
                "title": title,
                "priority": "high",
                "preconditions": f"Ready {i+1}",
                "expectedResult": f"Expect {i+1}",
            },
        )["data"]
        cases.append(row)
    created = api(
        "POST",
        f"/api/projects/{pid}/runs",
        token,
        {
            "name": "UI-021 exec reverify",
            "suiteId": int(suite_id),
            "includeAll": False,
            "caseIds": [int(c["id"]) for c in cases],
        },
    )
    run = created["run"]
    instances = created.get("instances") or []
    by_case = {int(i["caseId"]): i for i in instances}
    ordered = [by_case[int(c["id"])] for c in cases]
    return {
        "projectId": pid,
        "suiteId": suite_id,
        "sectionId": int(sec["id"]),
        "runId": run["id"],
        "cases": [{"id": c["id"], "title": c["title"]} for c in cases],
        "tests": [{"id": t["id"], "caseId": t["caseId"]} for t in ordered],
        "runUrl": f"{WEB}/projects/{pid}/runs/{run['id']}",
        "hubUrl": f"{WEB}/projects/{pid}/runs",
        "overviewUrl": f"{WEB}/projects/{pid}",
        "myTestsUrl": f"{WEB}/projects/{pid}/my-tests",
    }


def test_id_from_url(url: str):
    return qs(url).get("testId")


def main():
    token = api("POST", "/api/auth/login", None, {"email": "admin@example.com", "password": "password"})["token"]
    fx = seed(token)
    report = {
        "fixture": {k: v for k, v in fx.items() if k != "tests"},
        "testIds": [t["id"] for t in fx["tests"]],
        "checks": {},
        "defects": [],
        "externalWaits": {"E01": "blocked", "E03": "blocked"},
        "timestamp": int(time.time()),
    }
    t = fx["tests"]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # ----- 1280: Add Result stays / Pass & Next advances / no Jump -----
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        login(page)
        page.goto(f"{fx['runUrl']}?testId={t[0]['id']}", wait_until="networkidle")
        page.wait_for_timeout(800)

        jump = page.get_by_text(re.compile(r"Jump to next after save", re.I))
        report["checks"]["noJumpCheckbox"] = {"ok": jump.count() == 0}

        page.get_by_role("button", name=re.compile(r"^Add result$", re.I)).click()
        page.wait_for_timeout(500)
        dialog = page.get_by_role("dialog")
        report["checks"]["addResultOpensDialog"] = {"ok": dialog.count() > 0 and dialog.first.is_visible()}
        # Dialog uses StatusPicker variant=select (aria-label Status)
        status_select = dialog.get_by_label(re.compile(r"^Status$", re.I))
        if status_select.count():
            status_select.select_option(label="Passed")
        else:
            dialog.locator("select").first.select_option(label="Passed")
        comment = dialog.locator("textarea").first
        if comment.count():
            comment.fill("UI-021 add result stay check")
        save_btn = dialog.get_by_role("button", name=re.compile(r"^Add Result$", re.I))
        if save_btn.count() == 0:
            save_btn = dialog.get_by_role("button", name=re.compile(r"^Save$", re.I))
        before = test_id_from_url(page.url)
        save_btn.first.click()
        page.wait_for_timeout(1500)
        after = test_id_from_url(page.url)
        report["checks"]["addResultStays"] = {
            "ok": before is not None and before == after == str(t[0]["id"]),
            "before": before,
            "after": after,
        }
        if not report["checks"]["addResultStays"]["ok"]:
            report["defects"].append(
                {
                    "id": "UI-021-add-result-advance",
                    "expect": "Ordinary Add Result stays on current testId",
                    "actual": {"before": before, "after": after},
                }
            )
        page.screenshot(path=str(OUT / "ui-021-reverify-add-result-stay-1280x720.png"), full_page=False)

        # Pass & Next from test 1 (or current) to next
        page.goto(f"{fx['runUrl']}?testId={t[1]['id']}", wait_until="networkidle")
        page.wait_for_timeout(600)
        before2 = test_id_from_url(page.url)
        pass_next = page.get_by_role("button", name=re.compile(r"^Pass & Next$", re.I))
        report["checks"]["passNextNamed"] = {"ok": pass_next.count() > 0}
        if pass_next.count():
            pass_next.first.click()
            page.wait_for_timeout(2000)
        after2 = test_id_from_url(page.url)
        report["checks"]["passNextAdvances"] = {
            "ok": before2 == str(t[1]["id"]) and after2 == str(t[2]["id"]),
            "before": before2,
            "after": after2,
            "expected": str(t[2]["id"]),
        }
        if not report["checks"]["passNextAdvances"]["ok"]:
            report["defects"].append(
                {
                    "id": "UI-021-pass-next",
                    "expect": f"Pass & Next from {t[1]['id']} to {t[2]['id']}",
                    "actual": {"before": before2, "after": after2},
                }
            )
        # Instructions should change to Exec C
        body = page.locator("body").inner_text()
        report["checks"]["passNextShowsNextInstructions"] = {
            "ok": "Exec C add to cart" in body or "Ready 3" in body or "Expect 3" in body,
            "sample": body[:350],
        }
        page.screenshot(path=str(OUT / "ui-021-reverify-pass-next-1280x720.png"), full_page=False)

        # Last test Pass & Next does not wrap
        page.goto(f"{fx['runUrl']}?testId={t[4]['id']}", wait_until="networkidle")
        page.wait_for_timeout(500)
        before_last = test_id_from_url(page.url)
        if page.get_by_role("button", name=re.compile(r"^Pass & Next$", re.I)).count():
            page.get_by_role("button", name=re.compile(r"^Pass & Next$", re.I)).first.click()
            page.wait_for_timeout(1500)
        after_last = test_id_from_url(page.url)
        report["checks"]["passNextNoWrap"] = {
            "ok": before_last == after_last == str(t[4]["id"]),
            "before": before_last,
            "after": after_last,
        }

        # Bulk Apply Blocked on two untested rows
        page.goto(fx["runUrl"], wait_until="networkidle")
        page.wait_for_timeout(700)
        # Select checkboxes for D and E if still untested — use accessible names
        for label in ("Exec D checkout email", "Exec E confirm total"):
            row = page.locator("tr").filter(has_text=label)
            if row.count():
                cb = row.first.get_by_role("checkbox")
                if cb.count():
                    cb.first.check()
        page.wait_for_timeout(300)
        apply_btn = page.get_by_role("button", name=re.compile(r"^Apply result$", re.I))
        report["checks"]["bulkApplyVisible"] = {"ok": apply_btn.count() > 0}
        if apply_btn.count():
            page.locator("#bulk-result-status").select_option(value="blocked")
            apply_btn.first.click()
            page.wait_for_timeout(2000)
        # List STATUS for D/E should show Blocked without reload
        d_status = page.locator("tr").filter(has_text="Exec D checkout email").inner_text() if page.locator("tr").filter(has_text="Exec D checkout email").count() else ""
        e_status = page.locator("tr").filter(has_text="Exec E confirm total").inner_text() if page.locator("tr").filter(has_text="Exec E confirm total").count() else ""
        bulk_ok = "Blocked" in d_status and "Blocked" in e_status
        report["checks"]["bulkListStatusSynced"] = {
            "ok": bulk_ok,
            "d": d_status[:120],
            "e": e_status[:120],
        }
        if not bulk_ok:
            report["defects"].append(
                {
                    "id": "UI-021-bulk-status-stale",
                    "expect": "After bulk Apply Blocked, list STATUS shows Blocked without reload",
                    "actual": {"d": d_status[:120], "e": e_status[:120]},
                }
            )
        page.screenshot(path=str(OUT / "ui-021-reverify-bulk-1280x720.png"), full_page=False)

        # Hub / Overview / My Tests reachable
        page.goto(fx["hubUrl"], wait_until="networkidle")
        page.wait_for_timeout(600)
        hub_ok = page.get_by_text(re.compile(r"UI-021 exec reverify", re.I)).count() > 0
        report["checks"]["hubShowsRun"] = {"ok": hub_ok}
        page.screenshot(path=str(OUT / "ui-021-reverify-hub-1280x720.png"), full_page=False)

        page.goto(fx["overviewUrl"], wait_until="networkidle")
        page.wait_for_timeout(700)
        overview_txt = page.locator("body").inner_text()
        report["checks"]["overviewPopulated"] = {
            "ok": "UI-021 exec reverify" in overview_txt or "run" in overview_txt.lower(),
            "sample": overview_txt[:250],
        }

        page.goto(fx["myTestsUrl"], wait_until="networkidle")
        page.wait_for_timeout(700)
        my_txt = page.locator("body").inner_text()
        report["checks"]["myTestsReachable"] = {
            "ok": page.url.find("my-tests") >= 0 and len(my_txt) > 40,
            "sample": my_txt[:200],
        }
        page.close()

        # ----- 390: Back to tests sticks -----
        page = browser.new_page(viewport={"width": 390, "height": 844})
        login(page)
        page.goto(f"{fx['runUrl']}?testId={t[0]['id']}", wait_until="networkidle")
        page.wait_for_timeout(800)
        back = page.get_by_role("button", name=re.compile(r"back to tests", re.I))
        report["checks"]["backToTestsNamed390"] = {"ok": back.count() > 0}
        if back.count():
            back.first.click()
            page.wait_for_timeout(2500)
        tid = test_id_from_url(page.url)
        report["checks"]["backToTestsSticks390"] = {
            "ok": tid is None,
            "url": page.url,
            "overflowX": page_overflow(page),
        }
        if tid is not None:
            report["defects"].append(
                {
                    "id": "UI-021-back-to-tests-bounce",
                    "expect": "390 Back to tests leaves URL without testId and stays on list",
                    "actual": page.url,
                }
            )
        # plain run URL without testId should not auto-seed
        page.goto(fx["runUrl"], wait_until="networkidle")
        page.wait_for_timeout(2000)
        tid2 = test_id_from_url(page.url)
        report["checks"]["mobileNoAutoSeed"] = {"ok": tid2 is None, "url": page.url}
        if tid2 is not None:
            report["defects"].append(
                {
                    "id": "UI-021-mobile-auto-seed",
                    "expect": "390 /runs/:id without testId does not auto-append testId",
                    "actual": page.url,
                }
            )
        page.screenshot(path=str(OUT / "ui-021-reverify-back-tests-390x844.png"), full_page=False)
        page.close()
        browser.close()

    check_vals = [bool(v.get("ok")) if isinstance(v, dict) else bool(v) for v in report["checks"].values()]
    report["execPathOk"] = all(check_vals) if check_vals else False
    report["newContractDefects"] = report["defects"]
    report["canCompleteUi021"] = False
    report["allOkForThisPass"] = report["execPathOk"] and len(report["defects"]) == 0
    out = OUT / "ui-021-exec-reverify.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    if not report["allOkForThisPass"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
