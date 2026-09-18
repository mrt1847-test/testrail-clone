# Webwright Automation Generator Product Spec

Last aligned: 2026-05-30

## 목적

`webwright-automation-generator`는 `testrail-clone`의 테스트 케이스 또는 자연어 테스트 지시를 입력받아, 유지보수 가능한 테스트 자동화 프로젝트를 생성·갱신하는 도구다.

이 도구는 Webwright를 이용해 브라우저 조작 초안을 만들지만, Webwright raw script를 그대로 누적하지 않는다. raw script를 action 단위로 분류하고, 공통 flow/helper/page object를 재사용하는 구조화된 테스트 코드로 변환한다.

## 제품 원칙

1. **testrail-clone은 테스트 관리 시스템으로 유지한다.**
   자동화 코드는 별도 generated automation project가 소유한다.

2. **raw script는 최종 산출물이 아니다.**
   Webwright의 `final_script.py`는 evidence/debug artifact이며, 장기 유지보수 대상은 normalized flow 또는 structured script다.

3. **생성된 코드는 사람이 리뷰하고 수정할 수 있어야 한다.**
   generator는 완전 자동 commit 도구가 아니라 reviewable diff를 만드는 도구다.

4. **결과 연결은 API로 충분하다.**
   generated project는 `testrail-clone`의 `/api/automation/results/bulk`로 결과를 업로드한다.

5. **반복되는 행동은 helper로 승격한다.**
   login, navigation, checkout, assertion, fixture setup 같은 행동은 TC별 코드에 중복하지 않는다.

## 사용자

| 사용자 | 목표 |
|--------|------|
| QA engineer | TestCase를 기반으로 자동화 초안을 빠르게 생성하고 리뷰 |
| Automation engineer | 생성된 코드를 구조화하고 helper/page object로 유지보수 |
| Developer | CI에서 generated project를 실행하고 실패 원인 확인 |
| Test manager | `testrail-clone`에서 automation coverage와 결과 추적 |

## 범위

### In scope

- `testrail-clone` API에서 case/run metadata 가져오기
- 자연어 case를 Webwright task prompt로 변환
- Webwright 실행으로 raw script와 trajectory 생성
- raw script/trajectory에서 action list 추출
- action list를 normalized flow로 변환
- normalized flow에서 structured test code 생성
- generated automation project scaffold 생성
- 기존 generated project update
- `automationKey` 매핑 파일 생성
- bulk result upload reporter 생성
- CI 예시 생성

### Out of scope

- `testrail-clone` 내부에서 브라우저 실행
- `testrail-clone` 내부에서 raw script 장기 관리
- generator 자체의 대형 SaaS UI
- TestCase의 source of truth를 generator로 이동
- Webwright raw script를 그대로 CI 회귀 테스트로 사용하는 것

## 주요 워크플로

### 1. 새 자동화 프로젝트 생성

```text
generator init
-> testrail-clone 연결 설정
-> case selection
-> Webwright exploratory run
-> action extraction
-> normalized flow 생성
-> structured test project scaffold
-> local verification
-> PR/review
```

### 2. 기존 프로젝트 갱신

```text
generator sync --case-id C101
-> 기존 automationKey/flow 탐색
-> TC 변경사항 diff
-> 필요한 부분만 Webwright rerun
-> normalized flow update
-> test code update
-> reviewable diff 생성
```

### 3. CI 실행과 결과 업로드

```text
generated automation project
-> pytest/playwright 실행
-> reporter가 automationKey별 결과 생성
-> POST /api/automation/results/bulk
-> testrail-clone에서 TestResult/coverage 확인
```

## 산출물

### generator 산출물

| 산출물 | 설명 |
|--------|------|
| `actions/*.json` | raw script에서 추출한 행동 목록 |
| `flows/*.json` | normalized DSL |
| structured test files | `tests/`, `flows/`, `pages/` 코드 |
| `testrail.mapping.yaml` | case와 automationKey/script path 매핑 |
| `testrail.config.yaml` | API base URL, project/run/report 설정 |
| `artifacts/raw/` | 단기 보관 raw script, trajectory, screenshots |

### generated project 예시

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
  data/
    users.yaml
    cards.yaml
  reporters/
    testrail_clone_reporter.py
  artifacts/
    raw/
    normalized/
```

## 성공 기준

| 기준 | 목표 |
|------|------|
| 생성 품질 | TC 1개에서 raw script가 아니라 structured test가 생성됨 |
| 중복 제거 | 3개 이상 TC에서 login/navigation helper가 재사용됨 |
| 재실행성 | LLM 없이 generated test가 2회 연속 통과 |
| 결과 연동 | bulk result upload로 `testrail-clone`에 결과 반영 |
| 리뷰 가능성 | 생성/갱신 결과가 git diff로 검토 가능 |

## 단계별 구현

### Phase 1: Local generator PoC

- case JSON 또는 markdown 입력 지원
- Webwright run wrapper
- raw script 저장
- 최소 action extraction
- Python Playwright project scaffold
- bulk upload reporter stub

### Phase 2: testrail-clone API 연동

- case list/fetch API client
- `automationKey` mapping sync
- result upload reporter
- `testrail.config.yaml` 표준화

### Phase 3: Normalization 강화

- login/navigation/assertion helper detection
- page object generation
- selector registry
- data fixture extraction

### Phase 4: Update workflow

- 기존 generated project 분석
- case 변경 diff
- partial regeneration
- stale automationKey detection

### Phase 5: Optional review UI

- local HTML report
- raw script vs action list vs normalized flow 비교
- screenshots/trajectory evidence viewer
