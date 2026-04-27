# Component Map

## Document Intent

- 이 문서는 화면 요구사항 목록이 아니라 **컴포넌트 책임/경계/교체 가능성**을 정의한다.
- Page 컴포넌트는 route 단위 조립 역할만 담당한다.
- 데이터 호출은 feature 단위 `api/` + `hooks/` 또는 `packages/api-client`를 통해 수행한다.
- 도메인 판단 로직은 backend service layer에 둔다.
- 화면별 required API와 loading/empty/error 요구사항은 `SCREEN_INVENTORY.md`를 참조한다.
- API 계약과 endpoint canonical 목록은 `API_SPEC.md`를 참조한다.

## Implementation Status Legend

- `implemented`: 현재 코드베이스에 실제 구현되어 사용 중
- `planned`: 문서 기준 목표이며 아직 구현 전
- `deferred`: 후순위로 계획만 존재

## Naming Conventions

- `*Page`: 라우트 단위 페이지 조립 컴포넌트 (`ProjectListPage`, `RunDetailPage`, `ReportsPage`).
- `*Workspace`: 다중 패널 작업 영역 조립 컴포넌트 (`TestCaseWorkspace` 등).
- `*Pane` / `*Panel`: 레이아웃 구역 단위.
- `*Dialog` / `*Drawer`: 모달/오버레이 UI.
- 빈 프로젝트 목록 전용 UI는 `ProjectEmptyState`로 통일한다 (`EmptyProjectState` 사용 안 함).

## Replaceability Contracts

### Case Detail Contract
- 초기 구현: `ExpandableCaseDetail`
- 대안 구현: `CaseDetailDrawer`, `CaseDetailPage`, `CaseDetailPanel`
- 교체 원칙: `useCaseDetail`과 `CaseDetailModel` 인터페이스는 유지하고 렌더링 컨테이너만 교체한다.

### Run Result Entry Contract
- 초기 구현: `ResultEntryPanel`
- 대안 구현: `ResultEntryDrawer`, `InlineResultEditor`
- 교체 원칙: `useCreateResult`/`useResultHistory` 훅과 payload 스키마는 유지하고 입력 UI만 교체한다.

## App Shell / Shared

- Responsibility:
  - 프로젝트 공통 레이아웃 제공
  - 프로젝트 전환/탭/브레드크럼 제공
  - 공통 loading/empty/error/confirm UI 제공
- Components:
  - `AppShell`: global layout frame
  - `ProjectHeader`: project title/context summary
  - `ProjectTabs`: project-scoped navigation tabs
  - `ProjectSwitcher`: accessible project switching entry
  - `Breadcrumb`: route context display
  - `LoadingState`, `EmptyState`, `ErrorState`, `ConfirmDialog`: shared state primitives
  - `Button`, `StatusBadge`, `DataTable`: shared primitive targets
- Status:
  - `implemented`: `AppShell`, `ProjectHeader`, `ProjectTabs`, `ProjectSwitcher`, `Breadcrumb`, `EmptyState`, `LoadingState`, `ErrorState`, `ConfirmDialog`
  - `planned`: `Button`, `StatusBadge`, `DataTable`

## Entry / Projects

- Responsibility:
  - 인증 진입과 프로젝트 선택 화면 조립
  - 프로젝트 생성 dialog 표시와 mutation trigger 연결
  - 프로젝트 없음 상태를 `ProjectEmptyState`로 위임
- Components:
  - `LoginPage`: login route composition
  - `LoginForm`: credential input and submit interaction
  - `ProjectListPage`: project list route composition
  - `ProjectCard`: project summary/selectable item
  - `ProjectCreateDialog`: project creation overlay
  - `ProjectEmptyState`: no-project CTA
- Status:
  - `implemented`: `ProjectListPage`, `ProjectCard`, `ProjectCreateDialog`, `ProjectEmptyState`
  - `planned`: `LoginPage`, `LoginForm`

## Project Overview

- Responsibility:
  - 프로젝트 첫 진입 dashboard 조립
  - summary cards, recent runs, recent failures/results를 위젯 단위로 배치
  - 상세 drill-down route로 이동하는 CTA 제공
