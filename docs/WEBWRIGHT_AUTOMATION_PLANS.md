# Webwright 자동화 연동 계획

Last aligned: 2026-05-30

테스트 케이스 관리와 노코드/로우코드 자동화를 [Microsoft Webwright](https://github.com/microsoft/Webwright)로 연결하기 위한 적용 계획서입니다. 최신 설계 결정은 `testrail-clone` 안에 Webwright 실행기를 넣는 방식이 아니라, 별도 **`webwright-automation-generator`** 도구가 테스트 자동화 프로젝트를 생성·갱신하고, 그 generated project가 `testrail-clone` API로 결과만 업로드하는 방식입니다.

Webwright는 2026-05-30 기준 공개 저장소에 릴리스가 없으므로, 초기 적용은 **고정 commit의 Git checkout / Docker image**를 기준으로 합니다.

## 결론

```text
testrail-clone
  -> case export / API
webwright-automation-generator
  -> Webwright raw run
  -> raw script action extraction
  -> normalized flow / structured script
  -> generated automation project 생성·갱신
generated automation project
  -> CI 실행
  -> POST /api/automation/results/bulk
testrail-clone
  -> result / coverage / report
```

핵심 원칙:

- `testrail-clone`은 테스트 관리 시스템으로 남는다.
- Webwright raw `final_script.py`는 최종 산출물이 아니라 구조화 재료다.
- 자동화 코드는 `generated automation project`가 소유한다.
- `testrail-clone`과 자동화 프로젝트의 연결은 `automationKey`, API token, bulk result upload로 제한한다.
- `webwright-automation-generator`는 프로젝트 생성·갱신 도구이지, 별도 테스트 관리 제품이 아니다.

상세 설계 문서:

- [webwright-automation-generator/README.md](./webwright-automation-generator/README.md)
- [webwright-automation-generator/PRODUCT_SPEC.md](./webwright-automation-generator/PRODUCT_SPEC.md)
- [webwright-automation-generator/ARCHITECTURE.md](./webwright-automation-generator/ARCHITECTURE.md)
- [webwright-automation-generator/API_SPEC.md](./webwright-automation-generator/API_SPEC.md)
- [webwright-automation-generator/UX_DESIGN.md](./webwright-automation-generator/UX_DESIGN.md)

관련 `testrail-clone` 문서:

- [ARCHITECTURE.md](./ARCHITECTURE.md) - 모듈러 모노리스 구조
- [DOMAIN_MODEL.md](./DOMAIN_MODEL.md) - TestCase / TestRun / TestResult 계층
- [API_SPEC.md](./API_SPEC.md) - automation API 계약
- [CI_AND_COMPATIBILITY_EXAMPLES.md](./CI_AND_COMPATIBILITY_EXAMPLES.md) - bulk result upload 예시
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - `automationKey`, `aiInput` 등 스키마

## 용어 구분

| 이름 | 역할 |
|------|------|
| Webwright | LLM이 Python Playwright 스크립트를 작성·실행하는 브라우저 에이전트 |
| `webwright-automation-generator` | Webwright raw run을 이용해 별도 테스트 자동화 프로젝트를 생성·갱신하는 도구 |
| generated automation project | 실제 테스트 코드, helper, fixture, reporter, CI 설정을 소유하는 자동화 프로젝트 |
| `testrail-clone` | TestCase, TestRun, TestResult, automation coverage, result upload API를 제공하는 테스트 관리 앱 |
| raw script | Webwright가 만든 자유형 `final_script.py` |
| action list | raw script/trajectory에서 추출한 `goto`, `click`, `fill`, `assert` 등 행동 목록 |
| normalized flow | action list를 도메인 action/helper 중심으로 정규화한 DSL |
| structured script | normalized flow에서 생성된 유지보수 가능한 테스트 코드 |

## Webwright의 역할

Microsoft Webwright는 **코딩 에이전트 + 터미널 + 브라우저** 패러다임의 경량 브라우저 에이전트 프레임워크입니다.

- LLM(OpenAI / Anthropic / OpenRouter)이 터미널에서 Python Playwright 스크립트를 작성
- `write code -> execute -> inspect screenshots -> repair` 루프로 웹 태스크 수행
- 실행 산출물: `final_script.py`, `trajectory.json`, screenshots, `plan.md` 등
- plugin/skill의 craft 워크플로는 reusable script 초안 생성에 활용 가능

이 계획에서 Webwright는 **최종 테스트 코드 저장소**가 아니라 **자동화 초안 생성 엔진**입니다.

```text
raw final_script.py
-> action extraction
-> normalization
-> structured test code
```

## 현재 상태

### `testrail-clone`에 이미 있는 것

| 레이어 | 내용 | 주요 위치 |
|--------|------|-----------|
| 데이터 모델 | `aiInput`, `aiExpectedOutput`, `mission`, `goals`, `TestCaseStep`, `automationKey` | `apps/server/prisma/schema.prisma` |
| Automation API | bulk result upload, mapping CRUD, coverage summary | `apps/server/src/modules/automation/` |
| UI | 케이스 AI 필드, Automation 페이지 | `CaseListPane`, `AutomationPage` |
| Webhook | `case.*`, `run.*`, `result.*` 이벤트 | `apps/server/src/modules/settings/webhooks.routes.ts` |
| CI 예시 | bulk upload 패턴 | `docs/CI_AND_COMPATIBILITY_EXAMPLES.md` |

### 아직 없는 것

| 항목 | 소유 위치 |
|------|----------|
| `webwright-automation-generator` CLI | 별도 프로젝트 |
| Webwright raw run wrapper | generator |
| raw script -> action extraction | generator |
| action -> normalized flow/script | generator |
| generated automation project scaffold | generator 산출물 |
| generated project reporter | generated automation project |
| generated project CI workflow | generated automation project |
| automationKey mapping sync | generator + `testrail-clone` API |

## 책임 분리

### `testrail-clone`에서 할 작업

| 영역 | 작업 |
|------|------|
| TestCase 관리 | `aiInput`, `aiExpectedOutput`, steps, `automationKey` 저장 |
| API token | generated project가 결과 업로드할 project token 발급 |
| Automation mapping | `automationKey` CRUD와 coverage 계산 |
| Result ingest | `/api/automation/results/bulk`로 결과 수신 |
| Reports | coverage, upload history, retry queue, failed automation rows 표시 |
| Export/API | generator가 case를 가져갈 수 있도록 기존 API 제공 |

`testrail-clone`에서 하지 않을 일:

- Webwright 브라우저 실행
- LLM key 관리
- raw `final_script.py` 장기 보관
- generated test code 소유
- generated project CI 실행
- raw script normalization UI를 제품 핵심 기능으로 내장

### `webwright-automation-generator`에서 할 작업

| 영역 | 작업 |
|------|------|
| Case fetch | `testrail-clone` API 또는 export 파일에서 case 수집 |
| Prompt build | case fields -> Webwright task prompt 변환 |
| Webwright run | pinned Webwright checkout으로 raw script/trajectory 생성 |
| Action extraction | raw script와 trajectory에서 action list 추출 |
| Normalization | action list를 DSL 또는 structured script로 정규화 |
| Project generation | tests/flows/pages/reporters/config scaffold 생성 |
| Project update | 기존 generated project를 보존하면서 변경분만 갱신 |
| Verification | LLM 없이 generated tests 재실행 |
| Mapping sync | `automationKey` 후보 생성 및 `testrail-clone` mapping update |

### generated automation project에서 할 작업

| 영역 | 작업 |
|------|------|
| Test code | 실제 테스트 코드, helper, page object, fixture 소유 |
| Review | git diff / PR로 생성 코드 검토 |
| CI | Playwright/Python test 실행 |
| Reporter | 결과를 `/api/automation/results/bulk`로 업로드 |
| Maintenance | selector/helper/data fixture 유지보수 |

## 권장 프로젝트 구조

### Generator

```text
webwright-automation-generator/
  src/
    cli/
    integrations/
      testrail_clone_client.py
      webwright_runner.py
    pipeline/
      build_task.py
      extract_actions.py
      normalize_flow.py
      generate_code.py
      update_project.py
      verify_generated.py
    model/
    templates/
      python-playwright/
      typescript-playwright/
  docs/
```

### Generated Automation Project

```text
checkout-automation/
  pyproject.toml
  README.md
  testrail.config.yaml
  testrail.mapping.yaml
  tests/
    test_checkout_saved_card.py
  flows/
    auth.py
    checkout.py
  pages/
    login_page.py
    checkout_page.py
  assertions/
  data/
    users.yaml
    cards.yaml
  reporters/
    testrail_clone_reporter.py
  artifacts/
    raw/
    normalized/
```

Layering rule:

- `tests/`는 얇은 orchestration만 담당
- `flows/`는 도메인 workflow 담당
- `pages/`는 selector와 UI mechanics 담당
- `data/`는 secret 값이 아니라 env/fixture reference만 저장
- `reporters/`만 `testrail-clone` upload endpoint를 안다

## 생성 파이프라인

```text
Case input
-> Task prompt
-> Webwright raw run
-> Raw artifacts
-> Action extraction
-> Normalized flow
-> Structured code generation
-> LLM-free verification
-> automationKey mapping
-> CI result upload
```

### 1. Case input

입력은 세 가지를 지원합니다.

| 입력 | 용도 |
|------|------|
| `testrail-clone` API | 실제 프로젝트 연동 |
| exported JSON/CSV | offline generation |
| markdown/task file | PoC 또는 실험 |

### 2. Task prompt

`mission`, `goals`, `steps`, `aiInput`, `aiExpectedOutput`, `preconditions`를 합성합니다.

```text
Mission: {case.mission}
Goals: {case.goals}

Steps:
1. {step.content}
   Expected: {step.expectedResult}

Final assertion: {case.aiExpectedOutput}
Start URL: {project.baseUrl}

Constraints:
- Use test accounts only.
- Do not write production data.
- Save evidence screenshots for critical assertions.
- Return final judgment: passed | failed | blocked.
```

### 3. Action extraction

raw script를 그대로 보관하지 않고 의미 단위로 바꿉니다.

```json
[
  { "order": 1, "type": "goto", "target": "/login" },
  { "order": 2, "type": "fill", "target": "email", "valueRef": "users.standard.email" },
  { "order": 3, "type": "fill", "target": "password", "valueRef": "users.standard.password" },
  { "order": 4, "type": "click", "target": "login.submit" },
  { "order": 5, "type": "assertText", "target": "dashboard.heading", "value": "Dashboard" }
]
```

### 4. Normalization

중복 action을 domain helper로 승격합니다.

```text
fill email + fill password + click submit
-> login(as="standard_user")
```

Normalized flow:

```json
{
  "version": 1,
  "flow": "checkout.saved_card",
  "caseId": "101",
  "automationKey": "checkout.saved_card",
  "steps": [
    { "action": "login", "as": "standard_user" },
    { "action": "checkout.open" },
    { "action": "checkout.payWithSavedCard", "card": "visa" },
    { "action": "assertText", "target": "confirmation", "text": "Order confirmation" }
  ]
}
```

### 5. Structured script

생성된 테스트는 raw Playwright 호출 나열이 아니라 유지보수 가능한 코드여야 합니다.

```python
from flows.auth import login_as
from flows.checkout import pay_with_saved_card
from pages.confirmation_page import ConfirmationPage


def test_checkout_saved_card(ctx):
    login_as(ctx, "standard_user")
    pay_with_saved_card(ctx, "visa")
    ConfirmationPage(ctx.page).expect_order_confirmation()
```

## `testrail-clone` API 연결

### Automation mapping

generator가 generated test를 promotion한 뒤 mapping을 설정합니다.

```http
PATCH /api/projects/{projectId}/automation/mappings/{caseId}
Authorization: Bearer <project-api-token>
Content-Type: application/json

{ "automationKey": "checkout.saved_card" }
```

### Result upload

generated automation project의 reporter가 결과를 업로드합니다.

```http
POST /api/automation/results/bulk
Authorization: Bearer <project-api-token>
Content-Type: application/json
```

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

## 후보 전략 비교

| 후보 | 설명 | 장점 | 단점 | 권장도 |
|------|------|------|------|--------|
| A. `testrail-clone` 내부 실행 | 앱 안에 Webwright 실행기 내장 | UI 즉시 실행 쉬움 | 보안·배포·책임 과다 | 낮음 |
| B. processor callback | 외부 worker가 raw/normalized proposal을 앱으로 callback | 앱에서 review UX 가능 | 앱이 자동화 생성 workflow까지 떠안음 | 중간 |
| C. generator + generated project | generator가 자동화 프로젝트 생성, 결과만 API 업로드 | TestRail 모델과 잘 맞고 코드 소유권 명확 | Run now UX는 약함 | 높음 |

현재 권장안은 **C. generator + generated project**입니다.

## 권장 로드맵

### Phase 1 - Generator PoC

| # | 작업 | 산출물 |
|---|------|--------|
| 1 | `webwright-automation-generator` scaffold | CLI project |
| 2 | Webwright commit pin + Docker/local setup | reproducible generation env |
| 3 | case JSON/markdown input | offline PoC |
| 4 | raw script 저장 | `artifacts/raw/` |
| 5 | 최소 action extraction | `actions/*.json` |
| 6 | Python Playwright scaffold 생성 | generated project |

### Phase 2 - `testrail-clone` API 연동

- case fetch client
- `testrail.config.yaml`
- `testrail.mapping.yaml`
- automationKey mapping sync
- bulk result reporter
- CI example

### Phase 3 - Normalization 강화

- login/navigation/assertion helper detection
- page object generation
- selector registry
- data fixture extraction
- unstable selector warning

### Phase 4 - Update workflow

- existing generated project 분석
- case 변경 diff
- generated block preservation
- partial regeneration
- stale mapping detection

### Phase 5 - Optional review UI

- local static review report
- raw script / action list / normalized flow / code diff 비교
- screenshots / trajectory evidence viewer

## 리스크 및 완화

| 리스크 | 영향 | 완화 |
|--------|------|------|
| raw script 난립 | 유지보수 불가 | raw script를 최종 산출물로 취급하지 않고 normalized flow/script만 promotion |
| Webwright upstream 릴리스 부재 | 재현성 낮음 | commit SHA pin, Docker image digest 고정 |
| selector 불안정 | 테스트 flake | selector registry, data-testid 가이드, unstable selector warning |
| generator가 사용자 코드를 덮어씀 | 수동 수정 손실 | generated block marker, manual code preservation |
| TC와 자동화 코드 drift | coverage 신뢰 저하 | `testrail.mapping.yaml`, case snapshot, stale mapping check |
| secret 유출 | 보안 사고 | env var reference, raw artifact redaction |
| generated project가 TestRail과 분리됨 | 결과 추적 누락 | reporter와 CI upload를 scaffold 기본값으로 제공 |

## 다음 단계

1. `webwright-automation-generator` 별도 repo 생성 여부 결정
2. Phase 1 PoC 입력 형식 선택: `testrail-clone` API vs exported JSON vs markdown
3. generated project template 선택: Python Playwright 우선 권장
4. automationKey naming convention 확정
5. [webwright-automation-generator/PRODUCT_SPEC.md](./webwright-automation-generator/PRODUCT_SPEC.md)를 기준으로 구현 backlog 작성

## 참고 링크

- [microsoft/Webwright](https://github.com/microsoft/Webwright)
- [Webwright Project Page](https://microsoft.github.io/Webwright)
- [Webwright Blog: A Terminal Is All You Need For Web Agents](https://www.microsoft.com/en-us/research/articles/webwright-a-terminal-is-all-you-need-for-web-agents/)
