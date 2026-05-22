# Screen Inventory

모든 화면은 아래 항목을 공통으로 정의한다.
- Screen name
- Route
- Purpose
- Primary user actions
- Main components
- Required API
- Loading state
- Empty state
- Error state
- MVP 여부
- Later 확장 여부

문서 역할 규칙:
- 이 문서는 **화면 요구사항과 사용자 액션**을 canonical로 다룬다.
- 컴포넌트 책임/교체 가능성은 `COMPONENT_MAP.md`를 기준으로 본다.
- `Main components`는 주요 조립 컴포넌트만 적고, 세부 컴포넌트 책임은 반복하지 않는다.

## 1) Project Selection

### Screen: Project Selection
- Route: `/projects`
- Purpose: 접근 가능한 프로젝트를 선택하거나 새 프로젝트를 생성한다.
- Primary user actions: 프로젝트 선택, 새 프로젝트 생성, 프로젝트 목록 탐색
- Main components: `ProjectListPage`, `ProjectCreateDialog`, `ProjectEmptyState`
- Required API: `GET /api/projects`, `POST /api/projects`
- Loading state: 프로젝트 카드 skeleton
- Empty state: `ProjectEmptyState` + 생성 CTA
- Error state: 목록 로딩 실패 + `Retry`
- MVP 여부: 필수
- Later 확장 여부: 즐겨찾기, 최근 방문, 권한 필터

## 2) Project Overview

### Screen: Project Overview
- Route: `/projects/:projectId`
- Purpose: 프로젝트 전체 상태를 요약해 첫 진입 의사결정을 돕는다.
- Primary user actions: 최근 런/실패/결과 확인, 하위 화면으로 이동
- Main components: `ProjectOverviewPage`, `ProjectSummaryCards`, recent activity widgets
- Required API: `GET /api/projects/:projectId/overview`, `GET /api/projects/:projectId/runs/recent`, `GET /api/projects/:projectId/reports/recent-failures`, `GET /api/projects/:projectId/reports/recent-results`, `GET /api/projects/:projectId/reports/automation-coverage`
- Loading state: 카드/리스트 skeleton
- Empty state: 최근 데이터 없음 안내
- Error state: 위젯 단위 오류 fallback + 전체 재시도
- MVP 여부: 기본 shell과 summary는 필수
- Later 확장 여부: 추세 차트, 기간 비교, 위젯 커스터마이징

## 3) Test Cases

### Screen: Test Case Workspace
- Route: `/projects/:projectId/cases`
- Purpose: 섹션 단위로 테스트 케이스를 생성/조회/수정/삭제한다.
- Primary user actions: 섹션 선택, 케이스 검색/필터, 케이스 작성, row 확장 상세 확인, 상세 편집/삭제
- Main components: `TestCaseWorkspace`, `CaseListPane`, `ExpandableCaseDetail`, `SectionTreePane`
- Required API: `GET /api/projects/:projectId/cases`, `GET /api/suites/:suiteId/sections`, `POST /api/suites/:suiteId/sections`, `GET /api/cases/:caseId`, `POST /api/sections/:sectionId/cases`, `PATCH /api/cases/:caseId`, `DELETE /api/cases/:caseId`, `POST /api/cases/:caseId/steps`, `PATCH /api/case-steps/:stepId`, `DELETE /api/case-steps/:stepId`
- Loading state: 목록/상세/트리 분리 로딩
- Empty state: 섹션 내 케이스 없음 + `Add Case`
- Error state: 패널 단위 오류 + `Retry`
- MVP 여부: 필수
- Later 확장 여부: multi-expand, bulk actions, 컬럼 커스터마이징

#### Suite Selection Policy
- MVP 기본값: project당 단일 기본 suite를 사용한다.
- 다중 suite 지원 시:
  - `SuiteSelector`를 workspace 상단에 표시한다.
  - API는 `suiteId` 컨텍스트를 기준으로 sections/cases를 조회한다.

