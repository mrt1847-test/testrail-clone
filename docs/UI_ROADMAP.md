# UI Roadmap

## Document Intent

이 문서는 최종 디자인 고정안이 아니라, 초기 정보 구조와 구현 우선순위를 정의하는 문서다.

- 지금 고정하는 것:
  - 필요한 핵심 화면 범위
  - 화면 책임과 route
  - 주요 컴포넌트 분해 기준
  - API 연결 경계
- 나중에 바꿀 수 있는 것:
  - 화면 배치/패널 위치
  - 모달/드로어/expand row 방식
  - 컬럼/필터/버튼 배치
  - 차트 종류/디자인

## UI Direction

이 프로젝트의 UI는 테스트 관리 도구의 실제 업무 흐름을 지원하는 작업형 정보 구조를 따른다.

- TestRail을 픽셀 단위로 복제하지 않는다.
- `shadcn/ui + Tailwind` 기반으로 독자 디자인을 사용한다.
- 서버 상태는 `TanStack Query`, 테이블은 `TanStack Table`을 사용한다.
- React 컴포넌트는 표현/상호작용에 집중하고 도메인 규칙은 백엔드 서비스에서 처리한다.
- 모든 핵심 화면은 `loading`, `empty`, `error` 상태를 가진다.

## Stability Boundary

UI 디테일은 유연하게 바꾸되, 아래는 초기에 최대한 안정적으로 유지한다.

- 핵심 route:
  - `/projects`
  - `/projects/:projectId`
  - `/projects/:projectId/cases`
  - `/projects/:projectId/runs`
  - `/projects/:projectId/runs/:runId`
- 핵심 도메인 모델:
  - `Project`
  - `Section`
  - `TestCase`
  - `TestRun`
  - `TestInstance`
  - `TestResult`

## UI Global Structure

- App Shell: `AppShell`, `ProjectHeader`, `ProjectTabs`, `ProjectSwitcher`, `Breadcrumb`
- 상태 UI: `LoadingState`, `EmptyState`, `ErrorState`, `ConfirmDialog`
- 프로젝트 컨텍스트 라우트: `/projects/:projectId/*`
- Auth 흐름: `/login`, session bootstrap, membership-aware project entry

## UI Phases

이 문서는 UI phase와 delivery tier를 canonical로 다룬다.

- 상세 route tree: `ROUTE_MAP.md`
- 화면별 required API와 상태 요구사항: `SCREEN_INVENTORY.md`
- 컴포넌트 책임/구현 상태: `COMPONENT_MAP.md`
- 구현 task와 backend dependency: `IMPLEMENTATION_PLAN.md`

### UI Phase 0: App Shell
- Goal: 프로젝트 공통 레이아웃과 공통 상태 컴포넌트 구축
- Scope: project shell, project navigation, shared state UI
- Exit Criteria:
  - 모든 프로젝트 라우트가 동일한 shell을 공유
  - 공통 상태 UI가 페이지별로 재사용

### UI Phase 1: Project Screens
- Goal: 프로젝트 진입/선택/개요 화면 완성
- Scope: project selection, project creation, project overview, auth bootstrap
- Exit Criteria:
  - 프로젝트 목록 조회/생성/선택 가능
  - 개요 대시보드 진입 가능
  - 현재 사용자(`GET /api/auth/me`)와 프로젝트 멤버십 기반 접근 제어 동작

### UI Phase 2: Test Case Workspace
- Goal: 케이스 작성/조회/편집/삭제 핵심 워크스페이스 완성
- Layout:
  - 좌측/중앙: `Test Case List + Expandable Case Detail`
  - 우측: `Section Tree`
- Expandable Rule:
  - Case detail은 별도 중앙 패널이 아니라 `CaseRow` 아래에서 펼친다.
  - 기본은 단일 확장(`expandedCaseId`)이다.
  - URL query(`sectionId`, `caseId`, `mode`)로 상태를 유지한다.
  - 예:
    - `/projects/1/cases?sectionId=10`
    - `/projects/1/cases?sectionId=10&caseId=101`
    - `/projects/1/cases?sectionId=10&caseId=101&mode=edit`
- Exit Criteria:
  - 섹션 트리-케이스 목록 연동
  - row 확장/축소 + edit mode 전환
  - query 기반 상태 복원
  - section add/edit/delete 가능
  - case bulk move/copy/delete 가능
  - case import/export 가능
- Replaceability Note:
  - 초기 구현은 `ExpandableCaseDetail`
  - 대안 구현은 `CaseDetailDrawer`, `CaseDetailPage`, `CaseDetailPanel`

### UI Phase 2A: Test Case Core (MVP)
- Scope:
  - section/case 기본 CRUD
  - row expand + query sync
  - case detail view/edit
