import type { PlanEntryConfigurationMapping, PlanEntryRow } from "../api/planningApi";
import type { RunPlanOverviewItem } from "../../runs/api/runsOverviewApi";
import type { RunSummary } from "../../runs/types";

export type PlanExecutionRun = {
  runId: string;
  name: string;
  href: string;
  status: "open" | "closed";
  totalTests: number;
  untested: number;
  percentPassed: number;
  statusCounts: Record<string, number>;
};

export type PlanExecutionEntry = {
  id: string;
  name: string;
  configurationNames: string[];
  caseSummary: string;
  run: PlanExecutionRun | null;
};

export function formatPlanCaseScope(entry: Pick<PlanEntryRow, "includeAll" | "includeCaseIds" | "excludeCaseIds">) {
  if (entry.includeAll) {
    return entry.excludeCaseIds.length > 0 ? `All cases · ${entry.excludeCaseIds.length} excluded` : "All cases";
  }
  const included = entry.includeCaseIds.length;
  const includedLabel = included === 1 ? "1 selected case" : `${included} selected cases`;
  if (entry.excludeCaseIds.length === 0) return includedLabel;
  return `${includedLabel} · ${entry.excludeCaseIds.length} excluded`;
}

export function configurationNamesForEntry(
  mapping: PlanEntryConfigurationMapping | undefined,
  environment?: string
) {
  const fromMapping = (mapping?.items ?? [])
    .map((item) => item.configurationName.trim())
    .filter(Boolean);
  if (fromMapping.length > 0) return fromMapping;
  const env = environment?.trim();
  return env ? [env] : [];
}

export function expectedGeneratedRunCount(hasRun: boolean) {
  return hasRun ? 0 : 1;
}

export function describeGeneratePreview(input: {
  entryName: string;
  configurationNames: string[];
  hasRun: boolean;
}) {
  if (input.hasRun) return `${input.entryName} already has a run. Generating again opens that same run.`;
  const configs = input.configurationNames.length > 0 ? input.configurationNames.join(" · ") : "no configuration";
  return `1 run for ${input.entryName} (${configs}).`;
}

export function buildPlanExecutionEntries(input: {
  projectId: string;
  entries: readonly PlanEntryRow[];
  runs: readonly RunSummary[];
  overviewItems: readonly RunPlanOverviewItem[];
  configurationsByEntryId: ReadonlyMap<string, PlanEntryConfigurationMapping | undefined>;
}): PlanExecutionEntry[] {
  const runById = new Map(input.runs.map((run) => [run.id, run]));
  const overviewById = new Map(input.overviewItems.map((item) => [item.id, item]));
  return input.entries.map((entry) => {
    const mapping = input.configurationsByEntryId.get(entry.id);
    const configurationNames = configurationNamesForEntry(mapping, entry.environment);
    const runId = entry.runId;
    const overview = runId ? overviewById.get(runId) : undefined;
    const summary = runId ? runById.get(runId) : undefined;
    const run: PlanExecutionRun | null = runId
      ? {
          runId,
          name: overview?.name ?? summary?.name ?? `Run #${runId}`,
          href: `/projects/${input.projectId}/runs/${runId}`,
          status: summary?.status === "closed" ? "closed" : "open",
          totalTests: overview?.totalTests ?? 0,
          untested: overview?.statusCounts.untested ?? 0,
          percentPassed: overview?.percentPassed ?? summary?.progress ?? 0,
          statusCounts: overview?.statusCounts ?? {}
        }
      : null;
    return {
      id: entry.id,
      name: entry.name,
      configurationNames,
      caseSummary: formatPlanCaseScope(entry),
      run
    };
  });
}
