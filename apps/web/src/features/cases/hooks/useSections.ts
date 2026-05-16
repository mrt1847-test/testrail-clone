import { useQuery } from "@tanstack/react-query";

import { fetchSectionsForProject, type SectionsBundle } from "../api/catalogApi";

export const sectionKeys = {
  all: (projectId: string) => ["sections", projectId] as const
};

export function useSections(projectId: string | undefined, suiteId?: string) {
  return useQuery<SectionsBundle>({
    queryKey: [...sectionKeys.all(projectId ?? ""), suiteId ?? "default"] as const,
    queryFn: () => fetchSectionsForProject(projectId!, suiteId ? { suiteId } : undefined),
    enabled: Boolean(projectId)
  });
}
