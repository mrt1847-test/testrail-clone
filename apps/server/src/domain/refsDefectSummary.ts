function isAtRiskStatus(status: string) {
  return status === "failed" || status === "blocked" || status === "retest";
}

function uniqueDefectKeys(rows: Array<{ defectKeys: string[] }>) {
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of row.defectKeys) {
      const normalized = key.trim();
      if (normalized.length > 0) keys.add(normalized);
    }
  }
  return [...keys];
}

export type RefDefectCaseRow = {
  refKey: string;
  caseId: string;
  caseTitle: string;
  latestStatus: string;
  defectKeys: string[];
};

export type RefsDefectSummaryItem = {
  refKey: string;
  linkedCaseCount: number;
  atRiskResultCount: number;
  linkedDefectCount: number;
  defectKeys: string[];
  defectCoverage: "not_applicable" | "linked" | "unlinked";
  caseIds: string[];
};

export type RefsDefectSummaryReport = {
  totalReferences: number;
  items: RefsDefectSummaryItem[];
};

function defectCoverageState(atRiskResultCount: number, linkedDefectCount: number): RefsDefectSummaryItem["defectCoverage"] {
  if (atRiskResultCount === 0) return "not_applicable";
  return linkedDefectCount > 0 ? "linked" : "unlinked";
}

export function buildRefsDefectSummaryReport(rows: RefDefectCaseRow[]): RefsDefectSummaryReport {
  const byRef = new Map<string, RefDefectCaseRow[]>();
  for (const row of rows) {
    const bucket = byRef.get(row.refKey) ?? [];
    bucket.push(row);
    byRef.set(row.refKey, bucket);
  }

  const items = [...byRef.entries()]
    .map(([refKey, caseRows]) => {
      const caseIds = [...new Set(caseRows.map((row) => row.caseId))].sort((a, b) => a.localeCompare(b));
      const atRiskRows = caseRows.filter((row) => isAtRiskStatus(row.latestStatus));
      const defectKeys = uniqueDefectKeys(atRiskRows);

      return {
        refKey,
        linkedCaseCount: caseIds.length,
        atRiskResultCount: atRiskRows.length,
        linkedDefectCount: defectKeys.length,
        defectKeys,
        defectCoverage: defectCoverageState(atRiskRows.length, defectKeys.length),
        caseIds
      };
    })
    .sort((a, b) => a.refKey.localeCompare(b.refKey));

  return {
    totalReferences: items.length,
    items
  };
}
