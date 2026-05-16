# Route Map

Last aligned: 2026-04-30

This document tracks the actual frontend route tree in `apps/web/src/App.tsx`.

## Route Hierarchy

```text
/
  -> /projects

/login
  LoginPage

/projects
  ProjectListPage

/projects/:projectId
  ProjectLayout
  index                              ProjectOverviewPage
  cases                              TestCaseWorkspacePage
  cases/:caseId                      CaseDetailPage
  runs                               RunListPage
  runs/new                           RunCreatePage
  runs/:runId                        RunDetailPage
  runs/:runId/results                ResultExplorerPage
  my-tests                           MyTestsPage
  results                            ResultExplorerPage
  reports                            ReportsPage
  activity                           ActivityPage
  notifications                      NotificationsPage
  automation                         AutomationPage
  automation/uploads/:uploadId       BulkUploadDetailPage
  import-export                      ImportExportPage
  milestones                         MilestonesPage
  milestones/:milestoneId            MilestoneDetailPage
  plans                              PlansPage
  plans/:planId                      PlanDetailPage
  settings                           ProjectSettingsPage
  settings/tokens                    TokensPage
  settings/members                   ProjectMembersPage
  settings/custom-fields             CustomFieldsPage
  settings/statuses                  CustomStatusesPage
  settings/templates                 CaseTemplatesPage
  settings/webhooks                  WebhooksPage
  settings/defect-integration        DefectIntegrationSettingsPage
  settings/audit-logs                AuditLogsPage
```

Unknown routes redirect to `/projects`.

## Navigation Rules

- All `/projects/:projectId/*` routes render inside `ProjectLayout`.
- Unauthenticated users are redirected through `RequireAuth`.
- Case details open at `/projects/:projectId/cases/:caseId` (read-only page + `?mode=edit` drawer). Legacy `?caseId=` on the workspace redirects to the detail route.
- Project-wide result exploration uses `/projects/:projectId/results`.
- Run-scoped result exploration uses `/projects/:projectId/runs/:runId/results`.
- Project activity feed uses `/projects/:projectId/activity`.
- Notification inbox and preferences use `/projects/:projectId/notifications`.
- Defect integration is currently routed at `/settings/defect-integration`, not `/settings/integrations`.

## Query State Policy

### Cases

- `sectionId`: selected section context.
- `sectionId`: selected section on the workspace list.

Examples:

- `/projects/1/cases?sectionId=10`
- `/projects/1/cases/101?sectionId=10`
- `/projects/1/cases/101?sectionId=10&mode=edit`

## Related Docs

- Screen behavior: [SCREEN_INVENTORY.md](./SCREEN_INVENTORY.md)
- API contracts: [API_SPEC.md](./API_SPEC.md)
- Component ownership: [COMPONENT_MAP.md](./COMPONENT_MAP.md)
