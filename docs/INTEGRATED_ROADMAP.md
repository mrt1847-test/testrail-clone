# Integrated Product/UI Roadmap

## Document Intent

이 문서는 `ROADMAP.md`와 `UI_ROADMAP.md`를 현재 구현 상태 기준으로 통합한 실행 로드맵이다.

- 제품 범위와 phase 원칙은 `ROADMAP.md`를 따른다.
- 화면 요구사항은 `SCREEN_INVENTORY.md`를 따른다.
- UI phase와 delivery tier는 `UI_ROADMAP.md`를 따른다.
- API 계약은 `API_SPEC.md`를 따른다.
- 구현 task는 `IMPLEMENTATION_PLAN.md`에 반영한다.

이 문서의 목적은 "무엇을 먼저 구현할지"를 결정하는 것이다. 세부 API/화면/컴포넌트 목록은 각 canonical 문서에 위임한다.

## Current Progress Snapshot

2026-04-27 기준 전체 완성도는 약 30-35%로 평가한다.

| Area | Estimated Progress | Current State |
| --- | ---: | --- |
| Documentation / architecture | 70% | 핵심 문서와 canonical 경계가 정리됨 |
| Frontend routing / shell | 60% | MVP 및 후순위 route 다수가 존재 |
| Project / overview screens | 60% | 목록/생성/개요 기본 연결 있음 |
| Test case workspace | 45% | 조회/섹션 선택/row expand 중심, mutation UX 부족 |
| Test run list/create | 45% | 목록/기본 생성 있음, case selection/environment 부족 |
| Run detail / result workflow | 35% | instance 조회/선택 있음, result entry/history 미완성 |
| Reports | 35% | 기본 집계 화면/API 있음, traceability/coverage 부족 |
| Automation | 20% | dashboard shell 있음, upload/token auth 본 구현 부족 |
| Milestones / plans | 25-30% | route/page/API shell 있음, DB/UX 완성도 낮음 |
| Settings / governance | 25% | 일부 settings 화면 있음, members/status/templates/integrations 부족 |
| Auth / permissions | 10-15% | 문서상 필수이나 구현 초기 |

## Product Direction

핵심 제품 흐름은 다음 순서를 절대 흔들지 않는다.

```text
Test Case -> Test Run -> Test Instance -> Test Result history
```

따라서 구현 우선순위도 화면 수를 늘리는 것보다 아래 흐름을 끝까지 동작시키는 데 둔다.

1. 케이스를 작성하고 섹션으로 정리한다.
2. 케이스 선택으로 런을 만든다.
3. 런 안의 테스트 인스턴스에 결과를 남긴다.
4. 결과 이력을 보존하고 요약/리포트에 반영한다.
5. 자동화/계획/거버넌스를 그 위에 확장한다.

## Roadmap Phases From Current State

### Phase A: Foundation Closure

Goal: 현재 skeleton을 실제 DB-backed MVP 기반으로 닫는다.

Scope:
- auth bootstrap 최소 구현
  - login/logout/current user
  - project membership context
  - role-aware UI/API guard baseline
- memory repository 의존 제거 또는 dev-only 격리
- project/suite/section/case Prisma repository 기본값 검증
- shared API response/error/pagination 타입 정리
- `packages/api-client` 전환 계획 확정

Backend deliverables:
- `GET /api/auth/me`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- DB-backed project/suite/section/case CRUD verification
- consistent error envelope

UI deliverables:
- `/login`
- auth bootstrap before project routes
- project list/create/overview가 DB-backed API로 동작

Exit criteria:
- 서버 재시작 후 project/suite/section/case 데이터가 유지된다.
- 인증되지 않은 사용자는 `/login`으로 이동한다.
- project route는 현재 사용자와 membership context를 기준으로 진입한다.

Estimated current progress: 35%

### Phase B: Test Case Authoring Core

Goal: 테스트 케이스 작성/편집/삭제 workflow를 실제 업무에 쓸 수 있게 만든다.

Scope:
- section tree CRUD
- case list/search/filter
- case create/edit/delete
- case detail expandable row
- case step CRUD
- query state sync
  - `sectionId`
  - `caseId`
  - `mode`

Backend deliverables:
- sections CRUD complete
- cases CRUD complete
- test case steps CRUD
- pagination/search/filter

UI deliverables:
- `TestCaseWorkspace`
- add/edit/delete section dialogs
- create/edit case form
- step viewer/editor
- delete confirmation
- list/detail cache invalidation

Exit criteria:
- 섹션 선택 후 케이스 목록이 로드된다.
- 케이스 생성/수정/삭제가 DB에 저장되고 목록이 갱신된다.
- step 순서가 저장되고 상세에서 복원된다.
- URL query로 선택 섹션/확장 케이스/edit mode가 복원된다.

