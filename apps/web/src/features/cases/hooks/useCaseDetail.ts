import { useQuery } from "@tanstack/react-query";

import { fetchCaseById } from "../api/catalogApi";

export const caseDetailKeys = {
  detail: (caseId: number) => ["case", "detail", caseId] as const
};

export function useCaseDetail(caseId: number | null) {
  const enabled = caseId != null && !Number.isNaN(caseId);
  return useQuery({
    queryKey: enabled ? caseDetailKeys.detail(caseId) : (["case", "detail", "off"] as const),
    queryFn: () => fetchCaseById(caseId!),
    enabled
  });
}