### Test Cases Detail Policy
- Case detail은 별도 페이지가 아니라 `CaseRow` 하단 expandable row로 구현한다.
- 단일 확장 기본값: 한 번에 하나의 case만 open.
- query 상태: `sectionId`, `caseId`, `mode`
  - `/projects/1/cases?sectionId=10`
  - `/projects/1/cases?sectionId=10&caseId=101`
  - `/projects/1/cases?sectionId=10&caseId=101&mode=edit`

## 4) Milestones

### Screen: Milestone List
- Route: `/projects/:projectId/milestones`
- Purpose: 릴리스/스프린트 단위 마일스톤의 진행 상태를 관리한다.
- Primary user actions: 마일스톤 생성, 목록 조회/정렬, 상세 진입
- Main components: `MilestoneListPage`, `MilestoneTable`, `MilestoneCreateDialog`
- Required API: `GET /api/projects/:projectId/milestones`, `POST /api/projects/:projectId/milestones`, `PATCH /api/projects/:projectId/milestones/:milestoneId`
- Loading state: table skeleton
- Empty state: 마일스톤 없음 + 생성 CTA
- Error state: 조회/생성 실패 메시지
- MVP 여부: Phase 6 (후순위)
- Later 확장 여부: 기간 필터, 목표 대비 지연 경고

### Screen: Milestone Detail
- Route: `/projects/:projectId/milestones/:milestoneId`
- Purpose: 특정 마일스톤의 런 현황 및 진행률을 확인한다.
- Primary user actions: 연결 런 확인, 진행률 모니터링, 관련 화면 이동
- Main components: `MilestoneDetailPage`, milestone summary widgets, `MilestoneRunTable`
- Required API: `GET /api/projects/:projectId/milestones/:milestoneId`, `GET /api/projects/:projectId/milestones/:milestoneId/runs`
- Loading state: 카드/테이블 skeleton
- Empty state: 연결 런 없음
- Error state: 상세 조회 실패 + 재시도
- MVP 여부: 후순위
- Later 확장 여부: burnup/burndown, 리스크 알림

## 5) Test Plans

### Screen: Test Plan List
- Route: `/projects/:projectId/plans`
- Purpose: 환경 조합별 테스트런 묶음을 관리한다.
- Primary user actions: 플랜 생성, 플랜 선택, 진행률 확인
- Main components: `TestPlanListPage`, `TestPlanTable`, `TestPlanCreateDialog`
- Required API: `GET /api/projects/:projectId/plans`, `POST /api/projects/:projectId/plans`
- Loading state: table skeleton
- Empty state: 플랜 없음 + 생성 CTA
- Error state: 목록/생성 실패
- MVP 여부: 후순위
- Later 확장 여부: 템플릿 플랜, 복제 생성

### Screen: Test Plan Detail
- Route: `/projects/:projectId/plans/:planId`
- Purpose: Plan 내부 환경별 Run 매트릭스를 관리한다.
- Primary user actions: 환경 엔트리 확인, 플랜 런 생성, 런 상세 진입
- Main components: `TestPlanDetailPage`, `PlanEntryTable`, `EnvironmentMatrix`
- Required API: `GET /api/projects/:projectId/plans/:planId`, `GET /api/projects/:projectId/plans/:planId/entries`, `POST /api/projects/:projectId/plans/:planId/runs`
- Loading state: matrix/table skeleton
- Empty state: 엔트리 없음
- Error state: 상세 조회 실패
- MVP 여부: Phase 6 이후
- Later 확장 여부: 환경 preset, 매트릭스 비교

## 6) Test Runs

### Screen: Test Run List
- Route: `/projects/:projectId/runs`
- Purpose: 프로젝트 내 테스트런 목록을 조회하고 관리한다.
- Primary user actions: 필터링, 런 선택, 새 런 생성 화면 이동
- Main components: `RunListPage`, `RunListTable`, run filters/progress widgets
- Required API: `GET /api/projects/:projectId/runs`
- Loading state: table skeleton
- Empty state: 런 없음 + `New Run` CTA
- Error state: 목록 조회 실패 + `Retry`
- MVP 여부: 필수
- Later 확장 여부: 저장 필터, 고급 검색

