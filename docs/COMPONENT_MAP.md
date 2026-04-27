# Component Map

## Document Intent

- 이 문서는 최종 UI 배치 고정안이 아니라 컴포넌트 책임/경계 정의 문서다.
- Page는 route 단위 조립 역할만 담당한다.
- 데이터 호출은 `feature api/hook`을 통해 수행한다.
- 도메인 로직은 backend service layer에 둔다.

## Naming Conventions

- `*Page`: 라우트 단위 페이지 조립 컴포넌트 (`ProjectListPage`, `RunDetailPage`, `ReportsPage`).
- `*Workspace`: 다중 패널 작업 영역 조립 컴포넌트 (`TestCaseWorkspace` 등).
- `*Pane` / `*Panel`: 레이아웃 구역 단위.
- `*Dialog` / `*Drawer`: 모달·오버레이 UI.
- 빈 프로젝트 목록 전용 UI는 `ProjectEmptyState`로 통일한다 (`EmptyProjectState` 사용 안 함).

## Replaceability Contracts

### Case Detail Contract
- 초기 구현: `ExpandableCaseDetail`
- 대안 구현: `CaseDetailDrawer`, `CaseDetailPage`, `CaseDetailPanel`
- 교체 원칙: `useCaseDetail`과 `CaseDetailModel` 인터페이스는 유지하고, 렌더링 컨테이너만 교체한다.

### Run Result Entry Contract
- 초기 구현: `ResultEntryPanel`
- 대안 구현: `ResultEntryDrawer`, `InlineResultEditor`
- 교체 원칙: `useCreateResult`/`useResultHistory` 훅과 payload 스키마는 유지하고 입력 UI만 교체한다.

## App Shell / Shared

- Route scope: global
- Purpose: 공통 레이아웃, 공통 상태 UI, 재사용 UI primitive 제공
- Main components:
  - `AppShell`
  - `ProjectHeader`
  - `ProjectTabs`
  - `ProjectSwitcher`
  - `Breadcrumb`
  - `Button`
  - `StatusBadge`
  - `DataTable`
  - `EmptyState`
  - `LoadingState`
  - `ErrorState`
  - `ConfirmDialog`
- Required API: project context API (`GET /projects`, `GET /projects/:projectId`) 및 각 페이지 API 위임
- Loading state: shell placeholder + page-level suspense fallback
- Empty state: 라우트별 empty 컴포넌트 위임
- Error state: 글로벌 boundary + 페이지 boundary
- MVP: Yes
- Later: 접근성 단축키, 테마 토큰 확장

## Entry / Projects

- Route scope: `/login`, `/projects`
- Purpose: 인증 및 프로젝트 진입 플로우
- Main components:
  - `LoginPage`
  - `LoginForm`
  - `ProjectListPage`
  - `ProjectCard`
  - `ProjectCreateDialog`
  - `ProjectEmptyState`
- Required API:
  - `POST /auth/login`
  - `GET /auth/me`
  - `GET /projects`
  - `POST /projects`
- Loading state: form submit loading, project list skeleton
- Empty state: 프로젝트 없음 + 생성 CTA
- Error state: 인증 실패/프로젝트 조회 실패 메시지
- MVP: Yes
- Later: 소셜 로그인, 프로젝트 템플릿

## Project Overview

- Route scope: `/projects/:projectId`
- Purpose: 프로젝트 지표 요약과 최근 이슈 시각화
- Main components:
  - `ProjectOverviewPage`
  - `ProjectSummaryCards`
  - `RecentRunList`
  - `RecentFailureTable`
  - `RecentResultList`
  - `AutomationCoverageCard`
- Required API:
  - `GET /projects/:projectId/overview`
  - `GET /projects/:projectId/runs/recent`
  - `GET /projects/:projectId/reports/recent-failures`
  - `GET /projects/:projectId/reports/recent-results`
  - `GET /projects/:projectId/reports/automation-coverage`
- Loading state: 위젯 skeleton
- Empty state: 활동/실패/커버리지 없음 안내
- Error state: 위젯 단위 에러 fallback
- MVP: Yes
- Later: 기간 비교, drill-down navigation

## Test Cases (Expandable Detail 중심)

- Route scope: `/projects/:projectId/cases`
- Purpose: 케이스 목록 중심 작성/편집/정리
- Main components:
  - `TestCaseWorkspace`
  - `CaseListPane`
  - `CaseListToolbar`
  - `CaseListTable`
  - `CaseRow`
  - `ExpandableCaseDetail`
  - `CaseMetaSummary`
  - `CaseStepViewer`
  - `CaseStepEditor`
  - `CaseFormDrawer`
  - `DeleteCaseConfirmDialog`
  - `SectionTreePane`
  - `SectionTree`
  - `AddSectionDialog`
