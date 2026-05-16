import { Navigate, Route, Routes } from "react-router-dom";

import { LoginPage } from "./features/auth/components/LoginPage";
import { RequireAuth } from "./features/auth/components/RequireAuth";
import { CaseDetailPage } from "./features/cases/components/CaseDetailPage";
import { TestCaseWorkspacePage } from "./features/cases/components/TestCaseWorkspacePage";
import { AutomationPage } from "./features/projects/components/AutomationPage";
import { ActivityPage } from "./features/projects/components/ActivityPage";
import { ProjectLayout } from "./features/projects/components/ProjectLayout";
import { ProjectListPage } from "./features/projects/components/ProjectListPage";
import { ProjectOverviewPage } from "./features/projects/components/ProjectOverviewPage";
import { ProjectSettingsPage } from "./features/projects/components/ProjectSettingsPage";
import { ReportCoverageGapPage } from "./features/projects/components/reports/ReportCoverageGapPage";
import { ReportDefectCoveragePage } from "./features/projects/components/reports/ReportDefectCoveragePage";
import { ReportResultsExplorerPage } from "./features/projects/components/reports/ReportResultsExplorerPage";
import { ReportMilestoneSummaryPage } from "./features/projects/components/reports/ReportMilestoneSummaryPage";
import { ReportPlanSummaryPage } from "./features/projects/components/reports/ReportPlanSummaryPage";
import { ReportRunSummaryPage } from "./features/projects/components/reports/ReportRunSummaryPage";
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
import { WebhooksPage } from "./features/projects/components/WebhooksPage";
import { EmailOutboxPage } from "./features/projects/components/EmailOutboxPage";
import { ProjectMembersPage } from "./features/projects/components/ProjectMembersPage";
import { DefectIntegrationSettingsPage } from "./features/projects/components/DefectIntegrationSettingsPage";
import { ImportExportPage } from "./features/projects/components/ImportExportPage";
import { NotificationsPage } from "./features/projects/components/NotificationsPage";
import { RunCreatePage } from "./features/runs/components/RunCreatePage";
import { RunDetailPage } from "./features/runs/components/RunDetailPage";
import { RunListPage } from "./features/runs/components/RunListPage";
import { ResultExplorerPage } from "./features/runs/components/ResultExplorerPage";
import { MyTestsPage } from "./features/runs/components/MyTestsPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/projects" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/projects" element={<ProjectListPage />} />
        <Route path="/projects/:projectId" element={<ProjectLayout />}>
          <Route index element={<ProjectOverviewPage />} />
          <Route path="cases" element={<TestCaseWorkspacePage />} />
          <Route path="cases/:caseId" element={<CaseDetailPage />} />
          <Route path="runs" element={<RunListPage />} />
          <Route path="runs/new" element={<RunCreatePage />} />
          <Route path="runs/:runId" element={<RunDetailPage />} />
          <Route path="runs/:runId/results" element={<ResultExplorerPage />} />
          <Route path="my-tests" element={<MyTestsPage />} />
          <Route path="results" element={<ResultExplorerPage />} />
          <Route path="reports" element={<ReportsLayout />}>
            <Route index element={<ReportsOverviewPage />} />
            <Route path="runs" element={<ReportRunSummaryPage />} />
            <Route path="milestones" element={<ReportMilestoneSummaryPage />} />
            <Route path="plans" element={<ReportPlanSummaryPage />} />
            <Route path="traceability" element={<ReportTraceabilityPage />} />
            <Route path="coverage" element={<ReportCoverageGapPage />} />
            <Route path="defects" element={<ReportDefectCoveragePage />} />
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
          <Route path="settings/members" element={<ProjectMembersPage />} />
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
