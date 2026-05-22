# Route Map

Last aligned: 2026-05-22

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
  shared-steps                       SharedStepsPage
  runs                               RunListPage
  runs/compare                       RunComparisonPage
  runs/new                           RunCreatePage
  runs/:runId                        RunDetailPage
  runs/:runId/results                ResultExplorerPage
  my-tests                           MyTestsPage
  team-todo                          TeamTodoPage
  results                            ResultExplorerPage
  reports                            ReportsLayout
  reports/project-summary            ReportProjectSummaryPage
  reports/users-workload             ReportUsersWorkloadSummaryPage
  reports/runs                       ReportRunSummaryPage
  reports/milestones                 ReportMilestoneSummaryPage
  reports/plans                      ReportPlanSummaryPage
  reports/traceability               ReportTraceabilityPage
  reports/coverage                   ReportCoverageGapPage
  reports/case-activity              ReportCaseActivitySummaryPage
  reports/case-properties            ReportCasePropertyDistributionPage
  reports/status-tops                ReportStatusTopsPage
  reports/refs-coverage              ReportRefsCoveragePage
  reports/refs-comparison            ReportRefsComparisonPage
  reports/refs-defects               ReportRefsDefectSummaryPage
  reports/results-comparison         ReportResultsCaseComparisonPage
  reports/results-properties         ReportResultsPropertyDistributionPage
  reports/defects                    ReportDefectCoveragePage
  reports/defect-summary             ReportDefectSummaryPage
  reports/explorer                   ReportResultsExplorerPage
  reports/saved                      ReportOperationsPage
  reports/print/:reportSlug          ReportPrintPage
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
  settings/custom-roles              ProjectCustomRolesPage
  settings/custom-fields             CustomFieldsPage
  settings/statuses                  CustomStatusesPage
  settings/templates                 CaseTemplatesPage
  settings/webhooks                  WebhooksPage
  settings/email-outbox              EmailOutboxPage
  settings/defect-integration        DefectIntegrationSettingsPage
  settings/audit-logs                AuditLogsPage
```

Unknown routes redirect to `/projects`.

## Navigation Rules

- All `/projects/:projectId/*` routes render inside `ProjectLayout`.
- Primary project navigation exposes Overview, Test Cases, Test Runs & Results, Milestones, Test Plans, Reports, My Tests, and Settings directly; secondary project views stay under More.
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