- Required API:
  - `GET /projects/:projectId/cases`
  - `GET /cases/:caseId`
  - `POST /projects/:projectId/cases`
  - `PATCH /cases/:caseId`
  - `DELETE /cases/:caseId`
  - `GET /projects/:projectId/sections`
  - `POST /projects/:projectId/sections`
- Loading state:
  - 목록 loading (`CaseListTable`)
  - 상세 lazy loading (`ExpandableCaseDetail`)
  - 트리 loading (`SectionTreePane`)
- Empty state:
  - 섹션 내 케이스 없음
  - 검색/필터 결과 없음
- Error state:
  - 목록/상세/트리 개별 오류 + `Retry`
- MVP: Yes
- Later:
  - multi-expand
  - bulk actions
  - column personalization

### Expandable Detail Contract
- 초기에는 별도 라우트 `CaseDetailPage` 없이 `CaseRow` 하단 확장 영역으로 렌더링한다.
- 수정은 `ExpandableCaseDetail` 내부 `edit mode`에서 처리한다.
- URL query 상태 연동:
  - `sectionId`, `caseId`, `mode`
  - 예: `/projects/1/cases?sectionId=10&caseId=101&mode=edit`
- 이후 필요 시 `CaseDetailDrawer`/`CaseDetailPage`로 교체 가능하게 설계한다.

## Test Runs

- Route scope: `/projects/:projectId/runs`, `/projects/:projectId/runs/new`
- Purpose: 런 목록 조회 및 런 생성
- Main components:
  - `RunListPage`
  - `RunListToolbar`
  - `RunListTable`
  - `RunFilterBar`
  - `RunStatusBadge`
  - `RunProgressBar`
  - `RunCreatePage`
  - `RunCreateForm`
  - `RunCaseSelector`
  - `RunCaseSelectionTable`
  - `RunSectionFilter`
  - `EnvironmentEditor`
- Required API:
  - `GET /projects/:projectId/runs`
  - `GET /projects/:projectId/suites`
  - `GET /projects/:projectId/cases`
  - `POST /projects/:projectId/runs`
  - `GET /projects/:projectId/milestones` (옵션)
- Loading state: table/form init loading
- Empty state: 런 없음 또는 선택 가능한 케이스 없음
- Error state: 조회/생성 실패
- MVP: Yes
- Later: 런 템플릿, 저장된 프리셋

## Run Detail

- Route scope: `/projects/:projectId/runs/:runId`
- Purpose: 인스턴스 상태 확인 및 결과 입력/이력 조회
- Main components:
  - `RunDetailPage`
  - `RunHeader`
  - `RunSummaryBar`
  - `TestInstanceTable`
  - `TestInstanceRow`
  - `TestInstanceFilterBar`
  - `ResultEntryPanel`
  - `ResultHistoryList`
  - `StepResultEditor`
  - `CloseRunDialog`
- Required API:
  - `GET /projects/:projectId/runs/:runId`
  - `GET /projects/:projectId/runs/:runId/instances`
  - `POST /runs/:runId/results`
  - `GET /instances/:instanceId/results`
  - `POST /runs/:runId/close`
- Loading state: summary/table/panel 분리 loading
- Empty state: 인스턴스/이력 없음 안내
- Error state: 패널별 오류 처리
- MVP: Yes
- Later: 일괄 결과 입력, 단축키 워크플로우, `ResultEntryDrawer`/`InlineResultEditor` 대안

## Results Explorer

- Route scope: `/projects/:projectId/runs/:runId/results`, `/projects/:projectId/results`
- Purpose: 결과 이력을 런 범위/프로젝트 범위로 탐색
- Main components:
  - `ResultExplorerPage`
  - `ResultFilterBar`
  - `ResultTable`
  - `ResultDetailDrawer`
  - `ResultSourceBadge`
- Required API:
  - `GET /projects/:projectId/runs/:runId/results`
  - `GET /projects/:projectId/results`
- Loading state: table skeleton
- Empty state: 결과 없음
- Error state: 조회 실패 + 재시도
- MVP:
  - run scoped history: Yes (Run Detail 내부)
  - project-wide explorer: Later
- Later: 저장된 필터, export

## Milestones

- Route scope: `/projects/:projectId/milestones`, `/projects/:projectId/milestones/:milestoneId`
- Purpose: 릴리스/스프린트 단위 진행 관리
- Main components:
  - `MilestoneListPage`
  - `MilestoneTable`
  - `MilestoneCreateDialog`
  - `MilestoneStatusBadge`
  - `MilestoneProgressBar`
  - `MilestoneDetailPage`
  - `MilestoneHeader`
  - `MilestoneSummaryCards`
  - `MilestoneRunTable`
  - `MilestoneProgressChart`
