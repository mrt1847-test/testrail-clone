import { Navigate, Route, Routes } from "react-router-dom";

import { TestCaseWorkspacePage } from "./features/cases/components/TestCaseWorkspacePage";
import { AutomationPage } from "./features/projects/components/AutomationPage";
import { ProjectLayout } from "./features/projects/components/ProjectLayout";
import { ProjectListPage } from "./features/projects/components/ProjectListPage";
import { ProjectOverviewPage } from "./features/projects/components/ProjectOverviewPage";
import { ProjectSettingsPage } from "./features/projects/components/ProjectSettingsPage";
import { ReportsPage } from "./features/projects/components/ReportsPage";
import { TokensPage } from "./features/projects/components/TokensPage";
import { RunCreatePage } from "./features/runs/components/RunCreatePage";
import { RunDetailPage } from "./features/runs/components/RunDetailPage";
import { RunListPage } from "./features/runs/components/RunListPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/projects" replace />} />
      <Route path="/projects" element={<ProjectListPage />} />
      <Route path="/projects/:projectId" element={<ProjectLayout />}>
        <Route index element={<ProjectOverviewPage />} />
        <Route path="cases" element={<TestCaseWorkspacePage />} />
        <Route path="runs" element={<RunListPage />} />
        <Route path="runs/new" element={<RunCreatePage />} />
        <Route path="runs/:runId" element={<RunDetailPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="automation" element={<AutomationPage />} />
        <Route path="settings" element={<ProjectSettingsPage />} />
        <Route path="settings/tokens" element={<TokensPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}