- Exit Criteria:
  - section 선택 -> case 목록 조회
  - case 생성/수정/삭제 후 목록 자동 갱신

### UI Phase 2B: Test Case Productivity (Post-MVP)
- Scope:
  - bulk move/copy/delete
  - import/export
  - template selection
- Exit Criteria:
  - 대량 케이스 작업과 import/export가 안정 동작

### UI Phase 3: Test Run Screens
- Goal: 런 목록과 생성 플로우 구축
- Scope: run list, run creation, case selection, initial assignment hooks
- Exit Criteria:
  - 런 목록 조회 및 생성 완료
  - assignee 기준 필터/단축 진입 가능

### UI Phase 4: Run Detail
- Goal: 인스턴스 실행 결과 입력/이력 확인 화면 구축
- Layout:
  - 상단: `RunHeader` + `RunSummaryBar`
  - 좌측/중앙: `TestInstanceTable`
  - 우측: `ResultEntryPanel`
- Exit Criteria:
  - 결과 입력 후 상태 반영
  - 이력/스텝 결과 조회 가능
  - close run 가능
  - rerun(상태 필터 기반) 가능
  - assignee 변경 가능
  - attachment 업로드/조회 가능
  - defect link/add 가능

### UI Phase 5: Automation Screens
- Goal: 자동화 매핑/업로드/토큰 관리 UI 구축
- Scope: automation dashboard, upload detail, token management entry, retry actions
- Exit Criteria:
  - 업로드 이력 및 상세 확인
  - 토큰 생성/삭제 가능
  - 실패 항목 retry 가능 (`reprocess`는 내부 운영 동작으로만 취급)
  - automation key mapping 수정 가능

### UI Phase 6: Reports Screens
- Goal: 품질 지표 시각화 및 요약 리포트 구축
- Scope: project reports, run summaries, failure trend, traceability, coverage gap
- Exit Criteria:
  - 핵심 지표, 최근 실패/결과, 런 요약 노출
  - requirement/reference 기반 traceability/coverage 확인 가능

### UI Phase 7: Settings Screens
- Goal: 프로젝트 운영 설정 고도화
- Scope: project settings categories, members, fields/statuses/templates, webhooks, integrations, notifications, audit logs
- Exit Criteria:
  - 설정 카테고리별 화면/탭 완성
  - 멤버/커스텀 필드/웹훅/감사 로그 조회 관리 가능
  - roles/permissions 관리 가능
  - statuses/templates/integrations/notifications 관리 가능

### UI Phase 8: Milestones
- Goal: 릴리스/스프린트 단위 테스트 진행을 마일스톤으로 관리
- Scope: milestone list/detail and linked run progress
- Exit Criteria:
  - 마일스톤 생성/조회 및 상세 진행률 확인 가능

### UI Phase 9: Test Plans
- Goal: 환경 조합 기반 Plan/Run 관리를 제공
- Scope: plan list/detail, environment matrix, plan-entry run generation
- Exit Criteria:
  - Plan 목록/상세와 환경별 entry/run 관리 가능

### UI Phase 10: Results Explorer
- Goal: 결과 이력 탐색을 런 범위/프로젝트 범위로 분리 제공
- Scope: run-scoped and project-wide result history explorer
- Exit Criteria:
  - Run scoped history와 Project-wide explorer 필터 조회 가능

## UI Scope by Product Area

- `1. Project Selection`
- `2. Project Overview`
- `3. Test Cases`
- `4. Milestones`
- `5. Test Plans`
- `6. Test Runs`
- `7. Run Detail / Results`
- `8. Results Explorer`
- `9. Automation`
- `10. Reports`
- `11. Settings`

## Delivery Tiers

### MVP 필수
- `/projects`
- `/projects/:projectId`
- `/projects/:projectId/cases`
- `/projects/:projectId/runs`
- `/projects/:projectId/runs/new`
- `/projects/:projectId/runs/:runId`

### 1차 완성
- `/projects/:projectId/automation`
- `/projects/:projectId/settings/tokens`
- `/projects/:projectId/reports`

### 후순위
- `/projects/:projectId/milestones`
- `/projects/:projectId/milestones/:milestoneId`
- `/projects/:projectId/plans`
- `/projects/:projectId/plans/:planId`
- `/projects/:projectId/results`
- `/projects/:projectId/settings/members`
- `/projects/:projectId/settings/custom-fields`
- `/projects/:projectId/settings/webhooks`
- `/projects/:projectId/settings/audit-logs`

## Supporting Documents

- 화면 정의: `docs/SCREEN_INVENTORY.md`
- 라우트 정의: `docs/ROUTE_MAP.md`
- 컴포넌트 책임/의존성 및 명칭 규칙: `docs/COMPONENT_MAP.md` (`Naming Conventions`)
- 프론트엔드 구조: `docs/FRONTEND_ARCHITECTURE.md`