- Required API:
  - `GET/POST /projects/:projectId/milestones`
  - `GET/PATCH /projects/:projectId/milestones/:milestoneId`
  - `GET /projects/:projectId/milestones/:milestoneId/runs`
- Loading state: table/card skeleton
- Empty state: milestone 없음
- Error state: 조회 실패 + 재시도
- MVP: Later
- Later: 추세 차트, 지연 경고

## Test Plans

- Route scope: `/projects/:projectId/plans`, `/projects/:projectId/plans/:planId`
- Purpose: 환경 조합별 plan/run 관리
- Main components:
  - `TestPlanListPage`
  - `TestPlanTable`
  - `TestPlanCreateDialog`
  - `PlanProgressBar`
  - `TestPlanDetailPage`
  - `PlanEntryTable`
  - `EnvironmentMatrix`
  - `CreatePlanRunDialog`
- Required API:
  - `GET/POST /projects/:projectId/plans`
  - `GET /projects/:projectId/plans/:planId`
  - `GET /projects/:projectId/plans/:planId/entries`
  - `POST /projects/:projectId/plans/:planId/runs`
- Loading state: table/matrix skeleton
- Empty state: plan/entry 없음
- Error state: 조회 실패 + 재시도
- MVP: Later
- Later: plan template, entry preset

## Automation

- Route scope: `/projects/:projectId/automation`, `/projects/:projectId/automation/uploads/:uploadId`
- Purpose: 자동화 매핑 현황과 업로드 결과 추적
- Main components:
  - `AutomationDashboard`
  - `AutomationSummaryCards`
  - `ApiTokenList`
  - `ApiTokenCreateDialog`
  - `AutomationMappingTable`
  - `AutomationUploadHistory`
  - `BulkUploadResultDetail`
  - `BulkUploadSummary`
  - `BulkUploadFailedItemTable`
  - `CIMetadataCard`
- Required API:
  - `GET /projects/:projectId/automation/summary`
  - `GET /projects/:projectId/automation/mappings`
  - `GET /projects/:projectId/automation/uploads`
  - `GET /projects/:projectId/automation/uploads/:uploadId`
- Loading state: dashboard/detail skeleton
- Empty state: 업로드 이력 없음
- Error state: 조회 실패 + 재시도
- MVP: 1차 완성 (핵심 MVP 이후)
- Later: 실패 건 재처리, CI 메타 필터

## Settings

- Route scope: `/projects/:projectId/settings`, `/projects/:projectId/settings/tokens`, `/projects/:projectId/settings/members`, `/projects/:projectId/settings/custom-fields`, `/projects/:projectId/settings/webhooks`, `/projects/:projectId/settings/audit-logs`
- Purpose: 프로젝트 운영 설정 관리
- Main components:
  - `ProjectSettingsPage`
  - `ProjectGeneralSettingsForm`
  - `DangerZone`
  - `ApiTokenList`
  - `ApiTokenCreateDialog`
  - `ApiTokenRevokeDialog`
  - `MemberManagement`
  - `CustomFieldSettings`
  - `WebhookSettings`
  - `AuditLogTable`
- Required API:
  - `GET/PATCH /projects/:projectId/settings`
  - `GET/POST/DELETE /projects/:projectId/tokens`
  - `GET/POST/PATCH/DELETE /projects/:projectId/members`
  - `GET/POST/PATCH/DELETE /projects/:projectId/custom-fields`
  - `GET/POST/PATCH/DELETE /projects/:projectId/webhooks`
  - `GET /projects/:projectId/audit-logs`
- Loading state: form/table skeleton
- Empty state: 토큰/멤버 없음
- Error state: 저장 실패/조회 실패
- MVP:
  - settings/tokens: Yes
  - members: Later
- Later: custom fields, webhook, audit logs

## Reports

- Route scope: `/projects/:projectId/reports`
- Purpose: 품질 지표 분석과 추세 확인
- Main components:
  - `ReportsPage`
  - `StatusDistributionChart`
  - `FailureTrendChart`
  - `AutomationCoverageCard`
  - `RecentFailuresTable`
  - `RecentResultsList`
  - `RunSummaryTable`
- Required API:
  - `GET /projects/:projectId/reports/status-distribution`
  - `GET /projects/:projectId/reports/failure-trend`
  - `GET /projects/:projectId/reports/automation-coverage`
  - `GET /projects/:projectId/reports/recent-failures`
  - `GET /projects/:projectId/reports/recent-results`
  - `GET /projects/:projectId/reports/run-summary`
- Loading state: chart/table skeleton
- Empty state: 데이터 없음
- Error state: 위젯 단위 에러 fallback
- MVP: 1차 완성 (기본 카드·테이블)
- Later: 리포트 export, 커스텀 구간 비교
