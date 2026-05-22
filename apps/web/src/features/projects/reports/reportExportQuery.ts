/** Build query params for GET /reports/export from current UI filter state. */

export function pickExportQuery(
  values: Record<string, string | number | undefined | null>
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text.length > 0 && text !== "all") out[key] = text;
  }
  return out;
}

export function exportQueryFromSaved(
  filters: { export?: Record<string, unknown> } | null | undefined
): Record<string, string | undefined> {
  const raw = filters?.export;
  if (!raw || typeof raw !== "object") return {};
  return pickExportQuery(raw as Record<string, string | number | undefined | null>);
}

export function buildRunSummaryExportQuery(input: { search: string; status: string }) {
  return pickExportQuery({
    q: input.search,
    runLifecycleStatus: input.status === "open" || input.status === "closed" ? input.status : undefined
  });
}

export function buildPlanSummaryExportQuery(input: { search: string; status: string }) {
  return pickExportQuery({
    q: input.search,
    planLifecycleStatus: input.status === "open" || input.status === "closed" ? input.status : undefined
  });
}

export function buildMilestoneSummaryExportQuery(input: { search: string; status: string }) {
  return pickExportQuery({
    q: input.search,
    milestoneLifecycle:
      input.status === "open" || input.status === "upcoming" || input.status === "completed"
        ? input.status
        : undefined
  });
}

export function buildResultsExplorerExportQuery(input: {
  runId?: string;
  status: string;
  source: string;
  q: string;
  caseId: string;
  testId: string;
  createdFrom: string;
  createdTo: string;
}) {
  return pickExportQuery({
    runId: input.runId,
    status: input.status,
    source: input.source === "all" ? undefined : input.source,
    q: input.q,
    caseId: input.caseId,
    testId: input.testId,
    createdFrom: input.createdFrom || undefined,
    createdTo: input.createdTo || undefined
  });
}

export function uiFiltersForReport(input: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    const text = value.trim();
    if (text.length > 0 && text !== "all") out[key] = text;
  }
  return out;
}
