# Webwright Automation Generator API Spec

Last aligned: 2026-05-30

This document defines the contracts exposed by `webwright-automation-generator`. The first version is primarily a CLI and file-contract tool, not a hosted SaaS service.

## CLI

### `wag init`

Creates a generated automation project.

```bash
wag init \
  --template python-playwright \
  --output ./checkout-automation \
  --testrail-url https://qa.example.com \
  --project-id 12
```

Outputs:

- project scaffold
- `testrail.config.yaml`
- empty `testrail.mapping.yaml`
- sample `.env.example`
- reporter setup

### `wag fetch`

Fetches cases from `testrail-clone`.

```bash
wag fetch \
  --project-id 12 \
  --suite-id 5 \
  --filter "automation=manual,label:smoke" \
  --output .wag/cases.json
```

### `wag generate`

Runs Webwright and generates structured automation code.

```bash
wag generate \
  --cases .wag/cases.json \
  --project ./checkout-automation \
  --mode explore-and-normalize
```

Modes:

| Mode | Meaning |
|------|---------|
| `explore` | Webwright raw run only |
| `extract` | raw script to action list |
| `normalize` | action list to DSL |
| `generate-code` | DSL to structured code |
| `explore-and-normalize` | full generation pipeline |

### `wag sync`

Updates an existing generated project.

```bash
wag sync \
  --project ./checkout-automation \
  --case-id 101
```

### `wag verify`

Runs generated tests without LLM.

```bash
wag verify \
  --project ./checkout-automation \
  --case-id 101 \
  --repeat 2
```

### `wag upload-results`

Uploads generated project results to `testrail-clone`.

```bash
wag upload-results \
  --project ./checkout-automation \
  --run-id 5001 \
  --results .wag/results.json
```

## Config Files

### `testrail.config.yaml`

```yaml
schemaVersion: 1
testrailClone:
  baseUrl: "https://qa.example.com"
  projectId: "12"
  tokenEnv: "QA_RAIL_AUTOMATION_TOKEN"
automation:
  provider: "webwright-generator"
  defaultRunName: "Generated automation"
  resultUploadPath: "/api/automation/results/bulk"
runtime:
  baseUrlEnv: "APP_BASE_URL"
  browser: "chromium"
  headless: true
```

### `testrail.mapping.yaml`

```yaml
schemaVersion: 1
mappings:
  - caseId: "101"
    automationKey: "checkout.saved_card"
    testPath: "tests/test_checkout_saved_card.py"
    flowPath: "flows/checkout.py"
    normalizedFlow: "artifacts/normalized/checkout.saved_card.json"
    source:
      type: "testrail-clone"
      projectId: "12"
      caseVersion: "2026-05-30T10:00:00Z"
```

### `.wag/generator.config.yaml`

```yaml
schemaVersion: 1
webwright:
  repo: "https://github.com/microsoft/Webwright"
  commit: "abcdef0"
  configFiles:
    - "configs/base.yaml"
    - "configs/model_openai.yaml"
generation:
  template: "python-playwright"
  preserveManualCode: true
  generatedBlockMarkers: true
normalization:
  selectorRegistry: "config/selectors.yaml"
  helperRegistry: "config/helpers.yaml"
security:
  allowedHosts:
    - "staging.example.com"
  redactPatterns:
    - "token"
    - "cookie"
    - "password"
```

## Intermediate Schemas

### Case model

```json
{
  "schemaVersion": 1,
  "caseId": "101",
  "projectId": "12",
  "automationKey": null,
  "title": "Checkout with saved card",
  "preconditions": "User has a saved Visa card",
  "mission": "Verify saved-card checkout",
  "goals": ["Complete checkout"],
  "aiInput": "Use the saved Visa card.",
  "aiExpectedOutput": "Order confirmation is visible.",
  "steps": [
    {
      "order": 1,
      "content": "Log in as a standard user",
      "expectedResult": "Dashboard opens"
    }
  ]
}
```

### Action list

```json
{
  "schemaVersion": 1,
  "caseId": "101",
  "sourceArtifacts": {
    "rawScript": "artifacts/raw/case-101/final_script.py",
    "trajectory": "artifacts/raw/case-101/trajectory.json"
  },
  "actions": [
    { "order": 1, "type": "login", "target": "standard_user" },
    { "order": 2, "type": "goto", "target": "/checkout" },
    { "order": 3, "type": "click", "target": "saved_card.visa" },
    { "order": 4, "type": "assertText", "target": "confirmation", "value": "Order confirmation" }
  ],
  "warnings": [
    { "code": "UNSTABLE_SELECTOR", "message": "Generated selector used nth-child." }
  ]
}
```

### Normalized flow

```json
{
  "schemaVersion": 1,
  "kind": "normalized-flow",
  "caseId": "101",
  "automationKey": "checkout.saved_card",
  "flow": "checkout.saved_card",
  "steps": [
    { "action": "login", "as": "standard_user" },
    { "action": "checkout.open" },
    { "action": "checkout.payWithSavedCard", "card": "visa" },
    { "action": "assertText", "target": "confirmation", "text": "Order confirmation" }
  ]
}
```

## testrail-clone Integration

### Read cases

Preferred source:

- `GET /api/v2/get_cases/{project_id}`
- or canonical project case endpoints if available for the current app route.

Generator should store the fetched case snapshot in `.wag/cases.json` for reproducibility.

### Update automation mapping

When a generated test is promoted:

```http
PATCH /api/projects/{projectId}/automation/mappings/{caseId}
Authorization: Bearer <project-api-token>
Content-Type: application/json

{ "automationKey": "checkout.saved_card" }
```

### Upload results

Generated project reporter posts:

```http
POST /api/automation/results/bulk
Authorization: Bearer <project-api-token>
Content-Type: application/json
```

Payload:

```json
{
  "runId": "5001",
  "ci_provider": "webwright-generator",
  "branch": "main",
  "commit_sha": "abc123",
  "results": [
    {
      "case_id": 101,
      "status": "passed",
      "comment": "Generated automation: checkout.saved_card",
      "elapsed": "21s",
      "metadata": {
        "generator": {
          "version": "0.1.0",
          "automationKey": "checkout.saved_card",
          "normalizedFlow": "checkout.saved_card:v1",
          "webwrightCommit": "abcdef0"
        }
      },
      "stepResults": [
        { "stepOrder": 1, "status": "passed", "actualResult": "Logged in as standard user" }
      ]
    }
  ]
}
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | success |
| `1` | validation or generation failed |
| `2` | Webwright run failed |
| `3` | verification failed |
| `4` | API/auth/config error |
| `5` | unsafe artifact or redaction failure |

## Versioning

- Every file contract includes `schemaVersion`.
- Generated project includes generator version in `testrail.mapping.yaml`.
- Webwright upstream commit is recorded in artifacts and result metadata.
- Breaking schema changes increment major schema version.
