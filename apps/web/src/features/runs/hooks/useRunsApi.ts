import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { projectKeys } from "../../projects/hooks/useProjectsApi";
import { createRun, fetchRunDetail, fetchRuns } from "../api/runApi";

export const runKeys = {
  all: (projectId: string) => ["runs", projectId] as const,
  list: (projectId: string) => [...runKeys.all(projectId), "list"] as const,
  detail: (projectId: string, runId: string) => [...runKeys.all(projectId), "detail", runId] as const,
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
    mutationFn: (name: string) => createRun(projectId!, name),
    onSuccess: () => {
      if (!projectId) return;
      void qc.invalidateQueries({ queryKey: runKeys.all(projectId) });
      void qc.invalidateQueries({ queryKey: projectKeys.overview(projectId) });
    }
  });
}
