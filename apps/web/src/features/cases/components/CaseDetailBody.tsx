import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { fetchCaseTemplates, fetchCustomFieldsForUse } from "../../projects/api/settingsApi";
import { fetchCaseVersions } from "../api/catalogApi";
import { useRecordRecentlyViewed } from "../../projects/hooks/useRecordRecentlyViewed";
import { useCaseDetail } from "../hooks/useCaseDetail";
import { useCaseEditorActions } from "../hooks/useCaseEditorActions";
import { ExpandableCaseDetail } from "./ExpandableCaseDetail";

type Props = {
  projectId: string;
  caseId: number;
  layout: "page" | "panel";
  mode?: "view" | "edit";
  onClose: () => void;
  onDeleted: () => void;
  onDuplicated: (copiedCaseId: number) => void;
  onEdit?: () => void;
  onCancelEdit?: () => void;
  showHeading?: boolean;
};

export function CaseDetailBody({
  projectId,
  caseId,
  layout,
  mode = "view",
  onClose,
  onDeleted,
  onDuplicated,
  onEdit,
  onCancelEdit,
  showHeading
}: Props) {
  const { data, isLoading, isError, refetch } = useCaseDetail(caseId);
  useRecordRecentlyViewed(
    projectId,
    data ? { kind: "case", id: String(data.id), title: `${data.caseCode} ${data.title}` } : null
  );
  const editor = useCaseEditorActions(projectId);
  const detailLayout = layout === "panel" ? "embedded" : "page";

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
    enabled: Number.isInteger(caseId)
  });

  const { clearEditErrors } = editor;

  useEffect(() => {
    clearEditErrors();
  }, [caseId, clearEditErrors]);

  if (isLoading) {
    return <p className="p-4 text-sm text-slate-500">Loading test case…</p>;
  }

  if (isError || !data) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-700">Could not load test case.</p>
        <button type="button" className="mt-2 text-sm font-medium text-slate-700 underline" onClick={() => void refetch()}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <ExpandableCaseDetail
      data={data}
      versions={caseVersionsQuery.data ?? []}
      customFields={customFields}
      caseTemplates={caseTemplates}
      mode={mode}
      layout={detailLayout}
      showHeading={showHeading ?? layout === "panel"}
      showPrimaryEdit={false}
      hideShareActions
      onEdit={onEdit ?? (() => undefined)}
      onClose={mode === "edit" ? (onCancelEdit ?? onClose) : onClose}
      onSave={async (patch) => {
        await editor.updateCaseMutation.mutateAsync({
          caseId: data.id,
          ...patch,
          expectedVersion: Number.isInteger(data.lockVersion) ? data.lockVersion : undefined
        });
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
      onLinkSharedStep={async (sharedStepId) => {
        await editor.linkSharedStepMutation.mutateAsync({ caseId: data.id, sharedStepId });
      }}
      isStepsBusy={editor.stepsBusy}
      onDelete={async () => {
        await editor.deleteCaseMutation.mutateAsync(data.id);
        onDeleted();
      }}
      onSetArchived={async (archived) => {
        await editor.setCaseArchivedMutation.mutateAsync({ caseId: data.id, archived });
        if (archived) onDeleted();
        else await refetch();
      }}
      onRestoreVersion={async (versionId) => {
        await editor.restoreVersionMutation.mutateAsync({
          caseId: data.id,
          versionId,
          expectedVersion: Number.isInteger(data.lockVersion) ? data.lockVersion : undefined
        });
      }}
      isDeleting={editor.deleteCaseMutation.isPending}
      isArchiving={editor.setCaseArchivedMutation.isPending}
      isRestoring={editor.restoreVersionMutation.isPending}
      restoreError={editor.restoreFormError}
      onDuplicated={onDuplicated}
    />
  );
}