- Components:
  - `ProjectOverviewPage`: overview route composition
  - `ProjectSummaryCards`: high-level metric cards
  - `RecentRunList`: recent run navigation list
  - `RecentFailureTable`: recent failure snapshot
  - `RecentResultList`: recent result snapshot
  - `AutomationCoverageCard`: automation coverage summary
- Status:
  - `implemented`: `ProjectOverviewPage`, `ProjectSummaryCards`, `RecentRunList`, `RecentFailureTable`, `RecentResultList`, `AutomationCoverageCard`

## Test Cases

- Responsibility:
  - 케이스 워크스페이스의 list/detail/tree 영역 조립
  - section 선택과 case list 필터 상태 연결
  - case row expansion과 query 상태 동기화
  - case 생성/수정/삭제 상호작용을 feature hook에 위임
- Components:
  - `TestCaseWorkspace`: workspace-level orchestration
  - `CaseListPane`: list area container
  - `CaseListToolbar`: search/filter/create controls
  - `CaseListTable`: case table rendering
  - `CaseRow`: row display and expand trigger
  - `ExpandableCaseDetail`: in-row case detail/edit area
  - `CaseMetaSummary`: compact case metadata display
  - `CaseStepViewer`: read-only step display
  - `CaseStepEditor`: editable step list
  - `CaseFormDrawer`: create/edit container alternative
  - `SectionTreePane`: section tree container
  - `SectionTree`: nested section selection
  - `AddSectionDialog`, `EditSectionDialog`, `DeleteSectionDialog`: section mutations
  - `DeleteCaseConfirmDialog`: destructive case confirmation
- Status:
  - `implemented`: `TestCaseWorkspace`, `CaseListPane`, `CaseListToolbar`, `CaseRow`, `ExpandableCaseDetail`, `SectionTreePane`
  - `planned`: `CaseListTable`, `CaseMetaSummary`, `CaseStepViewer`, `CaseStepEditor`, `CaseFormDrawer`, `SectionTree`, `AddSectionDialog`, `EditSectionDialog`, `DeleteSectionDialog`, `DeleteCaseConfirmDialog`

## Test Runs

- Responsibility:
  - run list와 run creation route 조립
  - run filters/progress/status display 연결
  - run 생성 폼에서 suite/case/milestone/environment 선택 UI 제공
- Components:
  - `RunListPage`: run list route composition
  - `RunListToolbar`: create/search/filter controls
  - `RunListTable`: run table rendering
  - `RunFilterBar`: status/assignee filters
  - `RunStatusBadge`: run status display
  - `RunProgressBar`: run completion visual
  - `RunCreatePage`: run creation route composition
  - `RunCreateForm`: run metadata input
  - `RunCaseSelector`, `RunCaseSelectionTable`, `RunSectionFilter`: case selection controls
  - `EnvironmentEditor`: environment/config input
  - `RunAssigneePicker`, `MyTestsShortcut`: assignment workflow targets
- Status:
  - `implemented`: `RunListPage`, `RunCreatePage`
  - `planned`: `RunListToolbar`, `RunListTable`, `RunFilterBar`, `RunStatusBadge`, `RunProgressBar`, `RunCreateForm`, `RunCaseSelector`, `RunCaseSelectionTable`, `RunSectionFilter`, `EnvironmentEditor`, `RunAssigneePicker`, `MyTestsShortcut`

## Run Detail

- Responsibility:
  - run execution workspace 조립
  - instance selection과 result entry panel 연결
  - result history, close run, rerun, assignment, attachment/defect panels의 위치를 조율
- Components:
  - `RunDetailPage`: run detail route composition
  - `RunHeader`: run metadata and primary actions
  - `RunSummaryBar`: status counts/progress
  - `TestInstanceTable`: instance list and selection
  - `TestInstanceRow`: instance row display
  - `TestInstanceFilterBar`: status/assignee/search filters
  - `ResultEntryPanel`: selected instance result input
  - `ResultHistoryList`: selected instance result history
  - `StepResultEditor`: step-level result input
  - `CloseRunDialog`: close confirmation
  - `RerunDialog`: status-filtered rerun creation
  - `AssigneeEditor`: run/test assignment editor
  - `ResultAttachmentPanel`: result evidence attachments
  - `DefectLinkPanel`: defect link/create actions
