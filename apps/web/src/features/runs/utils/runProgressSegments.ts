import type { RunDetailDto } from "../types";

export type RunStatusSegmentKey = "passed" | "failed" | "blocked" | "retest" | "untested";

export const RUN_STATUS_SEGMENTS: Array<{
  key: RunStatusSegmentKey;
  label: string;
  color: string;
  barClass: string;
  chipClass: string;
  activeChip: string;
}> = [
  {
    key: "passed",
    label: "Passed",
    color: "#10b981",
    barClass: "bg-emerald-500",
    chipClass: "bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
    activeChip: "ring-2 ring-emerald-600 ring-offset-1"
  },
  {
    key: "failed",
    label: "Failed",
    color: "#ef4444",
    barClass: "bg-red-500",
    chipClass: "bg-red-50 text-red-900 hover:bg-red-100",
    activeChip: "ring-2 ring-red-600 ring-offset-1"
  },
  {
    key: "blocked",
    label: "Blocked",
    color: "#f59e0b",
    barClass: "bg-amber-500",
    chipClass: "bg-amber-50 text-amber-900 hover:bg-amber-100",
    activeChip: "ring-2 ring-amber-600 ring-offset-1"
  },
  {
    key: "retest",
    label: "Retest",
    color: "#8b5cf6",
    barClass: "bg-violet-500",
    chipClass: "bg-violet-50 text-violet-900 hover:bg-violet-100",
    activeChip: "ring-2 ring-violet-600 ring-offset-1"
  },
  {
    key: "untested",
    label: "Untested",
    color: "#94a3b8",
    barClass: "bg-slate-400",
    chipClass: "bg-slate-100 text-slate-800 hover:bg-slate-200",
    activeChip: "ring-2 ring-slate-600 ring-offset-1"
  }
];

export function runStatusTotal(counts: RunDetailDto["counts"]) {
  return counts.passed + counts.failed + counts.blocked + counts.retest + counts.untested;
}

export function runPassedPercent(counts: RunDetailDto["counts"]) {
  const total = runStatusTotal(counts);
  if (total <= 0) return 0;
  return Math.round((counts.passed / total) * 100);
}

export function runCompletionPercent(counts: RunDetailDto["counts"]) {
  const total = runStatusTotal(counts);
  if (total <= 0) return 0;
  const executed = counts.passed + counts.failed + counts.blocked + counts.retest;
  return Math.round((executed / total) * 100);
}
