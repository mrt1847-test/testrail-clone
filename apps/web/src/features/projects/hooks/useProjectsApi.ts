import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  archiveProject,
  createProject,
  fetchProject,
  fetchProjectOverview,
  fetchProjects,
  restoreProject
} from "../api/projectApi";

export const projectKeys = {
  all: ["projects"] as const,
  list: () => [...projectKeys.all, "list"] as const,
  detail: (id: string) => [...projectKeys.all, "detail", id] as const,
  overview: (id: string) => [...projectKeys.all, "overview", id] as const,
};

export function useProjectsQuery() {
  return useQuery({
    queryKey: projectKeys.list(),
    queryFn: fetchProjects,
  });
}

export function useProjectQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(projectId ?? ""),
    queryFn: () => fetchProject(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useProjectOverviewQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.overview(projectId ?? ""),
    queryFn: () => fetchProjectOverview(projectId!),
    enabled: Boolean(projectId),
    refetchInterval: false,
    refetchIntervalInBackground: false
  });
}

export function useCreateProjectMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createProject(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.list() }),
  });
}

export function useArchiveProjectMutation(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => archiveProject(projectId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: projectKeys.list() });
      void qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    }
  });
}

export function useRestoreProjectMutation(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => restoreProject(projectId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: projectKeys.list() });
      void qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    }
  });
}