- Status:
  - `implemented`: `RunDetailPage`
  - `planned`: `RunHeader`, `RunSummaryBar`, `TestInstanceTable`, `TestInstanceRow`, `TestInstanceFilterBar`, `ResultEntryPanel`, `ResultHistoryList`, `StepResultEditor`, `CloseRunDialog`, `RerunDialog`, `AssigneeEditor`, `ResultAttachmentPanel`, `DefectLinkPanel`

## Results Explorer

- Responsibility:
  - run-scoped/project-scoped result history exploration
  - filter state and result detail drawer orchestration
- Components:
  - `ResultExplorerPage`: result explorer route composition
  - `ResultFilterBar`: run/status/source filters
  - `ResultTable`: result history table
  - `ResultDetailDrawer`: result detail display
  - `ResultSourceBadge`: manual/automation/api source display
- Status:
  - `implemented`: `ResultExplorerPage`
  - `planned`: `ResultFilterBar`, `ResultTable`, `ResultDetailDrawer`, `ResultSourceBadge`

## Milestones

- Responsibility:
  - milestone list/detail 화면 조립
  - linked run summary and progress chart placement
- Components:
  - `MilestoneListPage`, `MilestoneTable`, `MilestoneCreateDialog`
  - `MilestoneStatusBadge`, `MilestoneProgressBar`
  - `MilestoneDetailPage`, `MilestoneHeader`, `MilestoneSummaryCards`, `MilestoneRunTable`, `MilestoneProgressChart`
- Status:
  - `implemented`: `MilestonesPage`, `MilestoneDetailPage`
  - `planned`: granular milestone components listed above

## Test Plans

- Responsibility:
  - plan list/detail 화면 조립
  - environment/configuration matrix and plan-entry run creation placement
- Components:
  - `TestPlanListPage`, `TestPlanTable`, `TestPlanCreateDialog`, `PlanProgressBar`
  - `TestPlanDetailPage`, `PlanEntryTable`, `EnvironmentMatrix`, `CreatePlanRunDialog`
- Status:
  - `implemented`: `PlansPage`, `PlanDetailPage`
  - `planned`: granular plan components listed above

## Automation

- Responsibility:
  - automation mapping/upload dashboard 조립
  - upload detail and token-management entry placement
- Components:
  - `AutomationDashboard`, `AutomationSummaryCards`, `AutomationMappingTable`, `AutomationUploadHistory`
  - `BulkUploadResultDetail`, `BulkUploadSummary`, `BulkUploadFailedItemTable`, `CIMetadataCard`
  - `ApiTokenList`, `ApiTokenCreateDialog`, `ApiTokenRevokeDialog`
  - `UploadRetryAction`, `UploadReprocessAction`, `AutomationKeyMappingEditor`
- Status:
  - `implemented`: `AutomationPage`, `BulkUploadDetailPage`, `TokensPage`
  - `planned`: granular automation/token components listed above

## Settings

- Responsibility:
  - project settings category pages/tabs 조립
  - admin forms and destructive action zones placement
- Components:
  - `ProjectSettingsPage`, `ProjectGeneralSettingsForm`, `DangerZone`
  - `ApiTokenList`, `ApiTokenCreateDialog`, `ApiTokenRevokeDialog`
  - `MemberManagement`
  - `CustomFieldSettings`, `CustomStatusSettings`, `CaseTemplateSettings`
  - `WebhookSettings`, `IntegrationSettings`, `NotificationSettings`, `AuditLogTable`
- Status:
  - `implemented`: `ProjectSettingsPage`, `TokensPage`, `CustomFieldsPage`, `WebhooksPage`, `AuditLogsPage`
  - `planned`: `ProjectGeneralSettingsForm`, `DangerZone`, `MemberManagement`, `CustomStatusSettings`, `CaseTemplateSettings`, `IntegrationSettings`, `NotificationSettings`, granular token/webhook/audit components

## Reports

- Responsibility:
  - report dashboard composition
  - chart/table widget placement
  - traceability/coverage report expansion points
- Components:
  - `ReportsPage`
  - `StatusDistributionChart`, `FailureTrendChart`, `AutomationCoverageCard`
  - `RecentFailuresTable`, `RecentResultsList`, `RunSummaryTable`
  - `TraceabilityMatrix`, `CoverageGapTable`
- Status:
  - `implemented`: `ReportsPage`
  - `planned`: chart/table primitives and traceability/coverage widgets
