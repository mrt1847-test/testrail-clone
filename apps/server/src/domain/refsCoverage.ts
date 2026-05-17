function isAtRiskStatus(status: string) {
  return status === "failed" || status === "blocked" || status === "retest";
}

function toCoverageStatus(latestStatuses: string[], linkedCaseCount: number) {
  if (linkedCaseCount === 0) return "uncovered";
  if (latestStatuses.some(isAtRiskStatus)) return "at_risk";
  if (latestStatuses.some((status) => status === "passed")) return "covered";
  return "untested";
}

export type RefCaseLinkRow = {
  refKey: string;
  caseId: string;
  caseTitle: string;
  latestStatus: string;
};

export type RefsCoverageItem = {
  refKey: string;
  linkedCaseCount: number;
  latestStatuses: string[];
  coverageStatus: string;
  caseIds: string[];
};

export type RefsCoverageReport = {
  totalReferences: number;
  casesWithRefs: number;
  casesWithoutRefs: number;
  items: RefsCoverageItem[];
};

export function buildRefsCoverageReport(
  links: RefCaseLinkRow[],
  counts: { casesWithRefs: number; casesWithoutRefs: number }
): RefsCoverageReport {
  const byRef = new Map<string, { caseIds: Set<string>; statuses: string[] }>();

  for (const link of links) {
    const bucket = byRef.get(link.refKey) ?? { caseIds: new Set<string>(), statuses: [] };
    bucket.caseIds.add(link.caseId);
    bucket.statuses.push(link.latestStatus);
    byRef.set(link.refKey, bucket);
  }

  const items = [...byRef.entries()]
    .map(([refKey, bucket]) => {
      const latestStatuses = bucket.statuses;
      const linkedCaseCount = bucket.caseIds.size;
      return {
        refKey,
        linkedCaseCount,
        latestStatuses,
        coverageStatus: toCoverageStatus(latestStatuses, linkedCaseCount),
        caseIds: [...bucket.caseIds].sort((a, b) => a.localeCompare(b))
      };
    })
    .sort((a, b) => a.refKey.localeCompare(b.refKey));

  return {
    totalReferences: items.length,
    casesWithRefs: counts.casesWithRefs,
    casesWithoutRefs: counts.casesWithoutRefs,
    items
  };
}
