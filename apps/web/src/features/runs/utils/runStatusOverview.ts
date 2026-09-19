import type { RunDetailDto } from "../types";
import { RUN_STATUS_SEGMENTS, runPassedPercent, runStatusTotal } from "./runProgressSegments";

export const UI040_STATUS_FIXTURE_COUNTS: RunDetailDto["counts"] = {
  passed: 43,
  failed: 2,
  blocked: 2,
  retest: 3,
  untested: 9
};

export function runRecordedPercent(counts: RunDetailDto["counts"]) {
  const total = runStatusTotal(counts);
  if (total <= 0) return 0;
  const recorded = counts.passed + counts.failed + counts.blocked + counts.retest;
  return Math.round((recorded / total) * 100);
}

export function formatRunWidePassedLabel(counts: RunDetailDto["counts"]) {
  const total = runStatusTotal(counts);
  if (total <= 0) return "0 tests";
  return `${runPassedPercent(counts)}% passed`;
}

export function formatRunWideUntestedLabel(counts: RunDetailDto["counts"]) {
  const total = runStatusTotal(counts);
  if (total <= 0) return "0 / 0 untested";
  return `${counts.untested} / ${total} untested`;
}

export type RunStatusLegendItem = {
  key: "all" | "passed" | "failed" | "blocked" | "retest" | "untested";
  label: string;
  count: number;
  percent: number;
  color?: string;
};

export function buildRunStatusLegendItems(counts: RunDetailDto["counts"]): RunStatusLegendItem[] {
  const total = runStatusTotal(counts);
  const statuses: RunStatusLegendItem[] = RUN_STATUS_SEGMENTS.map((segment) => ({
    key: segment.key,
    label: segment.label,
    count: counts[segment.key],
    percent: total <= 0 ? 0 : Math.round((counts[segment.key] / total) * 100),
    color: segment.color
  }));
  return [
    ...statuses,
    {
      key: "all",
      label: "All statuses",
      count: total,
      percent: total <= 0 ? 0 : 100
    }
  ];
}

export function runStatusFilterHint(input: {
  activeStatus: string;
  counts: RunDetailDto["counts"];
  visibleCount?: number;
}) {
  const total = runStatusTotal(input.counts);
  if (input.activeStatus === "all" || total <= 0) return null;
  const item = buildRunStatusLegendItems(input.counts).find((row) => row.key === input.activeStatus);
  if (!item) return null;
  const visible =
    input.visibleCount == null ? null : `${input.visibleCount} in the current list`;
  return visible
    ? `Showing ${item.label}. Run-wide ${item.label}: ${item.count} of ${total}. ${visible}.`
    : `Showing ${item.label}. Run-wide ${item.label}: ${item.count} of ${total}.`;
}