### Screen: Test Run Create
- Route: `/projects/:projectId/runs/new`
- Purpose: 선택한 케이스 집합으로 테스트런을 생성한다.
- Primary user actions: 이름/환경 입력, include_all 선택, 케이스 선택 후 생성
- Main components: `RunCreatePage`, `RunCreateForm`, `RunCaseSelector`
- Required API: `GET /api/projects/:projectId/suites`, `GET /api/projects/:projectId/cases`, `GET /api/projects/:projectId/milestones`, `POST /api/projects/:projectId/runs`
- Loading state: 폼 초기 데이터 로딩
- Empty state: 선택 가능한 케이스 없음
- Error state: 생성 실패 + 재시도
- MVP 여부: 필수
- Later 확장 여부: 템플릿 기반 생성, 최근 설정 재사용

## 7) Run Detail / Results

### Screen: Run Detail
- Route: `/projects/:projectId/runs/:runId`
- Purpose: 런 진행률을 확인하고 테스트 인스턴스 결과를 입력한다.
- Primary user actions: 인스턴스 선택, 결과 입력, 이력 확인, 런 종료
- Main components: `RunDetailPage`, `TestInstanceTable`, `ResultEntryPanel`, `ResultHistoryList`
- Required API: `GET /api/projects/:projectId/runs/:runId`, `GET /api/projects/:projectId/runs/:runId/instances`, `POST /api/runs/:runId/results`, `GET /api/tests/:testId/results`, `POST /api/runs/:runId/close`
- Loading state: 요약/테이블/패널 분리 로딩
- Empty state: 인스턴스 없음, 결과 이력 없음
- Error state: 패널 단위 에러 fallback
- MVP 여부: 필수
- Later 확장 여부: 배치 결과 입력, 단축키 워크플로우
- Screenshot walkthrough notes:
  - Desktop: header 바로 아래 실행 workbench에서 status rail, section tree, compact test table, QPane이 같은 row에 유지되어 선택 테스트의 결과 입력/이력 확인 중에도 런 상태와 섹션 맥락을 잃지 않는다.
  - Narrow: mobile status summary가 먼저 보이고 workbench는 status rail, section tree, table, QPane 순서로 세로 적층된다. `testId`, `sectionId`, `groupBy` URL 상태로 새로고침 후 같은 실행 맥락을 복원한다.

### Screen: Run Result History (Optional Dedicated)
- Route: `/projects/:projectId/runs/:runId/results`
- Purpose: 특정 런의 결과 이력을 필터링해 본다.
- Primary user actions: 상태/케이스 필터, 상세 확인
- Main components: `ResultExplorerPage`, `ResultFilterBar`, `ResultTable`, `ResultDetailDrawer`
- Required API: `GET /api/projects/:projectId/runs/:runId/results`
- Loading state: table skeleton
- Empty state: 결과 없음
- Error state: 조회 실패 + 재시도
- MVP 여부: Run Detail 내 Result History로 대체 가능
- Later 확장 여부: 별도 페이지 분리

## 8) Results Explorer

### Screen: Project-wide Result Explorer
- Route: `/projects/:projectId/results`
- Purpose: 프로젝트 전체 결과 이력을 통합 탐색한다.
- Primary user actions: 런/상태/소스 필터, 결과 상세 조회
- Main components: `ResultExplorerPage`, `ResultFilterBar`, `ResultTable`, `ResultDetailDrawer`
- Required API: `GET /api/projects/:projectId/results`
- Loading state: table skeleton
- Empty state: 결과 없음
- Error state: 조회 실패 + 재시도
- MVP 여부: 후순위
- Later 확장 여부: 저장된 검색 조건, export

## 9) Automation

