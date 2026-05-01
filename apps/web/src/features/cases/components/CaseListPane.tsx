import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import {
  createCase,
  createCaseStep,
  deleteCase,
  deleteCaseStep,
  fetchCaseVersions,
  restoreCaseVersion,
  updateCase,
  updateCaseStep
} from "../api/catalogApi";
import { projectKeys } from "../../projects/hooks/useProjectsApi";
import { reportKeys } from "../../projects/hooks/reportKeys";
import { fetchCustomFields } from "../../projects/api/advancedApi";
import { caseDetailKeys } from "../hooks/useCaseDetail";
import { useCaseDetail } from "../hooks/useCaseDetail";
import { caseKeys } from "../hooks/useCases";
import { useCases } from "../hooks/useCases";
import { useExpandedCase } from "../hooks/useExpandedCase";
import { sectionKeys } from "../hooks/useSections";
import { CaseListToolbar } from "./CaseListToolbar";
import { CaseRow } from "./CaseRow";

type CaseListPaneProps = {
  projectId: string;
};

export function CaseListPane({ projectId }: CaseListPaneProps) {
  const qc = useQueryClient();
  const { selectedSectionId, expandedCaseId, mode, setExpandedCase } = useExpandedCase();
  const { data: cases = [], isLoading, isError, refetch } = useCases(projectId, selectedSectionId);
  const { data: customFields = [] } = useQuery({
    queryKey: ["case-custom-fields", projectId],
    queryFn: () => fetchCustomFields(projectId, "case"),
    enabled: Boolean(projectId)
  });
  const { data: caseDetailRemote } = useCaseDetail(expandedCaseId);
  const caseVersionsQuery = useQuery({
    queryKey: ["case-versions", expandedCaseId ?? -1],
    queryFn: () => fetchCaseVersions(expandedCaseId!),
    enabled: expandedCaseId != null
  });
  const [addTitle, setAddTitle] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const invalidateCases = () => {
    void qc.invalidateQueries({ queryKey: caseKeys.all(projectId) });
    void qc.invalidateQueries({ queryKey: sectionKeys.all(projectId) });
    void qc.invalidateQueries({ queryKey: projectKeys.overview(projectId) });
    void qc.invalidateQueries({ queryKey: reportKeys.all(projectId) });
  };
  const invalidateAfterCaseEdit = (caseId: number) => {
    void qc.invalidateQueries({ queryKey: caseKeys.all(projectId) });
    void qc.invalidateQueries({ queryKey: caseDetailKeys.detail(caseId) });
    void qc.invalidateQueries({ queryKey: projectKeys.overview(projectId) });
    void qc.invalidateQueries({ queryKey: reportKeys.all(projectId) });
    void qc.invalidateQueries({ queryKey: ["case-versions", caseId] });
  };

  const createCaseMutation = useMutation({
    mutationFn: (title: string) => createCase(selectedSectionId!, { title }),
    onSuccess: () => {
      invalidateCases();
      setAddTitle("");
      setShowAdd(false);
    }
  });

  const updateCaseMutation = useMutation({
    mutationFn: (input: {
      caseId: number;
      title: string;
      preconditions: string;
      customValues: Record<string, string | number | boolean | null>;
      expectedVersion?: number;
    }) =>
      updateCase(input.caseId, {
        title: input.title,
        preconditions: input.preconditions,
        customValues: input.customValues,
        expectedVersion: input.expectedVersion
      }),
    onSuccess: (_, vars) => {
      invalidateAfterCaseEdit(vars.caseId);
    }
  });

  const deleteCaseMutation = useMutation({
    mutationFn: (caseId: number) => deleteCase(caseId),
    onSuccess: () => {
      invalidateCases();
      setExpandedCase(null);
    }
  });

  const restoreVersionMutation = useMutation({
    mutationFn: (input: { caseId: number; versionId: number; expectedVersion?: number }) =>
      restoreCaseVersion(input.caseId, input.versionId, input.expectedVersion),
    onSuccess: (_, vars) => {
      invalidateAfterCaseEdit(vars.caseId);
    }
  });

  const invalidateCaseDetail = (caseId: number) => {
    void qc.invalidateQueries({ queryKey: caseDetailKeys.detail(caseId) });
    void qc.invalidateQueries({ queryKey: ["case-versions", caseId] });
  };

  const createStepMutation = useMutation({
    mutationFn: (input: { caseId: number; content: string; expected: string }) =>
      createCaseStep(input.caseId, {
        content: input.content,
        expectedResult: input.expected.length ? input.expected : null
      }),
    onSuccess: (_, v) => {
      invalidateCases();
      invalidateCaseDetail(v.caseId);
    }
  });

  const updateStepMutation = useMutation({
    mutationFn: (input: {
      caseId: number;
      stepId: number;
      patch: { content?: string; expectedResult?: string | null; stepOrder?: number };
    }) => updateCaseStep(input.stepId, input.patch),
    onSuccess: (_, v) => {
      invalidateCases();
      invalidateCaseDetail(v.caseId);
    }
  });

  const deleteStepMutation = useMutation({
    mutationFn: (input: { caseId: number; stepId: number }) => deleteCaseStep(input.stepId),
    onSuccess: (_, v) => {
      invalidateCases();
      invalidateCaseDetail(v.caseId);
    }
  });

  const stepsBusy =
    createStepMutation.isPending || updateStepMutation.isPending || deleteStepMutation.isPending;

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <CaseListToolbar onAddCase={() => setShowAdd((v) => !v)} />
        <LoadingState message="Loading cases…" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <CaseListToolbar onAddCase={() => setShowAdd((v) => !v)} />
        <p className="text-sm text-red-700">케이스 목록을 불러오지 못했습니다.</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-2 text-sm font-medium text-slate-700 underline"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <CaseListToolbar onAddCase={() => setShowAdd((v) => !v)} />
      {showAdd ? (
        <div className="border-b border-slate-100 bg-slate-50 px-3 py-3">
          <p className="text-xs font-medium text-slate-600">New case</p>
          <div className="mt-2 flex gap-2">
            <input
              className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="Title"
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
            />
            <button
              type="button"
              disabled={!addTitle.trim() || createCaseMutation.isPending}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              onClick={() => void createCaseMutation.mutateAsync(addTitle.trim())}
            >
              {createCaseMutation.isPending ? "Creating…" : "Create"}
            </button>
            <button type="button" className="rounded border border-slate-300 px-3 py-1.5 text-sm" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {cases.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="No test cases in this section"
            description="Add a case or pick another section."
            action={
              <button
                type="button"
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
                onClick={() => setShowAdd(true)}
              >
                Add case
              </button>
            }
          />
        </div>
      ) : (
        <div>
          {cases.map((item) => {
            const isExpanded = expandedCaseId === item.id;
            const caseDetail = isExpanded ? (caseDetailRemote ?? item) : item;
            return (
              <CaseRow
                key={item.id}
                item={item}
                isExpanded={isExpanded}
                mode={mode}
                detail={caseDetail}
                versions={isExpanded ? caseVersionsQuery.data ?? [] : []}
                customFields={customFields}
                onToggle={() => setExpandedCase(isExpanded ? null : item.id)}
                onEdit={() => setExpandedCase(item.id, "edit")}
                onCloseDetail={() => setExpandedCase(null)}
                onSave={async (patch) => {
                  await updateCaseMutation.mutateAsync({
                    caseId: item.id,
                    ...patch,
                    expectedVersion: Number.isInteger(caseDetail.lockVersion) ? caseDetail.lockVersion : undefined
                  });
                  setExpandedCase(item.id, "view");
                }}
                onDelete={async () => {
                  await deleteCaseMutation.mutateAsync(item.id);
                }}
                onRestoreVersion={async (versionId) => {
                  await restoreVersionMutation.mutateAsync({
                    caseId: item.id,
                    versionId,
                    expectedVersion: Number.isInteger(caseDetail.lockVersion) ? caseDetail.lockVersion : undefined
                  });
                }}
                isSaving={updateCaseMutation.isPending}
                isDeleting={deleteCaseMutation.isPending}
                isRestoring={restoreVersionMutation.isPending}
                onCreateStep={async (input) => {
                  await createStepMutation.mutateAsync({ caseId: item.id, ...input });
                }}
                onUpdateStep={async (stepId, patch) => {
                  await updateStepMutation.mutateAsync({ caseId: item.id, stepId, patch });
                }}
                onDeleteStep={async (stepId) => {
                  await deleteStepMutation.mutateAsync({ caseId: item.id, stepId });
                }}
                isStepsBusy={stepsBusy}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
