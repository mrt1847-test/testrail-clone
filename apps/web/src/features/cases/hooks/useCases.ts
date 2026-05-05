import { useQuery } from "@tanstack/react-query";

import { fetchCasesForSection } from "../api/catalogApi";
import type { CaseListFilters } from "../types";

export const caseKeys = {
  all: (projectId: string) => ["cases", projectId] as const,
  list: (projectId: string, sectionId: number, filters: CaseListFilters) =>
    [
      ...caseKeys.all(projectId),
      "list",
      sectionId,
      filters.q,
      filters.priority,
      filters.caseType,
      filters.automation,
      filters.refs,
      filters.labels,
      filters.estimate,
      filters.state
    ] as const
};

export function useCases(
  projectId: string | undefined,
  sectionId: number | null,
  filters: CaseListFilters,
  page = 1,
  pageSize = 100
) {
  return useQuery({
    queryKey: [...caseKeys.list(projectId ?? "", sectionId ?? -1, filters), page, pageSize],
    queryFn: () => fetchCasesForSection(projectId!, sectionId!, filters, page, pageSize),
    enabled: Boolean(projectId) && sectionId != null && !Number.isNaN(sectionId),
    refetchInterval: false,
    refetchIntervalInBackground: false
  });
}
