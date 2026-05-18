import { useQuery } from "@tanstack/react-query";

import { fetchSuiteGroupedCases } from "../api/catalogApi";
import type { CaseDisplayMode } from "../caseRepositoryView";
import type { CaseListFilters } from "../types";
import type { CaseGroupBy } from "../utils/caseRepositoryGrouping";
import { caseKeys } from "./useCases";

export function useSuiteCases(
  projectId: string | undefined,
  suiteId: string | undefined,
  sectionId: number | null,
  filters: CaseListFilters,
  display: CaseDisplayMode,
  groupBy: CaseGroupBy
) {
  return useQuery({
    queryKey: [
      ...caseKeys.all(projectId ?? ""),
      "suite-grouped",
      suiteId ?? "",
      sectionId ?? -1,
      display,
      groupBy,
      filters.q,
      filters.priority,
      filters.caseType,
      filters.automation,
      filters.refs,
      filters.labels,
      filters.estimate,
      filters.sectionScope,
      filters.state
    ],
    queryFn: () => fetchSuiteGroupedCases(projectId!, suiteId!, sectionId, filters, display, groupBy),
    enabled: Boolean(
      projectId &&
        suiteId &&
        (display !== "tree" || (sectionId != null && !Number.isNaN(sectionId)))
    ),
    refetchInterval: false,
    refetchIntervalInBackground: false
  });
}
