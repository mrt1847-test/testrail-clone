# Route Map

## Route Hierarchy

```text
/
├─ /login
│  └─ LoginPage
├─ /projects
│  ├─ ProjectListPage
│  └─ ProjectCreateDialog (modal)
└─ /projects/:projectId/*
   ├─ ProjectLayout (AppShell, ProjectHeader, ProjectTabs, ProjectSwitcher, Breadcrumb)
   ├─ /projects/:projectId
   │  └─ ProjectOverview
   ├─ /projects/:projectId/cases
   │  └─ TestCaseWorkspace
   │     ├─ CaseListPane
   │     │  ├─ CaseListToolbar
   │     │  ├─ CaseListTable
   │     │  ├─ CaseRow
   │     │  └─ ExpandableCaseDetail (in-row)
   │     └─ SectionTreePane
   ├─ /projects/:projectId/runs
   │  └─ RunList
   ├─ /projects/:projectId/my-tests
   │  └─ MyTestsPage
   ├─ /projects/:projectId/runs/new
   │  └─ RunCreate
   ├─ /projects/:projectId/runs/:runId
   │  └─ RunDetailPage
   ├─ /projects/:projectId/runs/:runId/results
   │  └─ RunResultExplorer
   ├─ /projects/:projectId/results
   │  └─ ProjectResultExplorer
   ├─ /projects/:projectId/milestones
   │  └─ MilestoneList
   ├─ /projects/:projectId/milestones/:milestoneId
   │  └─ MilestoneDetail
   ├─ /projects/:projectId/plans
   │  └─ TestPlanList
   ├─ /projects/:projectId/plans/:planId
   │  └─ TestPlanDetail
   ├─ /projects/:projectId/automation
   │  └─ AutomationDashboard
   ├─ /projects/:projectId/automation/uploads/:uploadId
   │  └─ BulkUploadResultDetail
   ├─ /projects/:projectId/settings
   │  └─ ProjectSettingsPage
   ├─ /projects/:projectId/settings/tokens
   │  └─ ApiTokenList
   ├─ /projects/:projectId/settings/members
   │  └─ MemberManagement
   ├─ /projects/:projectId/settings/custom-fields
   │  └─ CustomFieldSettings
   ├─ /projects/:projectId/settings/webhooks
   │  └─ WebhookSettings
   ├─ /projects/:projectId/settings/audit-logs
   │  └─ AuditLogTable
   ├─ /projects/:projectId/settings/statuses
   │  └─ CustomStatusSettings
   ├─ /projects/:projectId/settings/templates
   │  └─ CaseTemplateSettings
   ├─ /projects/:projectId/settings/integrations
   │  └─ IntegrationSettings
   ├─ /projects/:projectId/settings/notifications
   │  └─ NotificationSettings
   └─ /projects/:projectId/reports
      └─ ReportsDashboard
```

## Query State Policy

### Cases Route Query
- `sectionId`: 선택된 섹션 컨텍스트
- `caseId`: 펼쳐진 케이스 식별자(`expandedCaseId`와 동기화)
- `mode`: 상세 패널 모드(`view` | `edit`)

### Examples
- `/projects/1/cases?sectionId=10`
- `/projects/1/cases?sectionId=10&caseId=101`
- `/projects/1/cases?sectionId=10&caseId=101&mode=edit`

## Navigation Rules

- `/projects/:projectId/*` 하위 라우트는 공통 `ProjectLayout`을 사용한다.
- 케이스 상세는 별도 페이지로 라우팅하지 않고 `CaseRow` 확장 상태로 처리한다.
- `caseId` 없는 `/cases` 진입 시 기본 목록 모드로 렌더링한다.
- 쿼리의 `caseId`가 현재 필터/섹션 결과에 없으면 확장 상태를 초기화한다.
- 인증되지 않은 사용자는 `/login`으로 리다이렉트한다.

## Route-to-Screen Mapping

이 문서는 route tree와 navigation/query rule만 canonical로 다룬다.

- 화면별 required API는 `SCREEN_INVENTORY.md`를 참조한다.
- endpoint 계약은 `API_SPEC.md`를 참조한다.
- 컴포넌트 책임은 `COMPONENT_MAP.md`를 참조한다.

### Primary Mapping
- `/login` -> `LoginPage`
- `/projects` -> `Project Selection`
- `/projects/:projectId` -> `Project Overview`
- `/projects/:projectId/cases` -> `Test Case Workspace`
- `/projects/:projectId/runs` -> `Test Run List`
- `/projects/:projectId/runs/new` -> `Test Run Create`
- `/projects/:projectId/my-tests` -> `My Tests`
- `/projects/:projectId/runs/:runId` -> `Run Detail`
- `/projects/:projectId/runs/:runId/results` -> `Run Result History`
- `/projects/:projectId/results` -> `Project-wide Result Explorer`
- `/projects/:projectId/milestones` -> `Milestone List`
- `/projects/:projectId/milestones/:milestoneId` -> `Milestone Detail`
- `/projects/:projectId/plans` -> `Test Plan List`
- `/projects/:projectId/plans/:planId` -> `Test Plan Detail`
- `/projects/:projectId/automation` -> `Automation Dashboard`
- `/projects/:projectId/automation/uploads/:uploadId` -> `Bulk Upload Result Detail`
- `/projects/:projectId/settings/*` -> `Project Settings` category screens
- `/projects/:projectId/reports` -> `Reports`

## MVP Route Set

- `/projects`
- `/projects/:projectId`
- `/projects/:projectId/cases`
- `/projects/:projectId/runs`
- `/projects/:projectId/runs/new`
- `/projects/:projectId/runs/:runId`
- `/projects/:projectId/settings`

## First Complete Route Set (Automation + Tokens + Basic Reports)

- `/projects/:projectId/automation`
- `/projects/:projectId/automation/uploads/:uploadId`
- `/projects/:projectId/settings/tokens`
- `/projects/:projectId/reports`

## Later Route Set

- `/projects/:projectId/milestones`
- `/projects/:projectId/milestones/:milestoneId`
- `/projects/:projectId/plans`
- `/projects/:projectId/plans/:planId`
- `/projects/:projectId/results`
- `/projects/:projectId/settings/members`
- `/projects/:projectId/settings/custom-fields`
- `/projects/:projectId/settings/webhooks`
- `/projects/:projectId/settings/audit-logs`
