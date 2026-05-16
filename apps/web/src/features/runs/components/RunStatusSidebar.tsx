import { useEffect, useState, type ReactNode } from "react";

import type { RunDetailDto } from "../types";

const STORAGE_KEY = "qa-rail.run-status-sidebar-collapsed";

const STATUS_ITEMS = [
  { key: "all", label: "All", tone: "text-slate-800", active: "bg-slate-900 text-white" },
  { key: "untested", label: "Untested", tone: "text-slate-700", active: "bg-slate-700 text-white" },
  { key: "passed", label: "Passed", tone: "text-emerald-800", active: "bg-emerald-600 text-white" },
  { key: "failed", label: "Failed", tone: "text-red-800", active: "bg-red-600 text-white" },
  { key: "blocked", label: "Blocked", tone: "text-amber-800", active: "bg-amber-600 text-white" },
  { key: "retest", label: "Retest", tone: "text-violet-800", active: "bg-violet-600 text-white" }
] as const;

type Props = {
  counts: RunDetailDto["counts"];
  activeStatus: string;
  onStatusSelect: (status: string) => void;
  footer?: ReactNode;
};

function countForStatus(counts: RunDetailDto["counts"], key: string): number {
  if (key === "all") {
    return counts.passed + counts.failed + counts.blocked + counts.retest + counts.untested;
  }
  return counts[key as keyof RunDetailDto["counts"]] ?? 0;
}

export function RunStatusSidebar({ counts, activeStatus, onStatusSelect, footer }: Props) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  if (collapsed) {
    return (
      <nav
        className="flex shrink-0 flex-col items-center rounded-lg border border-slate-200 bg-white shadow-sm lg:w-10"
        aria-label="Filter tests by status"
      >
        <button
          type="button"
          title="Expand status sidebar"
          onClick={() => setCollapsed(false)}
          className="w-full px-1 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          aria-expanded={false}
        >
          »
        </button>
      </nav>
    );
  }

  return (
    <nav
      className="shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:w-52"
      aria-label="Filter tests by status"
    >
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
        <button
          type="button"
          title="Collapse status sidebar"
          onClick={() => setCollapsed(true)}
          className="rounded px-1 text-xs text-slate-500 hover:bg-slate-200"
          aria-expanded
        >
          «
        </button>
      </div>
      <ul className="divide-y divide-slate-100 p-1">
        {STATUS_ITEMS.map((item) => {
          const count = countForStatus(counts, item.key);
          const isActive = activeStatus === item.key;
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => onStatusSelect(item.key)}
                className={[
                  "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                  isActive ? item.active : `hover:bg-slate-50 ${item.tone}`
                ].join(" ")}
                aria-pressed={isActive}
              >
                <span className="font-medium">{item.label}</span>
                <span
                  className={[
                    "min-w-[1.75rem] rounded-full px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums",
                    isActive ? "bg-white/20 text-inherit" : "bg-slate-100 text-slate-700"
                  ].join(" ")}
                >
                  {count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {footer}
    </nav>
  );
}
