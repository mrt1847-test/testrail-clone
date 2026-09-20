"""Live-verify UI-063 Overview/Milestone count context after fixes."""
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
        raise RuntimeError(f"{method} {path} {r.status_code} {r.text[:500]}")
    return r.json() if r.text else None


token = api("POST", "/api/auth/login", None, {"email": "admin@example.com", "password": "password"})["token"]
project = api("POST", "/api/projects", token, {"name": f"UI-063 Verify {int(time.time())}"})["data"]
pid = project["id"]
suite_id = next(s["id"] for s in api("GET", f"/api/projects/{pid}/suites", token)["data"] if s.get("isMaster"))
section = api("POST", f"/api/suites/{suite_id}/sections", token, {"name": "Core"})["data"]
cases = [
    api("POST", f"/api/sections/{section['id']}/cases", token, {"title": title, "priority": "high"})["data"]
    for title in ("Login", "Checkout", "Pay")
]
case_ids = [int(c["id"]) for c in cases]
milestone = api("POST", f"/api/projects/{pid}/milestones", token, {"name": "Sprint 63"})["data"]
ms_id = milestone["id"]

created_a = api(
    "POST",
    f"/api/projects/{pid}/runs",
    token,
    {
        "name": "Alpha linked",
        "suiteId": int(suite_id),
        "includeAll": False,
        "caseIds": case_ids,
        "milestoneId": int(ms_id),
    },
)
run_a = created_a["run"]
inst_a = created_a.get("instances") or []
created_b = api(
    "POST",
    f"/api/projects/{pid}/runs",
    token,
    {"name": "Beta unlinked", "suiteId": int(suite_id), "includeAll": False, "caseIds": case_ids},
)
run_b = created_b["run"]
created_c = api(
    "POST",
    f"/api/projects/{pid}/runs",
    token,
    {
        "name": "Closed linked",
        "suiteId": int(suite_id),
        "includeAll": False,
        "caseIds": case_ids,
        "milestoneId": int(ms_id),
    },
)
run_c = created_c["run"]
api("POST", f"/api/runs/{run_c['id']}/close", token, {})
if inst_a:
    api("POST", f"/api/tests/{inst_a[0]['id']}/results", token, {"status": "passed", "comment": "ok"})

overview = api("GET", f"/api/projects/{pid}/overview", token)["data"]
ms_summary = api("GET", f"/api/projects/{pid}/reports/milestone-summary", token)["data"]
ms_item = next(i for i in ms_summary["items"] if str(i["milestoneId"]) == str(ms_id))
ms_runs = api("GET", f"/api/projects/{pid}/milestones/{ms_id}/runs", token)["data"]

# After status change: fail one Beta instance and re-check open-run remaining later via UI text
inst_b = created_b.get("instances") or []
if inst_b:
    api("POST", f"/api/tests/{inst_b[0]['id']}/results", token, {"status": "failed", "comment": "boom"})

