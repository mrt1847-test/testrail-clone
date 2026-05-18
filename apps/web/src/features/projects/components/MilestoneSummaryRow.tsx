import { Link } from "react-router-dom";

import { buildMilestonePrintPath } from "../../print/api/printApi";
import { PrintLinkButton } from "../../print/components/PrintLinkButton";
import type { MilestoneSummaryRow as MilestoneSummary } from "../api/milestoneSummaryApi";
import type { MilestoneLifecycleStatus, MilestoneRow } from "../api/planningApi";
import { MilestoneLifecycleBadge } from "./MilestoneLifecycleBadge";
import { MilestoneProgressBar } from "./MilestoneProgressBar";
import { MilestoneScheduleBadge } from "./MilestoneScheduleBadge";

type OverviewDisplay = "compact" | "medium" | "detail";

type MilestoneSummaryRowProps = {
  projectId: string;
  row: MilestoneRow & { depth: number };
  status: MilestoneLifecycleStatus;
  rollup?: MilestoneSummary;
  display: OverviewDisplay;
  onEdit: (row: MilestoneRow) => void;
  onAddSubMilestone: (row: MilestoneRow) => void;
  onStart: (row: MilestoneRow) => void;
  onToggleComplete: (milestoneId: string, isCompleted: boolean) => void;
  onDelete: (milestoneId: string) => void;
  isMutating?: boolean;
};

function formatDate(value?: string | null) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(value)
  );
}

function activeRunText(count: number) {
  return `Has ${count} active test ${count === 1 ? "run" : "runs"}`;
}

export function MilestoneSummaryRow({
  projectId,
  row,
  status,
  rollup,
  display,
  onEdit,
  onAddSubMilestone,
  onStart,
  onToggleComplete,
  onDelete,
  isMutating = false
}: MilestoneSummaryRowProps) {
  const total = rollup?.total ?? 0;
  const passed = rollup?.passed ?? 0;
  const failed = rollup?.failed ?? 0;
  const activeRuns = rollup?.openRunCount ?? 0;
  const isCompact = display === "compact";
  const isDetail = display === "detail";

  return (
    <li
      className="flex gap-3 border-b border-slate-200 py-4 last:border-b-0"
      style={{ paddingLeft: `${row.depth * 1.25}rem` }}
    >
      <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded border border-slate-300 bg-slate-50 text-base font-semibold text-slate-500">
        M
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/projects/${projectId}/milestones/${row.id}`}
                className="font-semibold text-slate-900 hover:underline"
              >
                {row.name}
              </Link>
              {row.parentMilestoneId ? <span className="text-xs text-slate-500">Sub-milestone</span> : null}
              <MilestoneLifecycleBadge status={status} />
            </div>
            {!isCompact ? (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <span>{formatDate(row.dueDate)}</span>
                <span aria-hidden="true">|</span>
                <button
                  type="button"
                  className="text-indigo-800 hover:underline disabled:text-slate-400"
                  disabled={isMutating}
                  onClick={() => onEdit(row)}
                >
                  Edit
                </button>
                <span aria-hidden="true">|</span>
                <button
                  type="button"
                  className="text-indigo-800 hover:underline disabled:text-slate-400"
                  disabled={isMutating}
                  onClick={() => onAddSubMilestone(row)}
                >
                  Add Milestone
                </button>
                <span aria-hidden="true">|</span>
                <button
                  type="button"
                  className="text-indigo-800 hover:underline disabled:text-slate-400"
                  disabled={isMutating}
                  onClick={() => onToggleComplete(row.id, status !== "completed")}
                >
                  {status === "completed" ? "Reopen" : "Complete"}
                </button>
                <span aria-hidden="true">|</span>
                <button
                  type="button"
                  className="text-rose-700 hover:underline disabled:text-slate-400"
                  disabled={isMutating}
                  onClick={() => onDelete(row.id)}
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {rollup?.forecast && !isCompact ? (
              <span title={rollup.forecast.hint}>
                <MilestoneScheduleBadge status={rollup.forecast.scheduleStatus} />
              </span>
            ) : null}
            <PrintLinkButton
              to={buildMilestonePrintPath(projectId, row.id)}
              label="Print"
              className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            />
            {status === "upcoming" ? (
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                disabled={isMutating}
                onClick={() => onStart(row)}
              >
                Start
              </button>
            ) : null}
          </div>
        </div>

        {!isCompact ? (
          <Link
            to={`/projects/${projectId}/runs?milestoneId=${row.id}`}
            className="mt-2 inline-block text-sm text-slate-700 hover:underline"
          >
            {activeRunText(activeRuns)}
          </Link>
        ) : null}

        <MilestoneProgressBar
          projectId={projectId}
          milestoneId={row.id}
          total={total}
          passed={passed}
          failed={failed}
          className={isDetail ? "mt-3 max-w-2xl" : "mt-2 max-w-md"}
        />
        {isDetail && rollup?.includesSubMilestones ? (
          <p className="mt-1 text-xs text-slate-500">
            Includes sub-milestones ({rollup.directRunCount} direct, {rollup.runCount} total runs)
          </p>
        ) : null}
      </div>
    </li>
  );
}
