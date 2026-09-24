"""Live-verify UI-064 narrow Run status legend readability."""
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
LABELS = ("Passed", "Failed", "Blocked", "Retest", "Untested", "All statuses")


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


def legend_metrics(page):
    section = page.get_by_role("region", name="Run-wide status")
    section.wait_for(state="visible", timeout=20000)
    rows = []
    for label in LABELS:
        pattern = (
            re.compile(r"All statuses", re.I)
            if label == "All statuses"
            else re.compile(rf"{re.escape(label)},", re.I)
        )
        target = section.get_by_role("button", name=pattern)
        target.wait_for(state="visible", timeout=15000)
        box = target.bounding_box()
        truncated = target.evaluate(
            """el => {
              const labelEl = el.querySelector('span.min-w-0');
              if (!labelEl) return { text: '', overflow: true, truncStyle: true, clientWidth: 0, scrollWidth: 0 };
              const text = (labelEl.textContent || '').trim();
              const overflow = labelEl.scrollWidth - labelEl.clientWidth > 1;
              const style = getComputedStyle(labelEl);
              const truncStyle = style.textOverflow === 'ellipsis';
              return { text, overflow, truncStyle, clientWidth: labelEl.clientWidth, scrollWidth: labelEl.scrollWidth };
            }"""
        )
        rows.append(
            {
                "label": label,
                "visibleText": truncated.get("text"),
                "overflow": truncated.get("overflow"),
                "truncStyle": truncated.get("truncStyle"),
                "clientWidth": truncated.get("clientWidth"),
                "scrollWidth": truncated.get("scrollWidth"),
                "box": box,
            }
        )
    return rows


def page_overflow(page):
    return page.evaluate(
        """() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
        })"""
    )


def first_row_in_viewport(page, viewport_h):
    row = page.locator("table tbody tr").filter(has_text=re.compile(r"C\d+")).first
    if row.count() == 0:
        row = page.get_by_role("row").filter(has_text=re.compile(r"Valid tester|Case 01|C1")).first
    box = row.bounding_box()
    if not box:
        return {"ok": False, "reason": "no-row"}
    top = box["y"]
    bottom = box["y"] + box["height"]
    return {
        "ok": top < viewport_h and bottom > 0 and top >= 0,
        "top": top,
        "bottom": bottom,
        "viewport": viewport_h,
    }


def counts_from_instances(instances):
    counts = {"passed": 0, "failed": 0, "blocked": 0, "retest": 0, "untested": 0}
    for inst in instances:
        status = (inst.get("status") or "untested").lower()
        if status not in counts:
            status = "untested"
        counts[status] += 1
    return counts


def load_run_instances(token, run_id):
    detail = api("GET", f"/api/runs/{run_id}", token)
    data = detail.get("data") or detail
    return data.get("instances") or []


def seed_three(token):
    stamp = int(time.time())
    project = api("POST", "/api/projects", token, {"name": f"UI-064 Three {stamp}"})["data"]
    pid = project["id"]
    suite_id = next(s["id"] for s in api("GET", f"/api/projects/{pid}/suites", token)["data"] if s.get("isMaster"))
    auth = api("POST", f"/api/suites/{suite_id}/sections", token, {"name": "Authentication"})["data"]
    login_sec = api(
        "POST",
        f"/api/suites/{suite_id}/sections",
        token,
        {"name": "Login", "parentId": auth["id"]},
    )["data"]
    titles = [
        "Valid tester can sign in",
        "Invalid password remains on login",
        "Sign out removes session",
    ]
    cases = [
        api("POST", f"/api/sections/{login_sec['id']}/cases", token, {"title": t, "priority": "high"})["data"]
        for t in titles
    ]
    created = api(
        "POST",
        f"/api/projects/{pid}/runs",
        token,
        {
            "name": "Resume verification",
            "suiteId": int(suite_id),
            "includeAll": False,
            "caseIds": [int(c["id"]) for c in cases],
        },
    )
    run = created["run"]
    instances = list(created.get("instances") or [])
    if not instances:
        instances = load_run_instances(token, run["id"])
    by_case = {int(i.get("caseId") or i.get("case", {}).get("id")): i for i in instances}
    ordered = [by_case[int(c["id"])] for c in cases]
    api("POST", f"/api/tests/{ordered[0]['id']}/results", token, {"status": "passed", "comment": "ok"})
    api(
        "POST",
        f"/api/tests/{ordered[1]['id']}/results",
        token,
        {"status": "failed", "comment": "bad password stayed"},
    )
    refreshed = load_run_instances(token, run["id"])
    by_id = {str(i["id"]): i for i in refreshed}
    ordered = [by_id.get(str(i["id"]), i) for i in ordered]
    return {
        "projectId": pid,
        "runId": run["id"],
        "counts": counts_from_instances(refreshed),
        "instances": ordered,
    }


