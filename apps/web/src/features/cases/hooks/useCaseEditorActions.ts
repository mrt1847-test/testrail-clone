import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { projectKeys } from "../../projects/hooks/useProjectsApi";
import { reportKeys } from "../../projects/hooks/reportKeys";
import {
  bulkArchiveCases,
  createCaseStep,
  deleteCase,
  deleteCaseStep,
  restoreCaseVersion,
  updateCase,
  updateCaseStep
} from "../api/catalogApi";
import { linkSharedStepToCase } from "../api/sharedStepsApi";
import { extractApiErrorMessage, restoreVersionErrorMessage } from "../caseErrors";
import { caseKeys } from "./useCases";
import { caseDetailKeys } from "./useCaseDetail";
import { sectionKeys } from "./useSections";

export function useCaseEditorActions(projectId: string) {
  const qc = useQueryClient();
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [restoreFormError, setRestoreFormError] = useState<string | null>(null);

  const invalidateCases = () => {
    void qc.invalidateQueries({ queryKey: caseKeys.all(projectId) });
    void qc.invalidateQueries({ queryKey: sectionKeys.all(projectId) });
    void qc.invalidateQueries({ queryKey: ["suite-summary", projectId] });
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

  const updateCaseMutation = useMutation({
    mutationFn: (input: {
      caseId: number;
      title: string;
      preconditions: string;
      estimate: string | null;
      references: string;
      expectedResult: string;
      mission: string;
      goals: string;
      aiInput: string;
      aiExpectedOutput: string;
      templateId: string | null;
      customValues: Record<string, string | number | boolean | string[] | null>;
      expectedVersion?: number;
    }) =>
      updateCase(input.caseId, {
        title: input.title,
        preconditions: input.preconditions,
        estimate: input.estimate,
        refs: input.references.trim().length > 0 ? input.references.trim() : null,
        expectedResult: input.expectedResult.trim().length > 0 ? input.expectedResult.trim() : null,
        mission: input.mission.trim().length > 0 ? input.mission.trim() : null,
        goals: input.goals.trim().length > 0 ? input.goals.trim() : null,
        aiInput: input.aiInput.trim().length > 0 ? input.aiInput.trim() : null,
        aiExpectedOutput: input.aiExpectedOutput.trim().length > 0 ? input.aiExpectedOutput.trim() : null,
        caseTemplateId: input.templateId ? Number(input.templateId) : null,
        customValues: input.customValues,
        expectedVersion: input.expectedVersion
      }),
    onSuccess: (_, vars) => {
      setEditFormError(null);
      invalidateAfterCaseEdit(vars.caseId);
    },
    onError: (error) => {
      setEditFormError(extractApiErrorMessage(error, "Could not save case changes."));
    }
  });

  const deleteCaseMutation = useMutation({
    mutationFn: (caseId: number) => deleteCase(caseId),
    onSuccess: () => {
      invalidateCases();
    }
  });

  const setCaseArchivedMutation = useMutation({
    mutationFn: (input: { caseId: number; archived: boolean }) =>
      bulkArchiveCases(projectId, [input.caseId], input.archived),
    onSuccess: (_, vars) => {
      invalidateCases();
      invalidateAfterCaseEdit(vars.caseId);
    }
  });

  const restoreVersionMutation = useMutation({
    mutationFn: (input: { caseId: number; versionId: number; expectedVersion?: number }) =>
      restoreCaseVersion(input.caseId, input.versionId, input.expectedVersion),
    onSuccess: (_, vars) => {
      setRestoreFormError(null);
      invalidateAfterCaseEdit(vars.caseId);
    },
    onError: (error) => {
      setRestoreFormError(restoreVersionErrorMessage(error));
    }
  });

  const createStepMutation = useMutation({
    mutationFn: (input: { caseId: number; content: string; expected: string }) =>
      createCaseStep(input.caseId, {
        content: input.content,
        expectedResult: input.expected.length ? input.expected : null
      }),
    onSuccess: (_, vars) => {
      invalidateCases();
      invalidateAfterCaseEdit(vars.caseId);
    }
  });

  const updateStepMutation = useMutation({
    mutationFn: (input: {
      caseId: number;
      stepId: number;
      patch: { content?: string; expectedResult?: string | null; stepOrder?: number };
    }) => updateCaseStep(input.stepId, input.patch),
    onSuccess: (_, vars) => {
      invalidateCases();
      invalidateAfterCaseEdit(vars.caseId);
    }
  });

  const deleteStepMutation = useMutation({
    mutationFn: (input: { caseId: number; stepId: number }) => deleteCaseStep(input.stepId),
    onSuccess: (_, vars) => {
      invalidateCases();
      invalidateAfterCaseEdit(vars.caseId);
    }
  });

  const linkSharedStepMutation = useMutation({
    mutationFn: (input: { caseId: number; sharedStepId: string }) =>
      linkSharedStepToCase(input.caseId, input.sharedStepId),
    onSuccess: (_, vars) => {
      invalidateCases();
      invalidateAfterCaseEdit(vars.caseId);
    }
  });

  const stepsBusy =
    createStepMutation.isPending ||
    updateStepMutation.isPending ||
    deleteStepMutation.isPending ||
    linkSharedStepMutation.isPending;

  const clearEditErrors = useCallback(() => {
    setEditFormError(null);
    setRestoreFormError(null);
  }, []);

  return {
    editFormError,
    restoreFormError,
    clearEditErrors,
    updateCaseMutation,
    deleteCaseMutation,
    setCaseArchivedMutation,
    restoreVersionMutation,
    createStepMutation,
    updateStepMutation,
    deleteStepMutation,
    linkSharedStepMutation,
    stepsBusy
  };
}