### Screen: Automation Dashboard
- Route: `/projects/:projectId/automation`
- Purpose: 자동화 매핑 현황과 업로드 상태를 모니터링한다.
- Primary user actions: 매핑 확인, 업로드 상세 이동, 토큰 설정 이동
- Main components: `AutomationDashboard`, `AutomationMappingTable`, `AutomationUploadHistory`
- Required API: `GET /api/projects/:projectId/automation/summary`, `GET /api/projects/:projectId/automation/mappings`, `GET /api/projects/:projectId/automation/uploads`
- Loading state: 카드/테이블 skeleton
- Empty state: 업로드 이력 없음
- Error state: 조회 실패 + `Retry`
- MVP 여부: 1차 완성
- Later 확장 여부: 자동 매핑 추천, 실패 분류

### Screen: Bulk Upload Result Detail
- Route: `/projects/:projectId/automation/uploads/:uploadId`
- Purpose: bulk 업로드 성공/실패 항목을 상세 확인한다.
- Primary user actions: 실패 항목 확인, CI 메타데이터 확인, 재처리 근거 수집
- Main components: `BulkUploadResultDetail`, `BulkUploadFailedItemTable`, `CIMetadataCard`
- Required API: `GET /api/projects/:projectId/automation/uploads/:uploadId`
- Loading state: summary/table skeleton
- Empty state: 실패 항목 없음
- Error state: 상세 조회 실패
- MVP 여부: 1차 완성
- Later 확장 여부: 실패 항목 재처리

## 10) Reports

### Screen: Reports
- Route: `/projects/:projectId/reports`
- Purpose: 품질 상태를 시각적으로 분석한다.
- Primary user actions: 리포트 카드/차트 조회, 실패 드릴다운
- Main components: `ReportsPage`, report chart widgets, report table widgets
- Required API: `GET /api/projects/:projectId/reports/status-distribution`, `GET /api/projects/:projectId/reports/failure-trend`, `GET /api/projects/:projectId/reports/automation-coverage`, `GET /api/projects/:projectId/reports/recent-failures`, `GET /api/projects/:projectId/reports/run-summary`
- Loading state: 위젯 단위 skeleton
- Empty state: 기간 내 데이터 없음
- Error state: 위젯 단위 fallback + 재시도
- MVP 여부: 1차 완성(기본 카드/테이블)
- Later 확장 여부: 고급 차트, 비교 리포트

## 11) Settings

### Screen: Project Settings
- Route: `/projects/:projectId/settings`
- Purpose: 프로젝트 기본 설정을 변경한다.
- Primary user actions: 일반 설정 변경, 위험 작업 수행
- Main components: `ProjectSettingsPage`, settings form sections
- Required API: `GET /api/projects/:projectId/settings`, `PATCH /api/projects/:projectId/settings`
- Loading state: form skeleton
- Empty state: 기본값 안내
- Error state: 저장/조회 실패
- MVP 여부: 필수
- Later 확장 여부: 고급 정책 설정

### Screen: API Tokens
- Route: `/projects/:projectId/settings/tokens`
- Purpose: 자동화 업로드용 API 토큰을 생성/폐기한다.
- Primary user actions: 토큰 생성, 토큰 revoke, 발급 기록 확인
- Main components: `ApiTokenList`, token create/revoke dialogs
- Required API: `GET /api/projects/:projectId/tokens`, `POST /api/projects/:projectId/tokens`, `DELETE /api/projects/:projectId/tokens/:tokenId`
- Loading state: list skeleton
- Empty state: 토큰 없음 + 생성 CTA
- Error state: 생성/삭제 실패
- MVP 여부: 1차 완성
- Later 확장 여부: 만료일, scope 설정

