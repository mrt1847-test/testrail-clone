# Route Map

## Route Hierarchy

```text
/
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

## Route-to-API Dependency

- `/projects` -> `GET /projects`, `POST /projects`
- `/projects/:projectId` -> `GET /projects/:projectId/overview`
- `/projects/:projectId/cases` -> cases/sections CRUD + case detail API
- `/projects/:projectId/milestones` -> milestone list/create/update API
- `/projects/:projectId/milestones/:milestoneId` -> milestone detail/run summary API
- `/projects/:projectId/plans` -> plan list/create API
- `/projects/:projectId/plans/:planId` -> plan detail/entries API
- `/projects/:projectId/runs` -> run list API
- `/projects/:projectId/runs/new` -> suites/cases/milestones + create run API
- `/projects/:projectId/runs/:runId` -> run detail, instance list, result write API
- `/projects/:projectId/runs/:runId/results` -> run scoped results API
- `/projects/:projectId/results` -> project scoped result explorer API
- `/projects/:projectId/automation` -> mapping/upload history API
- `/projects/:projectId/automation/uploads/:uploadId` -> upload detail API
- `/projects/:projectId/settings*` -> settings/tokens/members API
- `/projects/:projectId/reports` -> report aggregate APIs

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
