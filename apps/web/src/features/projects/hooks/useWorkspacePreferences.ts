import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchWorkspacePreferences,
  updateWorkspacePreferences,
  type WorkspacePreferencesDto
} from "../api/settingsApi";

export function workspacePreferencesQueryKey(projectId: string) {
  return ["workspace-preferences", projectId] as const;
}

export function useWorkspacePreferences(projectId: string) {
  return useQuery({
    queryKey: workspacePreferencesQueryKey(projectId),
    queryFn: () => fetchWorkspacePreferences(projectId),
    enabled: Boolean(projectId)
  });
}

export function useUpdateWorkspacePreferencesMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<WorkspacePreferencesDto>) => updateWorkspacePreferences(projectId, input),
    onSuccess: (data) => {
      queryClient.setQueryData(workspacePreferencesQueryKey(projectId), data);
    }
  });
}
