import { useQuery } from "@tanstack/react-query";

import { fetchCasesForSection } from "../api/catalogApi";

export const caseKeys = {
  all: (projectId: string) => ["cases", projectId] as const,
  list: (projectId: string, sectionId: number) => [...caseKeys.all(projectId), "list", sectionId] as const
};

export function useCases(projectId: string | undefined, sectionId: number | null, page = 1, pageSize = 100) {
  return useQuery({
    queryKey: [...caseKeys.list(projectId ?? "", sectionId ?? -1), page, pageSize],
    queryFn: () => fetchCasesForSection(projectId!, sectionId!, page, pageSize),
    enabled: Boolean(projectId) && sectionId != null && !Number.isNaN(sectionId),
    refetchInterval: false,
    refetchIntervalInBackground: false
  });
}
