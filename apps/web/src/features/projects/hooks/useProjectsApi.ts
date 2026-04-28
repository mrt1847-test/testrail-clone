import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createProject, fetchProject, fetchProjectOverview, fetchProjects } from "../api/projectApi";

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
