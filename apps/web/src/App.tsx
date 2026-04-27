import { Navigate, Route, Routes } from "react-router-dom";

import { LoginPage } from "./features/auth/components/LoginPage";
import { RequireAuth } from "./features/auth/components/RequireAuth";
import { TestCaseWorkspacePage } from "./features/cases/components/TestCaseWorkspacePage";
import { AutomationPage } from "./features/projects/components/AutomationPage";
import { ProjectLayout } from "./features/projects/components/ProjectLayout";
import { ProjectListPage } from "./features/projects/components/ProjectListPage";
import { ProjectOverviewPage } from "./features/projects/components/ProjectOverviewPage";
import { ProjectSettingsPage } from "./features/projects/components/ProjectSettingsPage";
import { ReportsPage } from "./features/projects/components/ReportsPage";
import { BulkUploadDetailPage } from "./features/projects/components/BulkUploadDetailPage";
import { AuditLogsPage } from "./features/projects/components/AuditLogsPage";
import { CustomFieldsPage } from "./features/projects/components/CustomFieldsPage";
import { MilestonesPage } from "./features/projects/components/MilestonesPage";
import { MilestoneDetailPage } from "./features/projects/components/MilestoneDetailPage";
import { PlansPage } from "./features/projects/components/PlansPage";
import { PlanDetailPage } from "./features/projects/components/PlanDetailPage";
import { TokensPage } from "./features/projects/components/TokensPage";
import { WebhooksPage } from "./features/projects/components/WebhooksPage";
import { ProjectMembersPage } from "./features/projects/components/ProjectMembersPage";
import { RunCreatePage } from "./features/runs/components/RunCreatePage";
import { RunDetailPage } from "./features/runs/components/RunDetailPage";
import { RunListPage } from "./features/runs/components/RunListPage";
import { ResultExplorerPage } from "./features/runs/components/ResultExplorerPage";

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
          <Route path="runs" element={<RunListPage />} />
          <Route path="runs/new" element={<RunCreatePage />} />
          <Route path="runs/:runId" element={<RunDetailPage />} />
          <Route path="runs/:runId/results" element={<ResultExplorerPage />} />
          <Route path="results" element={<ResultExplorerPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="automation" element={<AutomationPage />} />
          <Route path="automation/uploads/:uploadId" element={<BulkUploadDetailPage />} />
          <Route path="milestones" element={<MilestonesPage />} />
          <Route path="milestones/:milestoneId" element={<MilestoneDetailPage />} />
          <Route path="plans" element={<PlansPage />} />
          <Route path="plans/:planId" element={<PlanDetailPage />} />
          <Route path="settings" element={<ProjectSettingsPage />} />
          <Route path="settings/tokens" element={<TokensPage />} />
          <Route path="settings/members" element={<ProjectMembersPage />} />
          <Route path="settings/custom-fields" element={<CustomFieldsPage />} />
          <Route path="settings/webhooks" element={<WebhooksPage />} />
          <Route path="settings/audit-logs" element={<AuditLogsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}
