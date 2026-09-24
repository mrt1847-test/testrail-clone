import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { fetchCaseTemplates, fetchCustomFieldsForUse } from "../../projects/api/settingsApi";
import { fetchCaseVersions } from "../api/catalogApi";
import { extractApiErrorMessage } from "../caseErrors";
import { useRecordRecentlyViewed } from "../../projects/hooks/useRecordRecentlyViewed";
import { useCaseDetail } from "../hooks/useCaseDetail";
import { useCaseEditorActions } from "../hooks/useCaseEditorActions";
import { useOptionalCaseDraftGuard } from "../context/CaseDraftGuardContext";
import type { CaseAuthoringSubmitInput } from "./CaseAuthoringForm";
import {
  AuthoringPersistError,
  authoringLeaveDescription,
  resumeFromOutcome,
  type AuthoringPersistResume
} from "../utils/authoringPersistOutcome";
import { persistAndRefreshCaseAuthoring } from "../utils/persistCaseAuthoring";
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
  onDirtyChange?: (dirty: boolean) => void;
  onSavingChange?: (saving: boolean) => void;
  onSaved?: () => void;
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
  onDirtyChange,
  onSavingChange,
  onSaved,
  showHeading
}: Props) {
  const { data, isLoading, isError, refetch } = useCaseDetail(caseId);
  const qc = useQueryClient();
  const saveGenerationRef = useRef(0);
  const persistResumeRef = useRef<AuthoringPersistResume | null>(null);
  const [persistResume, setPersistResume] = useState<AuthoringPersistResume | null>(null);
  const [authoringBusy, setAuthoringBusy] = useState(false);
  const [authoringError, setAuthoringError] = useState<string | null>(null);
  const draftGuard = useOptionalCaseDraftGuard();
  const setLeaveHintRef = useRef(draftGuard?.setLeaveHint);
  setLeaveHintRef.current = draftGuard?.setLeaveHint;
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
  const isSaving = authoringBusy || editor.updateCaseMutation.isPending || editor.stepsBusy;

  useEffect(() => {
    clearEditErrors();
    setAuthoringError(null);
    persistResumeRef.current = null;
    setPersistResume(null);
    setLeaveHintRef.current?.(null);
  }, [caseId, clearEditErrors]);

  useEffect(() => {
    onSavingChange?.(isSaving);
  }, [isSaving, onSavingChange]);

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
      onDirtyChange={onDirtyChange}
      onSave={async (input: CaseAuthoringSubmitInput) => {
        saveGenerationRef.current += 1;
        const generation = saveGenerationRef.current;
        setAuthoringBusy(true);
        setAuthoringError(null);
        try {
          let existing = data;
          let resume = persistResumeRef.current;
          if (resume?.failureKind === "conflict") {
            const fresh = await refetch();
            if (fresh.data) existing = fresh.data;
            resume = null;
            persistResumeRef.current = null;
            setPersistResume(null);
          }
          const result = await persistAndRefreshCaseAuthoring(qc, {
            projectId,
            existing,
            sectionId: existing.sectionId,
            submit: input,
            saveGeneration: generation,
            isCurrent: () => generation === saveGenerationRef.current,
            resume
          });
          if (generation !== saveGenerationRef.current) return;
          if (!result.ok) {
            const nextResume = resumeFromOutcome(result);
            persistResumeRef.current = nextResume;
            setPersistResume(nextResume);
            setAuthoringError(result.message);
            setLeaveHintRef.current?.(
              authoringLeaveDescription({
                mode: "edit",
                bodySaved: result.bodySaved,
                stepsComplete: result.stepsComplete,
                caseCode: result.caseCode
              })
            );
            onDirtyChange?.(true);
            throw new AuthoringPersistError(result);
          }
          persistResumeRef.current = null;
          setPersistResume(null);
          setLeaveHintRef.current?.(null);
          onSaved?.();
        } catch (error) {
          if (generation !== saveGenerationRef.current) return;
          if (error instanceof AuthoringPersistError) throw error;
          const message = extractApiErrorMessage(error, "Could not save case changes.");
          setAuthoringError(message);
          throw new Error(message);
        } finally {
          if (generation === saveGenerationRef.current) setAuthoringBusy(false);
        }
      }}
      isSaving={isSaving}
      submitError={authoringError ?? editor.editFormError}
      showRetry={Boolean(persistResume && authoringError)}
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
