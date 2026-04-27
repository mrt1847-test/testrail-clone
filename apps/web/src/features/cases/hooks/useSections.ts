import { useQuery } from "@tanstack/react-query";

import { fetchSectionsForProject } from "../api/catalogApi";

export const sectionKeys = {
  all: (projectId: string) => ["sections", projectId] as const
};

export function useSections(projectId: string | undefined) {
  return useQuery({
    queryKey: sectionKeys.all(projectId ?? ""),
    queryFn: () => fetchSectionsForProject(projectId!),
    enabled: Boolean(projectId)
  });
}