results = {
    "overviewTotalCases": overview.get("totalCases"),
    "overviewActiveRuns": overview.get("activeRuns"),
    "milestoneOpenRuns": ms_item.get("openRunCount"),
    "milestoneRunCount": ms_item.get("runCount"),
    "milestoneTotalInstances": ms_item.get("total"),
    "milestoneLinkedRunNames": sorted([r.get("runName") or r.get("name") for r in ms_runs]),
    "apiOk": (
        overview.get("totalCases") == 3
        and overview.get("activeRuns") == 2
        and ms_item.get("openRunCount") == 1
        and ms_item.get("runCount") == 2
        and ms_item.get("total") == 6
        and len(ms_runs) == 2
    ),
}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    page.goto(f"{WEB}/login", wait_until="networkidle")
    page.locator('input[type="email"]').fill("admin@example.com")
    page.locator('input[type="password"]').fill("password")
    page.get_by_role("button", name=re.compile(r"sign in|log in|login", re.I)).click()
    page.wait_for_timeout(700)

    page.goto(f"{WEB}/projects/{pid}", wait_until="networkidle")
    page.wait_for_timeout(1300)
    body = page.evaluate("() => document.body.innerText")
    page.screenshot(path=str(OUT / "ui-063-after-1280x720-overview.png"), full_page=False)
    overflow = page.evaluate(
        "() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1"
    )

    # Expected open-run execution: Alpha 3 (1P) + Beta 3 (1F) = 6 total, 1P 1F 4 remaining
    has_cases = re.search(r"3 cases", body, re.I) is not None
    has_remaining = re.search(r"4 tests remaining across open runs", body, re.I) is not None
    has_passed_failed = re.search(r"1 passed\s*[·.]\s*1 failed", body, re.I) is not None
    has_linked_label = re.search(r"1 linked active run", body, re.I) is not None
    no_ambiguous = re.search(r"(?<![0-9] )\d+ remaining(?! across)", body) is None
    # Focus first Cases link
    cases_link = page.get_by_role("link", name=re.compile(r"^Cases$", re.I)).first
    cases_link.focus()
    cases_focused = page.evaluate(
        "() => { const el=document.activeElement; return !!(el && /cases/i.test(el.textContent||'') || (el && el.getAttribute('href')||'').includes('/cases')); }"
    )

    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(500)
    overflow_390 = page.evaluate(
        "() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1"
    )
    page.screenshot(path=str(OUT / "ui-063-after-390x844-overview.png"), full_page=False)

    page.set_viewport_size({"width": 1280, "height": 720})
    page.goto(f"{WEB}/projects/{pid}/milestones/{ms_id}", wait_until="networkidle")
    page.wait_for_timeout(1200)
    ms_body = page.evaluate("() => document.body.innerText")
    page.screenshot(path=str(OUT / "ui-063-after-1280x720-milestone.png"), full_page=False)
    linked_alpha = "Alpha linked" in ms_body
    linked_closed = "Closed linked" in ms_body
    no_beta = "Beta unlinked" not in ms_body
    can_open_run = page.get_by_role("link", name=re.compile(r"Alpha linked", re.I)).count() >= 1
    if can_open_run:
        page.get_by_role("link", name=re.compile(r"Alpha linked", re.I)).first.click()
        page.wait_for_timeout(900)
        on_run = "/runs/" in page.url

    results["ui"] = {
        "hasCases": has_cases,
        "hasRemaining": has_remaining,
        "hasPassedFailed": has_passed_failed,
        "hasLinkedLabel": has_linked_label,
        "overflow1280": overflow,
        "overflow390": overflow_390,
        "casesFocused": bool(cases_focused),
        "milestoneShowsAlpha": linked_alpha,
        "milestoneShowsClosed": linked_closed,
        "milestoneHidesBeta": no_beta,
        "navigatedToRun": bool(can_open_run and on_run),
        "overviewSnippet": [ln for ln in body.splitlines() if re.search(r"case|remaining|linked|passed|failed|Sprint|Alpha|Beta", ln, re.I)][:20],
        "milestoneSnippet": [ln for ln in ms_body.splitlines() if re.search(r"linked|open|Alpha|Closed|Beta|remaining|test", ln, re.I)][:25],
    }
    results["uiOk"] = all(
        [
            has_cases,
            has_remaining,
            has_passed_failed,
            has_linked_label,
            overflow is False,
            overflow_390 is False,
            linked_alpha,
            linked_closed,
            no_beta,
            can_open_run and on_run,
        ]
    )
    results["allOk"] = bool(results["apiOk"] and results["uiOk"])
    (OUT / "ui-063-live-verify.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    (OUT / "ui-063-fixture.json").write_text(
        json.dumps(
            {
                "projectId": pid,
                "milestoneId": ms_id,
                "runA": run_a["id"],
                "runB": run_b["id"],
                "runC": run_c["id"],
                "caseIds": case_ids,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(json.dumps(results, indent=2))
    browser.close()
