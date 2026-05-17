# CI And Compatibility Examples

Last aligned: 2026-05-17

These examples are copy-paste starting points for two supported integration paths:

- automation result upload through the canonical automation API
- TestRail-style compatibility calls through `/api/v2`

Replace placeholder values before use. Automation upload endpoints use a project API token with `automation:write`. `/api/v2` mutation examples use a normal user JWT with project mutation permission.

## Environment Variables

```bash
export QA_RAIL_URL="https://qa-rail.example.com"
export QA_RAIL_PROJECT_ID="1"
export QA_RAIL_SUITE_ID="1"
export QA_RAIL_RUN_ID="5001"
export QA_RAIL_AUTOMATION_TOKEN="trc_project_token_with_automation_write"
export QA_RAIL_USER_TOKEN="user_jwt_for_v2_mutations"
```

## Automation Upload

The bulk upload endpoint accepts `case_id` or `caseId` per result. It records CI metadata from the top-level request and lets per-result metadata override individual fields.

```bash
curl -sS -X POST "$QA_RAIL_URL/api/automation/results/bulk" \
  -H "Authorization: Bearer $QA_RAIL_AUTOMATION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "runId": "'$QA_RAIL_RUN_ID'",
    "atomic": false,
    "ci_provider": "local",
    "ci_build_id": "manual-001",
    "branch": "main",
    "commit_sha": "0000000",
    "results": [
      {
        "case_id": 101,
        "status": "passed",
        "comment": "Playwright checkout passed",
        "elapsed": "12s",
        "version": "manual-001"
      },
      {
        "case_id": 102,
        "status": "failed",
        "comment": "Cart API returned 500",
        "elapsed": "8s",
        "version": "manual-001",
        "defects": ["JIRA-777"],
        "stepResults": [
          { "stepOrder": 1, "status": "passed", "actualResult": "Opened checkout" },
          { "stepOrder": 2, "status": "failed", "actualResult": "POST /cart returned 500" }
        ]
      }
    ]
  }'
```

Use `atomic: true` when the CI job should reject the whole batch if any row cannot be saved. Use `atomic: false` when a partial upload with per-row failures is preferable.

## GitHub Actions

This job uploads a generated `qa-rail-results.json` artifact after tests finish. Keep the token in repository or organization secrets.

```yaml
name: e2e

on:
  workflow_dispatch:
  push:
    branches: [main]

jobs:
  playwright:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm run test:e2e
      - name: Upload QA Rail results
        if: always()
        env:
          QA_RAIL_URL: ${{ vars.QA_RAIL_URL }}
          QA_RAIL_RUN_ID: ${{ vars.QA_RAIL_RUN_ID }}
          QA_RAIL_AUTOMATION_TOKEN: ${{ secrets.QA_RAIL_AUTOMATION_TOKEN }}
        run: |
          node scripts/qa-rail-results.js > qa-rail-results.json
          jq \
            --arg runId "$QA_RAIL_RUN_ID" \
            --arg provider "github-actions" \
            --arg buildId "$GITHUB_RUN_ID" \
            --arg jobUrl "$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID" \
            --arg sha "$GITHUB_SHA" \
            --arg branch "${GITHUB_REF_NAME:-main}" \
            '. + {
              runId: $runId,
              ci_provider: $provider,
              ci_build_id: $buildId,
              job_url: $jobUrl,
              commit_sha: $sha,
              branch: $branch,
              attempt: (env.GITHUB_RUN_ATTEMPT | tonumber)
            }' qa-rail-results.json > qa-rail-upload.json
          curl -sS --fail-with-body -X POST "$QA_RAIL_URL/api/automation/results/bulk" \
            -H "Authorization: Bearer $QA_RAIL_AUTOMATION_TOKEN" \
            -H "Content-Type: application/json" \
            --data-binary @qa-rail-upload.json
```

Expected `qa-rail-results.json` shape:

```json
{
  "atomic": false,
  "results": [
    {
      "case_id": 101,
      "status": "passed",
      "comment": "checkout.spec.ts passed",
      "elapsed": "12s"
    }
  ]
}
```

## GitLab CI

```yaml
e2e:
  image: node:22
  stage: test
  script:
    - npm ci
    - npm run test:e2e || TEST_EXIT=$?
    - node scripts/qa-rail-results.js > qa-rail-results.json
    - >
      jq
      --arg runId "$QA_RAIL_RUN_ID"
      --arg provider "gitlab-ci"
      --arg buildId "$CI_PIPELINE_ID"
      --arg jobUrl "$CI_JOB_URL"
      --arg sha "$CI_COMMIT_SHA"
      --arg branch "$CI_COMMIT_REF_NAME"
      '. + {
        runId: $runId,
        ci_provider: $provider,
        ci_build_id: $buildId,
        job_url: $jobUrl,
        commit_sha: $sha,
        branch: $branch
      }' qa-rail-results.json > qa-rail-upload.json
    - >
      curl -sS --fail-with-body -X POST "$QA_RAIL_URL/api/automation/results/bulk"
      -H "Authorization: Bearer $QA_RAIL_AUTOMATION_TOKEN"
      -H "Content-Type: application/json"
      --data-binary @qa-rail-upload.json
    - exit ${TEST_EXIT:-0}
```

## Jenkins Pipeline

