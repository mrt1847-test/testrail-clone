import { Navigate, Route, Routes } from "react-router-dom";

import { LoginPage } from "./features/auth/components/LoginPage";
import { RequireAuth } from "./features/auth/components/RequireAuth";
import { CaseDetailPage } from "./features/cases/components/CaseDetailPage";
import { SharedStepsPage } from "./features/cases/components/SharedStepsPage";
import { TestCaseWorkspacePage } from "./features/cases/components/TestCaseWorkspacePage";
import { AutomationPage } from "./features/projects/components/AutomationPage";
import { ActivityPage } from "./features/projects/components/ActivityPage";
import { ProjectLayout } from "./features/projects/components/ProjectLayout";
import { ProjectListPage } from "./features/projects/components/ProjectListPage";
import { ProjectLandingPage } from "./features/projects/components/ProjectLandingPage";
import { ProjectSettingsPage } from "./features/projects/components/ProjectSettingsPage";
import { ReportCaseActivitySummaryPage } from "./features/projects/components/reports/ReportCaseActivitySummaryPage";
import { ReportCasePropertyDistributionPage } from "./features/projects/components/reports/ReportCasePropertyDistributionPage";
import { ReportCoverageGapPage } from "./features/projects/components/reports/ReportCoverageGapPage";
import { ReportDefectCoveragePage } from "./features/projects/components/reports/ReportDefectCoveragePage";
import { ReportDefectSummaryPage } from "./features/projects/components/reports/ReportDefectSummaryPage";
import { ReportRefsComparisonPage } from "./features/projects/components/reports/ReportRefsComparisonPage";
import { ReportRefsCoveragePage } from "./features/projects/components/reports/ReportRefsCoveragePage";
import { ReportRefsDefectSummaryPage } from "./features/projects/components/reports/ReportRefsDefectSummaryPage";
import { ReportResultsCaseComparisonPage } from "./features/projects/components/reports/ReportResultsCaseComparisonPage";
import { ReportResultsPropertyDistributionPage } from "./features/projects/components/reports/ReportResultsPropertyDistributionPage";
import { ReportResultsExplorerPage } from "./features/projects/components/reports/ReportResultsExplorerPage";
import { ReportMilestoneSummaryPage } from "./features/projects/components/reports/ReportMilestoneSummaryPage";
import { ReportPlanSummaryPage } from "./features/projects/components/reports/ReportPlanSummaryPage";
import { ReportProjectSummaryPage } from "./features/projects/components/reports/ReportProjectSummaryPage";
import { ReportRunSummaryPage } from "./features/projects/components/reports/ReportRunSummaryPage";
import { ReportUsersWorkloadSummaryPage } from "./features/projects/components/reports/ReportUsersWorkloadSummaryPage";
import { ReportStatusTopsPage } from "./features/projects/components/reports/ReportStatusTopsPage";
import { ReportTraceabilityPage } from "./features/projects/components/reports/ReportTraceabilityPage";
import { ReportsLayout } from "./features/projects/components/reports/ReportsLayout";
import { ReportOperationsPage } from "./features/projects/components/reports/ReportOperationsPage";
import { ReportsOverviewPage } from "./features/projects/components/reports/ReportsOverviewPage";
import { BulkUploadDetailPage } from "./features/projects/components/BulkUploadDetailPage";
import { AuditLogsPage } from "./features/projects/components/AuditLogsPage";
import { CaseTemplatesPage } from "./features/projects/components/CaseTemplatesPage";
import { CustomFieldsPage } from "./features/projects/components/CustomFieldsPage";
import { CustomStatusesPage } from "./features/projects/components/CustomStatusesPage";
import { MilestonesPage } from "./features/projects/components/MilestonesPage";
import { MilestoneDetailPage } from "./features/projects/components/MilestoneDetailPage";
import { PlansPage } from "./features/projects/components/PlansPage";
import { PlanDetailPage } from "./features/projects/components/PlanDetailPage";
import { TokensPage } from "./features/projects/components/TokensPage";
import { ApiDocsPage } from "./features/projects/components/ApiDocsPage";
import { WebhooksPage } from "./features/projects/components/WebhooksPage";
import { EmailOutboxPage } from "./features/projects/components/EmailOutboxPage";
import { ProjectMembersPage } from "./features/projects/components/ProjectMembersPage";
import { DefectIntegrationSettingsPage } from "./features/projects/components/DefectIntegrationSettingsPage";
import { ImportExportPage } from "./features/projects/components/ImportExportPage";
import { NotificationsPage } from "./features/projects/components/NotificationsPage";
import { RunComparisonPage } from "./features/runs/components/RunComparisonPage";
import { RunCreatePage } from "./features/runs/components/RunCreatePage";
import { RunDetailPage } from "./features/runs/components/RunDetailPage";
import { RunListPage } from "./features/runs/components/RunListPage";
import { ResultExplorerPage } from "./features/runs/components/ResultExplorerPage";
import { MyTestsPage } from "./features/runs/components/MyTestsPage";
import { TeamTodoPage } from "./features/runs/components/TeamTodoPage";
import { AdminAccessDefaultsPage } from "./features/admin/components/AdminAccessDefaultsPage";
import { AdminUsersPage } from "./features/admin/components/AdminUsersPage";
import { ProjectCustomRolesPage } from "./features/projects/components/ProjectCustomRolesPage";
import { CasePrintPage } from "./features/print/components/CasePrintPage";
import { CasesPrintPage } from "./features/print/components/CasesPrintPage";
import { MilestonePrintPage } from "./features/print/components/MilestonePrintPage";
import { PlanPrintPage } from "./features/print/components/PlanPrintPage";
import { ReportPrintPage } from "./features/print/components/ReportPrintPage";
import { RunPrintPage } from "./features/print/components/RunPrintPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/projects" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="projects/:projectId/cases/print" element={<CasesPrintPage />} />
        <Route path="projects/:projectId/cases/:caseId/print" element={<CasePrintPage />} />
        <Route path="projects/:projectId/runs/:runId/print" element={<RunPrintPage />} />
        <Route path="projects/:projectId/plans/:planId/print" element={<PlanPrintPage />} />
        <Route path="projects/:projectId/milestones/:milestoneId/print" element={<MilestonePrintPage />} />
        <Route path="/projects" element={<ProjectListPage />} />
        <Route path="/admin/access-defaults" element={<AdminAccessDefaultsPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/projects/:projectId" element={<ProjectLayout />}>
          <Route index element={<ProjectLandingPage />} />
          <Route path="cases" element={<TestCaseWorkspacePage />} />
          <Route path="cases/:caseId" element={<CaseDetailPage />} />
          <Route path="shared-steps" element={<SharedStepsPage />} />
          <Route path="runs" element={<RunListPage />} />
          <Route path="runs/compare" element={<RunComparisonPage />} />
          <Route path="runs/new" element={<RunCreatePage />} />
          <Route path="runs/:runId" element={<RunDetailPage />} />
          <Route path="runs/:runId/results" element={<ResultExplorerPage />} />
          <Route path="my-tests" element={<MyTestsPage />} />
          <Route path="team-todo" element={<TeamTodoPage />} />
          <Route path="results" element={<ResultExplorerPage />} />
          <Route path="reports/print/:reportSlug" element={<ReportPrintPage />} />
          <Route path="reports" element={<ReportsLayout />}>
            <Route index element={<ReportsOverviewPage />} />
            <Route path="project-summary" element={<ReportProjectSummaryPage />} />
            <Route path="users-workload" element={<ReportUsersWorkloadSummaryPage />} />
            <Route path="runs" element={<ReportRunSummaryPage />} />
            <Route path="milestones" element={<ReportMilestoneSummaryPage />} />
            <Route path="plans" element={<ReportPlanSummaryPage />} />
            <Route path="traceability" element={<ReportTraceabilityPage />} />
            <Route path="coverage" element={<ReportCoverageGapPage />} />
            <Route path="case-activity" element={<ReportCaseActivitySummaryPage />} />
            <Route path="case-properties" element={<ReportCasePropertyDistributionPage />} />
            <Route path="status-tops" element={<ReportStatusTopsPage />} />
            <Route path="refs-coverage" element={<ReportRefsCoveragePage />} />
            <Route path="refs-comparison" element={<ReportRefsComparisonPage />} />
            <Route path="refs-defects" element={<ReportRefsDefectSummaryPage />} />
            <Route path="results-comparison" element={<ReportResultsCaseComparisonPage />} />
            <Route path="results-properties" element={<ReportResultsPropertyDistributionPage />} />
            <Route path="defects" element={<ReportDefectCoveragePage />} />
            <Route path="defect-summary" element={<ReportDefectSummaryPage />} />
            <Route path="explorer" element={<ReportResultsExplorerPage />} />
            <Route path="saved" element={<ReportOperationsPage />} />
          </Route>
          <Route path="activity" element={<ActivityPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="automation" element={<AutomationPage />} />
          <Route path="automation/uploads/:uploadId" element={<BulkUploadDetailPage />} />
          <Route path="import-export" element={<ImportExportPage />} />
          <Route path="milestones" element={<MilestonesPage />} />
          <Route path="milestones/:milestoneId" element={<MilestoneDetailPage />} />
          <Route path="plans" element={<PlansPage />} />
          <Route path="plans/:planId" element={<PlanDetailPage />} />
          <Route path="settings" element={<ProjectSettingsPage />} />
          <Route path="settings/tokens" element={<TokensPage />} />
          <Route path="settings/api-docs" element={<ApiDocsPage />} />
          <Route path="settings/members" element={<ProjectMembersPage />} />
          <Route path="settings/custom-roles" element={<ProjectCustomRolesPage />} />
          <Route path="settings/custom-fields" element={<CustomFieldsPage />} />
          <Route path="settings/statuses" element={<CustomStatusesPage />} />
          <Route path="settings/templates" element={<CaseTemplatesPage />} />
          <Route path="settings/webhooks" element={<WebhooksPage />} />
          <Route path="settings/email-outbox" element={<EmailOutboxPage />} />
          <Route path="settings/defect-integration" element={<DefectIntegrationSettingsPage />} />
          <Route path="settings/audit-logs" element={<AuditLogsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}
