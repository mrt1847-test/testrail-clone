import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { projectKeys } from "../../projects/hooks/useProjectsApi";
import {
  addRunResult,
  closeRun,
  type CreateRunInput,
  createRun,
  fetchResultSteps,
  fetchRunDetail,
  fetchRuns,
  fetchTestResults,
  rerunFailed,
  updateRunAssignee
} from "../api/runApi";

export const runKeys = {
  all: (projectId: string) => ["runs", projectId] as const,
  list: (projectId: string) => [...runKeys.all(projectId), "list"] as const,
  detail: (projectId: string, runId: string) => [...runKeys.all(projectId), "detail", runId] as const,
  results: (testId: string) => ["test-results", testId] as const,
  resultSteps: (resultId: string) => ["result-steps", resultId] as const
};

export function useRunsQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: runKeys.list(projectId ?? ""),
    queryFn: () => fetchRuns(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useRunDetailQuery(projectId: string | undefined, runId: string | undefined) {
  return useQuery({
    queryKey: runKeys.detail(projectId ?? "", runId ?? ""),
    queryFn: () => fetchRunDetail(projectId!, runId!),
    enabled: Boolean(projectId && runId),
  });
}

export function useCreateRunMutation(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateRunInput, "projectId">) => createRun({ ...input, projectId: projectId! }),
    onSuccess: () => {
      if (!projectId) return;
      void qc.invalidateQueries({ queryKey: runKeys.all(projectId) });
      void qc.invalidateQueries({ queryKey: projectKeys.overview(projectId) });
    }
  });
}

export function useTestResultsQuery(testId: string | undefined) {
  return useQuery({
    queryKey: runKeys.results(testId ?? ""),
    queryFn: () => fetchTestResults(testId!),
    enabled: Boolean(testId)
  });
}

export function useResultStepsQuery(resultId: string | undefined) {
  return useQuery({
    queryKey: runKeys.resultSteps(resultId ?? ""),
    queryFn: () => fetchResultSteps(resultId!),
    enabled: Boolean(resultId)
  });
}

export function useAddRunResultMutation(projectId: string | undefined, runId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      testId: string;
      status: "passed" | "failed" | "blocked" | "retest" | "untested";
      comment?: string;
      elapsed?: string;
      version?: string;
      defects?: string[];
      stepResults?: Array<{
        stepOrder: number;
        status: "passed" | "failed" | "blocked" | "retest" | "untested";
        actualResult?: string;
        comment?: string;
      }>;
    }) =>
      addRunResult({ runId: runId!, ...payload }),
    onSuccess: (_, vars) => {
      if (!projectId || !runId) return;
      void qc.invalidateQueries({ queryKey: runKeys.detail(projectId, runId) });
      void qc.invalidateQueries({ queryKey: runKeys.results(vars.testId) });
    }
  });
}

export function useCloseRunMutation(projectId: string | undefined, runId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => closeRun(runId!),
    onSuccess: () => {
      if (!projectId || !runId) return;
      void qc.invalidateQueries({ queryKey: runKeys.detail(projectId, runId) });
      void qc.invalidateQueries({ queryKey: runKeys.list(projectId) });
    }
  });
}

export function useUpdateRunAssigneeMutation(projectId: string | undefined, runId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assignedTo: string | null) => updateRunAssignee(runId!, assignedTo),
    onSuccess: () => {
      if (!projectId || !runId) return;
      void qc.invalidateQueries({ queryKey: runKeys.detail(projectId, runId) });
    }
  });
}

export function useRerunFailedMutation(projectId: string | undefined, runId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => rerunFailed(runId!),
    onSuccess: () => {
      if (!projectId || !runId) return;
      void qc.invalidateQueries({ queryKey: runKeys.list(projectId) });
      void qc.invalidateQueries({ queryKey: runKeys.detail(projectId, runId) });
    }
  });
}