Estimated current progress: 45%

### Phase C: Run Execution Core

Goal: 케이스 선택부터 결과 입력/이력 조회까지 실행 흐름을 완성한다.

Scope:
- run list
- run create
  - include all
  - selected cases
  - suite/environment/milestone selection
- test instance generation
- run detail
- result entry
- result history
- close run
- run summary/status counts

Backend deliverables:
- `POST /api/projects/:projectId/runs`
- selected case run generation
- `GET /api/projects/:projectId/runs/:runId`
- `GET /api/projects/:projectId/runs/:runId/instances`
- `POST /api/runs/:runId/results`
- `GET /api/tests/:testId/results`
- `POST /api/runs/:runId/close`
- run summary aggregation

UI deliverables:
- run create form with case selector
- run detail instance table
- result entry panel
- result history list
- close run dialog

Exit criteria:
- 사용자가 케이스를 선택해 런을 생성할 수 있다.
- 런 생성 시 `test_instances`가 snapshot으로 생성된다.
- 결과 입력 시 `test_results`가 append-only로 저장되고 instance 최신 상태가 바뀐다.
- 결과 이력이 화면에서 조회된다.
- run progress/status count가 결과 변경에 따라 갱신된다.

Estimated current progress: 40%

### Phase D: Operational Dashboard and Reports

Goal: QA/릴리스 의사결정에 필요한 기본 지표를 제공한다.

Scope:
- project overview
- recent runs
- recent failures/results
- status distribution
- failure trend
- run summary
- automation coverage baseline

Backend deliverables:
- DB-backed overview aggregation
- report endpoints verified with seeded data
- empty-state-safe aggregate response

UI deliverables:
- overview widgets
- reports page widgets
- report table/chart placeholders replaced with reusable widgets

Exit criteria:
- 케이스/런/결과 데이터 변화가 overview/reports에 반영된다.
- 빈 데이터, 일부 실패, 전체 실패 상태를 위젯 단위로 처리한다.
- 기본 품질 상태를 프로젝트 진입 화면과 reports 화면에서 확인할 수 있다.

Estimated current progress: 35%

### Phase E: Automation and Execution Productivity

Goal: 자동화 업로드와 실행 생산성 기능을 제품의 핵심 확장으로 만든다.

Scope:
- API token lifecycle
- token-auth automation endpoints
- bulk result upload
- upload history/detail
- partial failure policy
- assignment/my tests
- rerun
- bulk result entry
- result attachments and defect links

Backend deliverables:
- project-scoped tokens with hash storage
- automation bulk upload endpoint
- upload history persistence
- assignment APIs
- rerun API
- attachment/defect link APIs

UI deliverables:
- API token create/revoke
- automation mapping table
- upload history/detail
- failed item retry
- My Tests route
- Rerun dialog
- assignment editor

Exit criteria:
- CI/CLI가 token으로 결과를 업로드할 수 있다.
- bulk upload는 atomic/non-atomic 정책을 지원한다.
- 실패 항목을 upload detail에서 확인할 수 있다.
- 사용자는 자신에게 할당된 테스트와 재실행 대상을 빠르게 찾을 수 있다.

Estimated current progress: 20%

### Phase F: Release Planning

Goal: 마일스톤/플랜/환경 조합 기반으로 릴리스 테스트를 관리한다.

Scope:
- milestone CRUD
- test plan CRUD
- configuration groups/values
- plan entries by configuration matrix
- plan-entry run generation
- plan/milestone progress rollup
- plan-level rerun

Backend deliverables:
- DB-backed milestones
- DB-backed plans and entries
- configuration schema/API
- run generation by plan entry
- progress rollup queries

UI deliverables:
- milestone list/detail
- plan list/detail
- environment/configuration matrix
- create plan run dialog

Exit criteria:
- 릴리스/스프린트 단위 진행률을 마일스톤에서 확인할 수 있다.
- 환경 조합별 run을 plan entry로 생성/추적할 수 있다.
- plan detail에서 entry/run별 진행 상태가 보인다.

Estimated current progress: 25-30%

### Phase G: Platform Administration and Integrations

Goal: 팀 운영, 확장성, 외부 시스템 연동을 지원한다.

Scope:
- members/roles/permissions hardening
- custom fields
- custom result statuses
- case templates
- webhooks
- audit logs
- defect integration settings
- notifications
- import/export
- TestRail-compatible adapter

Backend deliverables:
- member CRUD and role enforcement
- custom field/status/template APIs
- webhook event model
- audit log writes and query
- defect integration provider abstraction
- notification preferences and delivery hooks
- CSV import/export
- `/api/v2` compatibility adapter baseline