```groovy
pipeline {
  agent any
  environment {
    QA_RAIL_URL = credentials('qa-rail-url')
    QA_RAIL_RUN_ID = credentials('qa-rail-run-id')
    QA_RAIL_AUTOMATION_TOKEN = credentials('qa-rail-automation-token')
  }
  stages {
    stage('test') {
      steps {
        sh 'npm ci'
        sh 'npm run test:e2e || echo $? > .test-exit'
        sh 'node scripts/qa-rail-results.js > qa-rail-results.json'
      }
      post {
        always {
          sh '''
            jq \
              --arg runId "$QA_RAIL_RUN_ID" \
              --arg provider "jenkins" \
              --arg buildId "$BUILD_TAG" \
              --arg jobUrl "$BUILD_URL" \
              --arg sha "${GIT_COMMIT:-}" \
              --arg branch "${BRANCH_NAME:-main}" \
              '. + {
                runId: $runId,
                ci_provider: $provider,
                ci_build_id: $buildId,
                job_url: $jobUrl,
                commit_sha: $sha,
                branch: $branch
              }' qa-rail-results.json > qa-rail-upload.json
            curl -sS --fail-with-body -X POST "$QA_RAIL_URL/api/automation/results/bulk" \
              -H "Authorization: Bearer $QA_RAIL_AUTOMATION_TOKEN" \
              -H "Content-Type: application/json" \
              --data-binary @qa-rail-upload.json
          '''
        }
      }
    }
  }
}
```

## Create An Automation Run

Use this when CI owns run creation instead of uploading into an existing run.

```bash
curl -sS -X POST "$QA_RAIL_URL/api/automation/runs" \
  -H "Authorization: Bearer $QA_RAIL_AUTOMATION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "'$QA_RAIL_PROJECT_ID'",
    "suiteId": "'$QA_RAIL_SUITE_ID'",
    "name": "CI regression '"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
    "includeAll": true,
    "environment": "ci"
  }'
```

The response includes the created run and test instances. Use the returned run id as `runId` for `/api/automation/results/bulk`.

## Compatibility Examples

These `/api/v2` examples use TestRail-style endpoint names and payload fields, while still reusing this product's permissions and domain rules.

### Discover Supported Endpoints

```bash
curl -sS "$QA_RAIL_URL/api/v2" | jq
```

### List Suites, Sections, Cases, And Runs

```bash
curl -sS "$QA_RAIL_URL/api/v2/get_suites/$QA_RAIL_PROJECT_ID" | jq

curl -sS "$QA_RAIL_URL/api/v2/get_sections/$QA_RAIL_PROJECT_ID?suite_id=$QA_RAIL_SUITE_ID" | jq

curl -sS "$QA_RAIL_URL/api/v2/get_cases/$QA_RAIL_PROJECT_ID?suite_id=$QA_RAIL_SUITE_ID&limit=50&offset=0" | jq '.cases'

curl -sS "$QA_RAIL_URL/api/v2/get_runs/$QA_RAIL_PROJECT_ID?limit=25&offset=0" | jq '.runs'
```

High-traffic list routes return a TestRail-style envelope:

```json
{
  "offset": 0,
  "limit": 50,
  "size": 1,
  "_links": { "next": null, "prev": null },
  "cases": [{ "id": 101, "title": "Guest checkout" }]
}
```

### Add A Case

```bash
curl -sS -X POST "$QA_RAIL_URL/api/v2/add_case/$SECTION_ID" \
  -H "Authorization: Bearer $QA_RAIL_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Guest can check out",
    "priority": "high",
    "caseType": "regression",
    "custom_steps": "Open cart\nSubmit checkout"
  }'
```

### Create A Run And Post Results

```bash
RUN_ID="$(
  curl -sS -X POST "$QA_RAIL_URL/api/v2/add_run/$QA_RAIL_PROJECT_ID" \
    -H "Authorization: Bearer $QA_RAIL_USER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "suite_id": "'$QA_RAIL_SUITE_ID'",
      "name": "Compatibility smoke",
      "include_all": true
    }' | jq -r '.id'
)"

curl -sS -X POST "$QA_RAIL_URL/api/v2/add_results_for_cases/$RUN_ID" \
  -H "Authorization: Bearer $QA_RAIL_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "results": [
      { "case_id": 101, "status_id": 1, "comment": "passed in compatibility smoke", "elapsed": "5s" },
      { "case_id": 102, "status_id": 5, "comment": "failed in compatibility smoke", "defects": "JIRA-777" }
    ]
  }'
```

Status id mapping:

| `status_id` | Internal status |
|-------------|-----------------|
| `1` | `passed` |
| `2` | `blocked` |
| `3` | `untested` |
| `4` | `retest` |
| `5` | `failed` |

### Read Tests And Results

```bash
curl -sS "$QA_RAIL_URL/api/v2/get_tests/$RUN_ID?limit=250&offset=0" | jq '.tests'
curl -sS "$QA_RAIL_URL/api/v2/get_results_for_run/$RUN_ID?limit=250&offset=0" | jq '.results'
```

### Close A Run

```bash
curl -sS -X POST "$QA_RAIL_URL/api/v2/close_run/$RUN_ID" \
  -H "Authorization: Bearer $QA_RAIL_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `401 missing automation token` | No bearer token on automation upload | Send `Authorization: Bearer <token>` |
| `403 missing scope automation:write` | Token lacks write scope | Create a project API token with `automation:write` |
| `404 run not found` | Token project does not match run project, or run id is wrong | Verify run id and token project |
| `CASE_NOT_FOUND_IN_RUN` row failure | Uploaded case is not part of the target run | Use include-all runs, add the case to the run, or upload to the correct run |
| `409` on `/api/v2/add_suite` | Project type allows only one master suite | Use a multi-suite project, or baseline creation on baseline projects |
| Expecting `429` / `Retry-After` like TestRail Cloud | This server does not enforce Cloud rate limits | See [API_SPEC.md — API Rate Limits](./API_SPEC.md#api-rate-limits); use bulk endpoints and pagination; add proxy limits only if you operate them |