### Screen: Members
- Route: `/projects/:projectId/settings/members`
- Purpose: 프로젝트 멤버와 권한을 관리한다.
- Primary user actions: 멤버 초대, 역할 변경, 멤버 제거
- Main components: `MemberManagement`
- Required API: `GET /api/projects/:projectId/members`, `POST /api/projects/:projectId/members`, `PATCH /api/projects/:projectId/members/:memberId`, `DELETE /api/projects/:projectId/members/:memberId`
- Loading state: table skeleton
- Empty state: 멤버 없음
- Error state: 변경 실패 + 재시도
- MVP 여부: 후순위
- Later 확장 여부: 초대 링크, 역할 템플릿

### Screen: Custom Fields
- Route: `/projects/:projectId/settings/custom-fields`
- Purpose: case/run/result 확장 필드를 관리한다.
- Primary user actions: 필드 생성, 옵션 수정, 활성/비활성
- Main components: `CustomFieldSettings`
- Required API: `GET /api/projects/:projectId/settings/custom-fields`, `POST /api/projects/:projectId/settings/custom-fields`, `PATCH /api/projects/:projectId/settings/custom-fields/:fieldId`, `DELETE /api/projects/:projectId/settings/custom-fields/:fieldId`
- Loading state: list/form skeleton
- Empty state: 필드 없음 + 생성 CTA
- Error state: 저장/조회 실패
- MVP 여부: 후순위
- Later 확장 여부: field scope/preset

### Screen: Custom Statuses
- Route: `/projects/:projectId/settings/statuses`
- Purpose: 결과 상태 집합을 프로젝트에 맞게 확장/매핑한다.
- Primary user actions: 상태 추가, 표시 순서 조정, 매핑 수정
- Main components: `CustomStatusSettings`
- Required API: `GET /api/projects/:projectId/settings/statuses`, `POST /api/projects/:projectId/settings/statuses`, `PATCH /api/projects/:projectId/settings/statuses/:statusId`, `DELETE /api/projects/:projectId/settings/statuses/:statusId`
- Loading state: table skeleton
- Empty state: 커스텀 상태 없음
- Error state: 저장/조회 실패
- MVP 여부: 후순위
- Later 확장 여부: 워크플로우 규칙

### Screen: Case Templates
- Route: `/projects/:projectId/settings/templates`
- Purpose: 케이스 작성 템플릿을 관리한다.
- Primary user actions: 템플릿 생성/편집/삭제
- Main components: `CaseTemplateSettings`
- Required API: `GET /api/projects/:projectId/settings/templates`, `POST /api/projects/:projectId/settings/templates`, `PATCH /api/projects/:projectId/settings/templates/:templateId`, `DELETE /api/projects/:projectId/settings/templates/:templateId`
- Loading state: list skeleton
- Empty state: 템플릿 없음
- Error state: 저장/조회 실패
- MVP 여부: 후순위
- Later 확장 여부: 템플릿 버전/권한

### Screen: Integrations
- Route: `/projects/:projectId/settings/integrations`
- Purpose: defect tracker/Jira/GitHub 통합 설정을 관리한다.
- Primary user actions: provider 선택, URL template 설정, 연결 테스트
- Main components: `IntegrationSettings`
- Required API: `GET /api/projects/:projectId/integrations/defects`, `PATCH /api/projects/:projectId/integrations/defects`
- Loading state: form skeleton
- Empty state: 통합 미설정 안내
- Error state: 저장 실패
- MVP 여부: 후순위
- Later 확장 여부: 다중 provider

### Screen: Audit Logs
- Route: `/projects/:projectId/settings/audit-logs`
- Purpose: query project audit events for troubleshooting and governance.
- Primary user actions: filter by actor/entity/action/date/search text, inspect changes, paginate results
- Main components: `AuditLogTable`
- Required API: `GET /api/projects/:projectId/settings/audit-logs`, `GET /api/projects/:projectId/settings/audit-log-filters`
- Loading state: table skeleton
- Empty state: no matching audit logs
- Error state: query failed + retry
- MVP status: simple
- Later expansion: saved filters/export

