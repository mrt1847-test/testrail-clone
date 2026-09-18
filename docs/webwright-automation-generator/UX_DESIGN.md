# Webwright Automation Generator UX Design

Last aligned: 2026-05-30

`webwright-automation-generator` is primarily a developer/automation engineer tool. Its UX should optimize for reviewable diffs, explicit decisions, and safe generation, not flashy no-code magic.

## UX Principles

1. **Make generated changes reviewable.**
   Every generation should end with a concise diff summary and file list.

2. **Separate raw evidence from promoted automation.**
   Raw Webwright output is useful for debugging but should not look like the final deliverable.

3. **Ask before overwriting manual code.**
   Generated blocks may be replaced; user-owned code must be preserved.

4. **Prefer explicit mappings.**
   `caseId`, `automationKey`, `testPath`, and `flowPath` should always be visible in summaries.

5. **Show risk early.**
   Unstable selectors, secrets, production host access, and non-idempotent actions should be visible before promotion.

## Primary CLI Flow

### Init

```text
$ wag init --template python-playwright --output checkout-automation

Created checkout-automation
  pyproject.toml
  tests/
  flows/
  pages/
  reporters/
  testrail.config.yaml
  testrail.mapping.yaml

Next:
  1. Set QA_RAIL_AUTOMATION_TOKEN
  2. Set APP_BASE_URL
  3. Run wag fetch --project checkout-automation
```

### Fetch

```text
$ wag fetch --project checkout-automation --filter "label:smoke automation:manual"

Fetched 12 cases from project 12
  8 have aiInput
  4 need generated prompts from steps
  0 already mapped

Wrote .wag/cases.json
```

### Generate

```text
$ wag generate --project checkout-automation --case-id 101

Case 101: Checkout with saved card
  Webwright run: passed
  Raw actions: 14
  Normalized actions: 4
  New helpers: 1
  Reused helpers: login_as, CheckoutPage

Files changed:
  + tests/test_checkout_saved_card.py
  + flows/checkout.py
  + pages/checkout_page.py
  + artifacts/normalized/checkout.saved_card.json
  ~ testrail.mapping.yaml

Warnings:
  ! Selector "button:nth-child(3)" was replaced with suggested data-testid.
  ! Raw artifact contains screenshots; retention: 30 days.

Run:
  wag verify --project checkout-automation --case-id 101 --repeat 2
```

### Verify

```text
$ wag verify --project checkout-automation --case-id 101 --repeat 2

Verification passed
  attempt 1: 19s
  attempt 2: 18s

Eligible for promotion:
  automationKey: checkout.saved_card
```

### Promote

```text
$ wag promote --project checkout-automation --case-id 101

Promoted case 101
  automationKey: checkout.saved_card
  test: tests/test_checkout_saved_card.py
  flow: artifacts/normalized/checkout.saved_card.json

Updated testrail-clone mapping.
```

## Review Artifacts

Generator should write a local review bundle:

```text
.wag/reviews/case-101/
  summary.md
  raw_actions.json
  normalized_flow.json
  screenshots/
  generated_diff.patch
  warnings.json
```

`summary.md` should include:

- case title and ID
- automationKey candidate
- raw action count
- normalized step count
- reused helpers
- new helpers
- verification result
- warnings and blockers

## Optional Local Review UI

The local UI is optional and should be static or lightweight. It is not a replacement for git review.

Views:

| View | Purpose |
|------|---------|
| Case Summary | title, steps, expected result, automationKey candidate |
| Raw Run | trajectory, screenshots, raw script link |
| Action List | extracted action table with confidence/warnings |
| Normalized Flow | DSL steps and helper mapping |
| Code Diff | generated file diff |
| Verification | rerun attempts and failure logs |

Layout:

```text
Case header
Tabs: Summary | Raw | Actions | Normalized | Diff | Verification
Right rail: warnings, promotion readiness, commands
```

Do not hide warnings behind collapses by default. The main user needs to see whether generated automation is safe to promote.

## Generated Project Developer UX

Generated code should feel like a normal automation project.

Good generated test:

```python
def test_checkout_saved_card(ctx):
    login_as(ctx, "standard_user")
    checkout = CheckoutPage(ctx.page)
    checkout.open()
    checkout.pay_with_saved_card("visa")
    ConfirmationPage(ctx.page).expect_order_confirmation()
```

Bad generated test:

```python
def test_checkout_saved_card(page):
    page.goto("...")
    page.fill("input:nth-child(1)", "...")
    page.fill("input:nth-child(2)", "...")
    page.click("button:nth-child(3)")
    page.wait_for_timeout(5000)
```

Developer-facing rules:

- Test files should be short.
- Selectors should live in page objects or selector registry.
- Secrets should come from env vars or fixture refs.
- Flow helpers should be named in domain language.
- Generated blocks should be marked when regeneration may overwrite them.

## Error UX

Error messages should name the failing layer.

| Error | Message style |
|-------|---------------|
| `CONFIG_MISSING_TOKEN` | `QA_RAIL_AUTOMATION_TOKEN is not set. Set it or pass --token-env.` |
| `WEBWRIGHT_RUN_FAILED` | `Webwright failed before producing final_script.py. See artifacts/raw/case-101/stderr.log.` |
| `UNSAFE_ARTIFACT` | `Generated artifact contains a possible secret. Redaction failed; promotion blocked.` |
| `UNSTABLE_SELECTOR` | `Selector uses nth-child and no stable replacement was found.` |
| `VERIFY_FAILED` | `Structured test failed on attempt 2. Promotion is blocked.` |

## Promotion Readiness States

| State | Meaning |
|-------|---------|
| `raw_only` | Webwright ran but no normalized flow exists |
| `needs_review` | normalized flow exists, human review required |
| `blocked` | unsafe artifact or verification failure |
| `verified` | structured test passed required reruns |
| `promoted` | automationKey mapping updated and project files committed |

## Non-goals

- Do not present raw Webwright script as production-ready automation.
- Do not build a large hosted UI before CLI workflows are stable.
- Do not hide generated file changes from git.
- Do not auto-promote tests that have not passed LLM-free verification.