def seed_fifty_nine(token):
    stamp = int(time.time())
    project = api("POST", "/api/projects", token, {"name": f"UI-064 FiftyNine {stamp}"})["data"]
    pid = project["id"]
    suite_id = next(s["id"] for s in api("GET", f"/api/projects/{pid}/suites", token)["data"] if s.get("isMaster"))
    section = api("POST", f"/api/suites/{suite_id}/sections", token, {"name": "Suite"})["data"]
    case_ids = []
    for i in range(59):
        c = api(
            "POST",
            f"/api/sections/{section['id']}/cases",
            token,
            {"title": f"Case {i+1:02d}", "priority": "medium"},
        )["data"]
        case_ids.append(int(c["id"]))
    created = api(
        "POST",
        f"/api/projects/{pid}/runs",
        token,
        {
            "name": "UI-040 Nightly 59",
            "suiteId": int(suite_id),
            "includeAll": False,
            "caseIds": case_ids,
        },
    )
    run = created["run"]
    instances = list(created.get("instances") or [])
    if not instances:
        instances = load_run_instances(token, run["id"])
    plan = (["passed"] * 43) + (["failed"] * 2) + (["blocked"] * 2) + (["retest"] * 3)
    for inst, status in zip(instances, plan):
        api("POST", f"/api/tests/{inst['id']}/results", token, {"status": status, "comment": status})
    refreshed = load_run_instances(token, run["id"])
    return {"projectId": pid, "runId": run["id"], "counts": counts_from_instances(refreshed)}


def open_run(page, url, w, h, close_detail=False):
    page.set_viewport_size({"width": w, "height": h})
    target = url
    if close_detail and "testId=" in target:
        target = re.sub(r"([?&])testId=\d+&?", r"\1", target).rstrip("?&")
    page.goto(target, wait_until="networkidle")
    page.wait_for_timeout(800)
    page.get_by_role("heading", name=re.compile(r"Resume verification|UI-040 Nightly 59", re.I)).wait_for(
        state="visible", timeout=20000
    )
    if close_detail:
        if "testId=" in page.url:
            cleaned = re.sub(r"([?&])testId=\d+&?", r"\1", page.url).rstrip("?&")
            page.goto(cleaned, wait_until="networkidle")
            page.wait_for_timeout(500)
        page.keyboard.press("Escape")
        page.wait_for_timeout(200)
    page.evaluate("() => window.scrollTo(0, 0)")
    page.wait_for_timeout(200)
    page.get_by_role("region", name="Run-wide status").wait_for(state="visible", timeout=20000)


def capture(page, path, w, h, url, close_detail=False):
    open_run(page, url, w, h, close_detail=close_detail)
    page.screenshot(path=str(path), full_page=False)
    metrics = {
        "legend": legend_metrics(page),
        "overflow": page_overflow(page),
        "firstRow": first_row_in_viewport(page, h),
        "url": page.url,
    }
    labels_ok = all(
        m["visibleText"] == label and not m["overflow"] and not m["truncStyle"]
        for label, m in zip(LABELS, metrics["legend"])
    )
    metrics["labelsFullyVisible"] = labels_ok
    return metrics


def keyboard_filter(page, url):
    open_run(page, url, 390, 844, close_detail=True)
    section = page.get_by_role("region", name="Run-wide status")
    failed = section.get_by_role("button", name=re.compile(r"Failed,", re.I))
    failed.focus()
    page.keyboard.press("Enter")
    page.wait_for_timeout(400)
    pressed = failed.get_attribute("aria-pressed")
    hint = section.locator("p").filter(has_text=re.compile(r"Showing Failed", re.I))
    all_btn = section.get_by_role("button", name=re.compile(r"All statuses", re.I))
    all_btn.focus()
    page.keyboard.press("Space")
    page.wait_for_timeout(400)
    cleared = all_btn.get_attribute("aria-pressed")
    return {
        "failedPressed": pressed,
        "hintVisible": hint.count() > 0,
        "allPressedAfterClear": cleared,
        "urlAfter": page.url,
    }