### Screen: Notifications
- Route: `/projects/:projectId/settings/notifications`
- Purpose: 알림 채널/이벤트 선호도를 설정한다.
- Primary user actions: assignment/failure/comment 알림 on/off
- Main components: `NotificationSettings`
- Required API: `GET /api/notifications`, `PATCH /api/notifications/preferences`
- Loading state: form skeleton
- Empty state: 기본값 안내
- Error state: 저장 실패
- MVP 여부: 후순위
- Later 확장 여부: 시간대/요약 리포트 주기

---

# Product Spec Addendum: TestRail-like Gaps

This addendum is the canonical screen-level supplement for making the app behave like a practical TestRail alternative. The older screen list remains useful for the current app shell, but the screens below should be treated as required product specs before calling the product complete.

## A) Case History and Versioning

### Screen: Case Version History
- Route: `/projects/:projectId/cases/:caseId/versions`
- Purpose: show immutable case revisions, compare authored changes, and restore a previous version.
- Primary user actions: view version list, compare versions, restore version, copy version link.
- Main components: `CaseVersionTimeline`, `CaseVersionDiff`, `CaseRestoreDialog`.
- Required API: `GET /api/cases/:caseId/versions`, `GET /api/cases/:caseId/versions/:versionId`, `POST /api/cases/:caseId/versions/:versionId/restore`.
- Required states: paginated loading, no versions yet, stale restore conflict, restore success.

## B) Requirements and Traceability

### Screen: Requirement List
- Route: `/projects/:projectId/requirements`
- Purpose: manage requirement/reference items that must be covered by test cases.
- Primary user actions: create requirement, edit requirement, link/unlink cases, filter uncovered requirements.
- Main components: `RequirementTable`, `RequirementEditor`, `RequirementCaseLinkPanel`.
- Required API: `GET /api/projects/:projectId/requirements`, `POST /api/projects/:projectId/requirements`, `PATCH /api/requirements/:requirementId`, `POST /api/cases/:caseId/requirements`.
- Required states: no requirements, duplicate key validation, link conflict.

### Screen: Traceability Matrix
- Route: `/projects/:projectId/reports/traceability`
- Purpose: show requirement -> case -> run/result -> defect coverage in one matrix.
- Primary user actions: filter by milestone/plan/run/status, drill into requirement/case/result, export.
- Main components: `TraceabilityMatrix`, `CoverageFilterBar`, `CoverageExportAction`.
- Required API: `GET /api/projects/:projectId/reports/traceability`, `GET /api/projects/:projectId/reports/coverage-gaps`.
- Required states: long-running report loading, partial report error, export queued.

## C) Plan Configuration Matrix

### Screen: Configuration Settings
- Route: `/projects/:projectId/settings/configurations`
- Purpose: define reusable configuration groups and values such as Browser, OS, Device, Locale.
- Primary user actions: create group, reorder groups, create values, disable values.
- Main components: `ConfigurationGroupList`, `ConfigurationValueTable`.
- Required API: `GET /api/projects/:projectId/configuration-groups`, `POST /api/projects/:projectId/configuration-groups`, `POST /api/configuration-groups/:groupId/configurations`.
- Required states: duplicate value validation, disabled value warning.

### Screen: Plan Matrix Builder
- Route: `/projects/:projectId/plans/:planId/matrix`
- Purpose: generate plan entries/runs from selected cases and selected configuration combinations.
- Primary user actions: select configuration groups, preview combinations, create entries/runs.
- Main components: `PlanMatrixBuilder`, `ConfigurationCombinationPreview`, `RunGenerationSummary`.
- Required API: `GET /api/projects/:projectId/configuration-groups`, `POST /api/projects/:projectId/plans/:planId/entries`.
- Required states: too many combinations warning, no cases selected, generation conflict.

## D) Execution Evidence and Defects

### Screen: Result Evidence Panel
- Route: embedded in `/projects/:projectId/runs/:runId`
- Purpose: attach screenshots/logs/traces to a result without reloading the run.
- Primary user actions: upload attachment, preview metadata, download, delete if permitted.
- Main components: `ResultAttachmentList`, `AttachmentUploadDropzone`, `AttachmentPreviewDrawer`.
- Required API: `POST /api/attachments/presign-upload`, `POST /api/results/:resultId/attachments`, `GET /api/attachments/:attachmentId/download-url`.
- Required states: upload progress, upload failed, expired signed URL.

