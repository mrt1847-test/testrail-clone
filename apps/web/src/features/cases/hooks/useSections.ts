import { useQuery } from "@tanstack/react-query";

import { fetchSectionsForProject, type SectionsBundle } from "../api/catalogApi";

export const sectionKeys = {
  all: (projectId: string) => ["sections", projectId] as const
};

export function useSections(projectId: string | undefined) {
  return useQuery<SectionsBundle>({
    queryKey: sectionKeys.all(projectId ?? ""),
    queryFn: () => fetchSectionsForProject(projectId!),
    enabled: Boolean(projectId)
  });
}
