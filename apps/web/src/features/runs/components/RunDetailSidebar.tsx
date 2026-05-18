import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { buildReportPageHref } from "../../projects/reports/reportRoutes";
import type { RunDetailDto } from "../types";
import { RunActivityPanel } from "./RunActivityPanel";
import { RunProgressPanel } from "./RunProgressPanel";
import { RunStatusSidebar } from "./RunStatusSidebar";

const MODE_STORAGE_KEY = "qa-rail.run-detail-sidebar-mode";

export type RunSidebarMode = "status" | "activity" | "progress" | "defects";

const MODES: Array<{ id: RunSidebarMode; label: string }> = [
  { id: "status", label: "Status" },
  { id: "activity", label: "Activity" },
  { id: "progress", label: "Progress" },
  { id: "defects", label: "Defects" }
];

type Props = {
  projectId: string;
  runId: string;
  counts: RunDetailDto["counts"];
  activeStatus: string;
  onStatusSelect: (status: string) => void;
  statusFooter?: ReactNode;
};

function readStoredMode(): RunSidebarMode {
  try {
    const value = localStorage.getItem(MODE_STORAGE_KEY);
    if (value === "activity" || value === "progress" || value === "status" || value === "defects") return value;
  } catch {
    /* ignore */
  }
  return "status";
}

export function RunDetailSidebar({
  projectId,
  runId,
  counts,
  activeStatus,
  onStatusSelect,
  statusFooter
}: Props) {
  const [mode, setMode] = useState<RunSidebarMode>(readStoredMode);

  useEffect(() => {
    try {
      localStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  if (mode === "status") {
    return (
      <RunStatusSidebar
        counts={counts}
        activeStatus={activeStatus}
        onStatusSelect={onStatusSelect}
        headerTabs={<SidebarModeTabs activeMode={mode} onModeChange={setMode} />}
        footer={statusFooter}
      />
    );
  }

  return (
    <nav
      className="shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:w-52"
      aria-label="Run detail sidebar"
    >
      <div className="border-b border-slate-100 bg-slate-50 px-2 py-2">
        <SidebarModeTabs activeMode={mode} onModeChange={setMode} />
      </div>
      {mode === "activity" ? (
        <RunActivityPanel projectId={projectId} runId={runId} />
      ) : mode === "progress" ? (
        <RunProgressPanel counts={counts} activeStatus={activeStatus} onStatusClick={onStatusSelect} />
      ) : (
        <div className="space-y-2 p-3 text-xs text-slate-600">
          <p>View defects linked across this run in the defect summary report.</p>
          <Link
            to={buildReportPageHref(projectId, "defect_summary", { runId, scopeType: "run", scopeId: runId })}
            className="inline-block font-medium text-blue-700 hover:underline"
          >
            Open defect summary →
          </Link>
          <p className="text-slate-500">Select a test and use the QPane Defects tab for per-test links.</p>
        </div>
      )}
    </nav>
  );
}

function SidebarModeTabs({
  activeMode,
  onModeChange,
  className = ""
}: {
  activeMode: RunSidebarMode;
  onModeChange: (mode: RunSidebarMode) => void;
  className?: string;
}) {
  return (
    <div className={["flex flex-wrap gap-1", className].filter(Boolean).join(" ")} role="tablist" aria-label="Run sidebar views">
      {MODES.map((item) => {
        const isActive = activeMode === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onModeChange(item.id)}
            className={[
              "rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors",
              isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-200"
            ].join(" ")}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
