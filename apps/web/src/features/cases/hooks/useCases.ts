import { useQuery } from "@tanstack/react-query";

import { fetchCasesForSection } from "../api/catalogApi";

export const caseKeys = {
  all: (projectId: string) => ["cases", projectId] as const,
  list: (projectId: string, sectionId: number) => [...caseKeys.all(projectId), "list", sectionId] as const
};

export function useCases(projectId: string | undefined, sectionId: number | null) {
  return useQuery({
    queryKey: caseKeys.list(projectId ?? "", sectionId ?? -1),
    queryFn: () => fetchCasesForSection(projectId!, sectionId!),
    enabled: Boolean(projectId) && sectionId != null && !Number.isNaN(sectionId)
  });
}