### Screen: Defect Link Panel
- Route: embedded in result detail drawers.
- Purpose: link failed results to Jira/GitHub/Azure-style defects and power defect coverage reports.
- Primary user actions: add defect key/url, remove link, open external defect.
- Main components: `DefectLinkList`, `DefectLinkForm`, `DefectProviderBadge`.
- Required API: `GET /api/results/:resultId/defects`, `POST /api/results/:resultId/defects`, `DELETE /api/results/:resultId/defects/:linkId`.
- Required states: invalid defect key, provider not configured, duplicate link.

## E) Import, Export, and Compatibility

### Screen: Import Wizard
- Route: `/projects/:projectId/import`
- Purpose: import cases/results from CSV/XML/JSON with dry-run validation before commit.
- Primary user actions: upload file, map columns, run dry-run, fix row errors, commit import.
- Main components: `ImportFileStep`, `ImportMappingStep`, `ImportValidationTable`, `ImportCommitSummary`.
- Required API: `POST /api/projects/:projectId/import/cases`, `GET /api/projects/:projectId/import-jobs/:jobId`.
- Required states: parsing failed, row validation errors, import job running, import completed.

### Screen: Export Center
- Route: `/projects/:projectId/exports`
- Purpose: generate downloadable case/result/report exports without blocking the browser.
- Primary user actions: choose export type, set filters, start export, download completed file.
- Main components: `ExportJobList`, `ExportCreateDialog`, `ExportDownloadAction`.
- Required API: `POST /api/projects/:projectId/export/cases`, `POST /api/projects/:projectId/export/results`, `GET /api/projects/:projectId/export-jobs`.
- Required states: export queued, export failed, file expired.

### Screen: API Compatibility Settings
- Route: `/projects/:projectId/settings/api-compatibility`
- Purpose: expose TestRail-compatible `/api/v2` behavior, token scopes, and automation upload examples.
- Primary user actions: view compatibility status, create token, copy endpoint examples, revoke token.
- Main components: `CompatibilityStatusCard`, `ApiTokenList`, `AutomationExamplePanel`.
- Required API: `GET /api/projects/:projectId/tokens`, `POST /api/projects/:projectId/tokens`, `DELETE /api/projects/:projectId/tokens/:tokenId`.
- Required states: no token, token expired, insufficient scope.

## F) Activity and Notifications

### Screen: Project Activity Feed
- Route: `/projects/:projectId/activity`
- Purpose: show project-wide audit/activity events in a human-readable timeline.
- Primary user actions: filter by actor/entity/event, open related object.
- Main components: `ActivityFeed`, `ActivityFilterBar`, `ActivityEntityLink`.
- Required API: `GET /api/projects/:projectId/activity`.
- Required states: cursor pagination loading, no activity, permission denied.

### Screen: Notification Inbox
- Route: `/notifications`
- Purpose: show assignment, failed-result, and project activity notifications across projects.
- Primary user actions: mark read, open target, filter unread.
- Main components: `NotificationInbox`, `NotificationFilterTabs`, `NotificationPreferenceLink`.
- Required API: `GET /api/notifications`, `PATCH /api/notifications/:notificationId/read`, `PATCH /api/notifications/preferences`.
- Required states: no notifications, stale target deleted, preference update failed.

## Cross-Screen Performance Rules
- Case/run/result lists must be paginated and filterable.
- Expensive children such as steps, attachments, result history, and defect links load on row expansion or drawer open.
- Result entry updates the active test instance and summary counters optimistically, then revalidates the active run only.
- Realtime events should invalidate scoped queries. They must not force a full project reload.
- Report screens may use cached/materialized summaries, but detail drill-down must link back to canonical append-only records.
