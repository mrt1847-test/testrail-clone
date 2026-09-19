import { useParams } from "react-router-dom";

import { Button, OverflowMenu, SaveFeedback, WorkbenchPage, WorkbenchPageHeader } from "../../../shared/ui";
import { PROJECT_TYPE_LABELS } from "../types/projectTypes";
import { useArchiveProjectMutation, useProjectQuery, useRestoreProjectMutation } from "../hooks/useProjectsApi";
import { SETTINGS_ADMIN_MENU_LABEL, settingsAdminMenuGroups } from "../utils/settingsHeaderMenu";
import { ThemePreferencesSection } from "./ThemePreferencesSection";
import { WorkspacePreferencesPanel } from "./WorkspacePreferencesPanel";

export function ProjectSettingsPage() {
  const { projectId = "" } = useParams();
  const projectQuery = useProjectQuery(projectId);
  const archiveMutation = useArchiveProjectMutation(projectId);
  const restoreMutation = useRestoreProjectMutation(projectId);
  const project = projectQuery.data;
  const isArchived = Boolean(project?.isArchived);
  const isBusy = archiveMutation.isPending || restoreMutation.isPending;
  const archiveStatus = archiveMutation.isPending
    ? "saving"
    : archiveMutation.isError
      ? "failed"
      : "idle";
  const restoreStatus = restoreMutation.isPending
    ? "saving"
    : restoreMutation.isError
      ? "failed"
      : "idle";

  return (
    <WorkbenchPage>
      <WorkbenchPageHeader
        title="Project settings"
        description={project ? `Type: ${PROJECT_TYPE_LABELS[project.projectType]}` : undefined}
        utilityAction={
          projectId ? (
            <OverflowMenu label={SETTINGS_ADMIN_MENU_LABEL} groups={settingsAdminMenuGroups(projectId)} />
          ) : undefined
        }
      />

      <ThemePreferencesSection />
      <WorkspacePreferencesPanel projectId={projectId} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Archive</h2>
        {isArchived ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">
              Archived · read-only
            </span>
            <Button
              type="button"
              variant="secondary"
              disabled={isBusy}
              loading={restoreMutation.isPending}
              onClick={() => void restoreMutation.mutateAsync()}
            >
              Restore project
            </Button>
            <SaveFeedback
              status={restoreStatus}
              message={restoreStatus === "failed" ? "Could not restore project." : undefined}
              onRetry={() => void restoreMutation.mutateAsync()}
            />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={isBusy || !project}
              loading={archiveMutation.isPending}
              onClick={() => void archiveMutation.mutateAsync()}
            >
              Archive project
            </Button>
            <SaveFeedback
              status={archiveStatus}
              message={archiveStatus === "failed" ? "Could not archive project." : undefined}
              onRetry={() => void archiveMutation.mutateAsync()}
            />
          </div>
        )}
      </section>
    </WorkbenchPage>
  );
}
