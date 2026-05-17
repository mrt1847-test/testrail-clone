import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { fetchCaseTemplates, fetchCustomFieldsForUse } from "../../projects/api/settingsApi";
import { fetchCaseVersions } from "../api/catalogApi";
import { buildCaseListPath } from "../caseRoute";
import { useCaseDetail } from "../hooks/useCaseDetail";
import { useCaseEditorActions } from "../hooks/useCaseEditorActions";
import { CaseEditDrawer } from "./CaseEditDrawer";
import { ExpandableCaseDetail } from "./ExpandableCaseDetail";

function parseSectionId(value: string | null): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function CaseDetailPage() {
  const { projectId = "", caseId: caseIdParam = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const caseId = Number(caseIdParam);
  const sectionId = parseSectionId(searchParams.get("sectionId"));
  const isEditMode = searchParams.get("mode") === "edit";
  const listPath = buildCaseListPath(projectId, sectionId);

  const { data, isLoading, isError, refetch } = useCaseDetail(Number.isNaN(caseId) ? null : caseId);
  const editor = useCaseEditorActions(projectId);

  const { data: customFields = [] } = useQuery({
    queryKey: ["case-custom-fields", projectId, data?.caseTemplateId ?? null],
    queryFn: () =>
      fetchCustomFieldsForUse(
        projectId,
        "case",
        data?.caseTemplateId != null ? String(data.caseTemplateId) : null
      ),
    enabled: Boolean(projectId && data)
  });
  const { data: caseTemplates = [] } = useQuery({
    queryKey: ["case-templates", projectId],
    queryFn: () => fetchCaseTemplates(projectId),
    enabled: Boolean(projectId)
  });
  const caseVersionsQuery = useQuery({
    queryKey: ["case-versions", caseId],
    queryFn: () => fetchCaseVersions(caseId),
    enabled: !Number.isNaN(caseId)
  });

  const { clearEditErrors } = editor;

  useEffect(() => {
    clearEditErrors();
  }, [caseId, isEditMode, clearEditErrors]);

  const openEdit = () => {
    const next = new URLSearchParams(searchParams);
    next.set("mode", "edit");
    setSearchParams(next);
  };

  const closeEdit = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("mode");
    setSearchParams(next, { replace: true });
  };

  if (Number.isNaN(caseId)) {
    return <ErrorState title="Invalid case link" onRetry={() => navigate(listPath)} />;
  }

  if (isError) {
    return <ErrorState title="Could not load test case" onRetry={() => void refetch()} />;
  }

  if (isLoading || !data) {
    return <LoadingState message="Loading test case..." />;
  }

  const headerTitle = `${data.caseCode} ${data.title}`;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Test case"
        title={headerTitle}
        description={data.archivedAt ? `Archived on ${new Date(data.archivedAt).toLocaleString()}` : undefined}
        actions={
          <>
            <Link
              to={listPath}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to cases
            </Link>
            {!isEditMode ? (
              <button
                type="button"
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                onClick={openEdit}
              >
                Edit
              </button>
            ) : null}
          </>
        }
      />

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <ExpandableCaseDetail
          data={data}
          versions={caseVersionsQuery.data ?? []}
          customFields={customFields}
          caseTemplates={caseTemplates}
          mode="view"
          layout="page"
          showHeading={false}
          onEdit={openEdit}
          onClose={() => navigate(listPath)}
          onSave={async () => undefined}
          onDelete={async () => {
            await editor.deleteCaseMutation.mutateAsync(data.id);
            navigate(listPath);
          }}
          onRestoreVersion={async (versionId) => {
            await editor.restoreVersionMutation.mutateAsync({
              caseId: data.id,
              versionId,
              expectedVersion: Number.isInteger(data.lockVersion) ? data.lockVersion : undefined
            });
          }}
          isDeleting={editor.deleteCaseMutation.isPending}
          isRestoring={editor.restoreVersionMutation.isPending}
          restoreError={editor.restoreFormError}
        />
      </section>

      <CaseEditDrawer open={isEditMode} title={headerTitle} onClose={closeEdit}>
        <ExpandableCaseDetail
          data={data}
          versions={caseVersionsQuery.data ?? []}
          customFields={customFields}
          caseTemplates={caseTemplates}
          mode="edit"
          layout="page"
          showHeading={false}
          onEdit={openEdit}
          onClose={closeEdit}
          onSave={async (patch) => {
            await editor.updateCaseMutation.mutateAsync({
              caseId: data.id,
              ...patch,
              expectedVersion: Number.isInteger(data.lockVersion) ? data.lockVersion : undefined
            });
            closeEdit();
          }}
          onDelete={async () => {
            await editor.deleteCaseMutation.mutateAsync(data.id);
            navigate(listPath);
          }}
          isSaving={editor.updateCaseMutation.isPending}
          submitError={editor.editFormError}
          onCreateStep={async (input) => {
            await editor.createStepMutation.mutateAsync({ caseId: data.id, ...input });
          }}
          onUpdateStep={async (stepId, patch) => {
            await editor.updateStepMutation.mutateAsync({ caseId: data.id, stepId, patch });
          }}
          onDeleteStep={async (stepId) => {
            await editor.deleteStepMutation.mutateAsync({ caseId: data.id, stepId });
          }}
          isStepsBusy={editor.stepsBusy}
        />
      </CaseEditDrawer>
    </div>
  );
}
