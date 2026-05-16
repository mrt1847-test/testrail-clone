# Component Map

Last aligned: 2026-05-06

## Intent

This document tracks component ownership and implementation status. Screen requirements live in [SCREEN_INVENTORY.md](./SCREEN_INVENTORY.md); route facts live in [ROUTE_MAP.md](./ROUTE_MAP.md).

Status legend:

- `implemented`: present in the current codebase.
- `partial`: present but still too broad, shallow, or missing expected subflows.
- `planned`: not yet implemented as a dedicated component.

## Shared And Shell

- `implemented`: `ProjectLayout`, `EmptyState`, `LoadingState`, `ErrorState`, `ConfirmDialog`.
- `partial`: project tabs/navigation and breadcrumbs are embedded in `ProjectLayout`.
- `planned`: `Button`, `StatusBadge`, `DataTable`, reusable `FilterBar`, reusable `PaginationControls`.

## Auth And Projects

- `implemented`: `LoginPage`, `RequireAuth`, `AuthContext`, `ProjectListPage`, `ProjectCard`, `ProjectCreateDialog`, `ProjectEmptyState`, `ProjectOverviewPage`, `ProjectSummaryCards`, `RecentRunList`, `RecentFailureTable`, `RecentResultList`, `AutomationCoverageCard`.
- `planned`: narrower login form component, project switcher primitive.

## Cases

- `implemented`: `TestCaseWorkspacePage`, `TestCaseWorkspace`, `CaseDetailPage`, `CaseEditDrawer`, `CaseListPane`, `CaseListToolbar`, `CaseRow`, `ExpandableCaseDetail`, `SectionTreePane`, `useCases`, `useCaseDetail`, `useCaseEditorActions`, `useExpandedCase`, `useSections`.
- `partial`: case custom field rendering and version snapshot inclusion exist; compare/restore UI is still missing.
- `planned`: `CaseVersionHistoryPanel`, `CaseVersionCompareView`, `CaseRestoreDialog`, reusable section CRUD dialogs.

## Runs And Results

- `implemented`: `RunListPage`, `RunCreatePage`, `RunDetailPage`, `RunHeader`, `RunSummaryBar`, `RunInstancesSection`, `TestInstanceFilterBar`, `TestInstanceTable`, `CloseRunDialog`, `ResultEntryPanel`, `ResultHistoryList`, `ResultExplorerPage`, `MyTestsPage`, `StepResultEditor`.
- `partial`: attachment and defect workflows exist in run detail; `RunDetailPage` still composes dialogs, result entry, and actions.
- `planned`: reusable `StatusPicker`, `ResultMetadataFields`, `EvidenceQuickAttach`, `DefectQuickLink`, dedicated `RerunDialog` component (rerun still inline confirm on run detail).

## Milestones And Plans

- `implemented`: `MilestonesPage`, `MilestoneDetailPage`, `PlansPage`, `PlanDetailPage`.
- `partial`: matrix preview, run-by-configuration, and rollup binding exist but need richer UX and reporting semantics.
- `planned`: `MilestoneProgressChart`, `PlanMatrixBuilder`, `PlanRollupTable`, `CreatePlanRunDialog`.

## Automation And Import/Export

- `implemented`: `AutomationPage`, `BulkUploadDetailPage`, `TokensPage`, `ImportExportPage`.
- `partial`: upload history, retry, token management, CSV import/export, and report export baselines exist.
- `planned`: `AutomationMappingEditor`, `UploadFailureTable`, `ImportDryRunReview`, `ExportJobHistory`.

## Settings

- `implemented`: `ProjectSettingsPage`, `ProjectMembersPage`, `CustomFieldsPage`, `CustomStatusesPage`, `CaseTemplatesPage`, `WebhooksPage`, `DefectIntegrationSettingsPage`, `AuditLogsPage`.
- `partial`: webhook settings are subscription/admin UI only; delivery attempts and retry history are still planned.
- `planned`: notification preferences and inbox settings.

## Reports

- `implemented`: `ReportsPage`, overview widgets, `ReportChrome` (`ReportPageHeader`, `ReportSummaryStrip`, `ReportTablePanel`), nested report pages (`ReportRunSummaryPage`, `ReportTraceabilityPage`, `ReportCoverageGapPage`, `ReportDefectCoveragePage`, `ReportResultsExplorerPage`).
- `partial`: drilldown pages now share summary strips and headers; export jobs exist; interactive filter bars and charts still thin.
- `planned`: reusable `ReportFilterBar`, richer `TraceabilityMatrix` / table primitives, `ReportExportMenu`, saved/scheduled report components.

## Activity And Notifications

- `implemented`: `ActivityPage`, `NotificationsPage`, project shell inbox link with unread count.
- `partial`: event persistence, activity feed API, notification inbox API, and preference toggles exist as baseline.
- `planned`: richer event coverage, drilldown links, delivery jobs, digest/email delivery, and more granular targeting.