UI deliverables:
- members settings
- custom fields/statuses/templates settings
- webhooks/audit logs
- integrations settings
- notifications settings
- import/export dialogs

Exit criteria:
- 관리자가 프로젝트 운영 정책을 UI에서 설정할 수 있다.
- 변경/결과/권한 관련 감사 추적이 가능하다.
- 결함 관리 시스템과 최소 URL-template/push-action 수준으로 연결된다.
- 기본 TestRail-compatible API adapter가 내부 service layer를 재사용한다.

Estimated current progress: 15-20%

## Immediate Execution Plan

### Batch 1: Close DB-backed catalog foundation

Target:
- Phase A + Phase B prerequisite

Tasks:
- `USE_IN_MEMORY_REPOSITORY=false` 기준으로 projects/suites/sections/cases 동작 검증
- repository/service route 간 async/Prisma path 정리
- seed 데이터로 project -> suite -> section -> case 화면 로딩 확인
- error envelope와 pagination response 일관성 점검

Verification:
- server lint/build 통과
- web lint 통과
- project/cases 화면이 DB 데이터로 표시
- 서버 재시작 후 데이터 유지

### Batch 2: Finish test case authoring workflow

Target:
- Phase B

Tasks:
- section add/edit/delete UI 연결
- case create/edit/delete UI 연결
- case step viewer/editor + API 추가
- case list query invalidation 정리
- URL query sync edge case 보완

Verification:
- section 선택/생성/수정/삭제 가능
- case 생성/수정/삭제 가능
- step 순서 저장/복원 가능
- expand/edit mode가 URL에서 복원

### Batch 3: Finish run creation workflow

Target:
- Phase C entry

Tasks:
- run create form 확장
  - suite 선택
  - include all
  - selected case IDs
  - environment
  - optional milestone
- run create API payload 정리
- created run detail navigation 확인

Verification:
- include-all run 생성
- selected-cases run 생성
- 생성된 run의 instances가 snapshot 필드를 가진다

### Batch 4: Finish result entry and history

Target:
- Phase C completion

Tasks:
- `GET /api/tests/:testId/results` 구현
- `ResultEntryPanel` 실제 form 구현
- status/comment/elapsed/version/defects 저장
- step results 저장
- result history list 연결
- close run dialog 연결

Verification:
- 결과 입력 후 instance status 변경
- history가 append-only로 남음
- run summary/status distribution이 갱신됨
- close run 후 상태 변경

### Batch 5: Add auth and membership baseline

Target:
- Phase A completion

Tasks:
- login/current user/logout API
- temporary local session or JWT strategy 확정
- project_members 기반 role lookup
- mutation route role guard 정리
- `/login` route와 bootstrap UI 추가

Verification:
- 비로그인 사용자는 `/login`으로 이동
- 로그인 후 accessible projects 표시
- role에 따라 mutation 가능 여부가 달라짐

### Batch 6: Stabilize reports and overview

Target:
- Phase D

Tasks:
- overview aggregation DB 기준 검증
- reports widget response shape 정리
- recent failures/results 실제 query 연결
- empty/error/loading state를 widget 단위로 분리

Verification:
- case/run/result 변경이 overview/reports에 반영
- 빈 프로젝트에서도 reports가 깨지지 않음

## Priority Rules

작업 우선순위는 다음 규칙으로 판단한다.

1. 현재 실행 흐름을 막는 작업이 화면 확장보다 우선이다.
2. DB-backed persistence가 memory/stub UI보다 우선이다.
3. Case -> Run -> Instance -> Result 흐름에 직접 연결된 기능이 settings/advanced 기능보다 우선이다.
4. API 계약과 화면 요구사항이 충돌하면 `API_SPEC.md`와 `SCREEN_INVENTORY.md`를 먼저 정리한다.
5. 새 route를 추가하기보다 기존 route의 primary user action을 끝까지 동작시키는 것을 우선한다.

## Near-Term Completion Targets

### 40% target
- DB-backed project/suite/section/case가 기본 경로로 동작
- case create/edit/delete 완료
- run create with selected cases 완료

### 50% target
- result entry/history 완료
- run summary/status count 자동 갱신
- close run 완료
- overview/reports 기본 집계 안정화

### 60% target
- auth/current user/membership baseline 완료
- API token lifecycle 완료
- automation bulk upload baseline 시작
- milestone/plan DB-backed 전환 시작

### 70% target
- automation upload history/detail 완료
- assignment/my-tests/rerun 완료
- milestone/plan environment matrix baseline 완료

### 80%+ target
- custom fields/statuses/templates
- requirements/traceability/coverage
- defect integration
- notifications/activity
- import/export
- audit/webhook hardening