def save_result_and_recount(page, token, run_id, instance_id, url):
    before_counts = counts_from_instances(load_run_instances(token, run_id))
    api("POST", f"/api/tests/{instance_id}/results", token, {"status": "blocked", "comment": "ui064"})
    open_run(page, url, 390, 844, close_detail=True)
    after_counts = counts_from_instances(load_run_instances(token, run_id))
    section = page.get_by_role("region", name="Run-wide status")
    blocked_text = section.get_by_role("button", name=re.compile(r"Blocked,", re.I)).inner_text()
    return {"before": before_counts, "after": after_counts, "blockedButtonText": blocked_text}


def main():
    token = api("POST", "/api/auth/login", None, {"email": "admin@example.com", "password": "password"})["token"]
    three = seed_three(token)
    three_url = f"{WEB}/projects/{three['projectId']}/runs/{three['runId']}"
    # Prove seeded run still resolvable before opening the browser (guards in-memory restarts)
    assert load_run_instances(token, three["runId"]), "three-fixture instances missing"

    report = {
        "three": {"seed": three},
        "fiftyNine": None,
        "captures": {},
        "keyboard": None,
        "aggregateAfterSave": None,
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        login(page)

        report["captures"]["after_390_three"] = capture(
            page, OUT / "ui-064-after-390x844.png", 390, 844, three_url, close_detail=True
        )
        report["captures"]["after_1280_three"] = capture(
            page, OUT / "ui-064-after-1280x720.png", 1280, 720, three_url, close_detail=False
        )
        report["captures"]["after_1440_three"] = capture(
            page, OUT / "ui-064-after-1440x1000.png", 1440, 1000, three_url, close_detail=False
        )

        report["keyboard"] = keyboard_filter(page, three_url)
        c3 = three["instances"][2]["id"]
        report["aggregateAfterSave"] = save_result_and_recount(page, token, three["runId"], c3, three_url)

        fifty = seed_fifty_nine(token)
        fifty_url = f"{WEB}/projects/{fifty['projectId']}/runs/{fifty['runId']}"
        report["fiftyNine"] = {"seedCounts": fifty["counts"]}
        report["captures"]["after_390_59"] = capture(
            page, OUT / "ui-064-after-390x844-59.png", 390, 844, fifty_url, close_detail=True
        )
        report["captures"]["after_1280_59"] = capture(
            page, OUT / "ui-064-after-1280x720-59.png", 1280, 720, fifty_url, close_detail=False
        )

        browser.close()

    labels_ok = all(
        report["captures"][k]["labelsFullyVisible"]
        for k in ("after_390_three", "after_1280_three", "after_1440_three", "after_390_59", "after_1280_59")
    )
    overflow_ok = all(
        not report["captures"][k]["overflow"]["overflowX"]
        for k in ("after_390_three", "after_1280_three", "after_1440_three", "after_390_59", "after_1280_59")
    )
    first_row_ok = report["captures"]["after_390_three"]["firstRow"]["ok"]
    kb = report["keyboard"]
    keyboard_ok = kb["failedPressed"] == "true" and kb["allPressedAfterClear"] == "true"
    agg = report["aggregateAfterSave"]
    aggregate_ok = (
        agg
        and agg["before"]
        and agg["after"]
        and agg["after"].get("blocked", 0) == agg["before"].get("blocked", 0) + 1
        and agg["after"].get("untested", 0) == agg["before"].get("untested", 0) - 1
        and "Blocked" in agg["blockedButtonText"]
    )

    report["allOk"] = bool(labels_ok and overflow_ok and first_row_ok and keyboard_ok and aggregate_ok)
    report["checks"] = {
        "labelsOk": labels_ok,
        "overflowOk": overflow_ok,
        "firstRowOk": first_row_ok,
        "keyboardOk": keyboard_ok,
        "aggregateOk": aggregate_ok,
    }
    OUT.joinpath("ui-064-live-verify.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"allOk": report["allOk"], "checks": report["checks"]}, indent=2))
    if not report["allOk"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
