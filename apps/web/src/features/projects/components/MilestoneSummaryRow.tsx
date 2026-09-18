import { Link } from "react-router-dom";

import { Button, buttonClassName } from "../../../shared/ui";
import { buildMilestonePrintPath } from "../../print/api/printApi";
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
  onDelete: (row: MilestoneRow) => void;
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
      className="flex gap-2.5 border-b border-slate-200 py-3 last:border-b-0"
      style={{ paddingLeft: `${row.depth * 1.25}rem` }}
    >
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded border border-slate-300 bg-slate-50 text-sm font-semibold text-slate-500">
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
                <Button variant="link" size="sm" disabled={isMutating} onClick={() => onEdit(row)}>
                  Edit
                </Button>
                <span aria-hidden="true">|</span>
                <Button variant="link" size="sm" disabled={isMutating} onClick={() => onAddSubMilestone(row)}>
                  Add sub-milestone
                </Button>
                <span aria-hidden="true">|</span>
                <Button
                  variant="link"
                  size="sm"
                  disabled={isMutating}
                  onClick={() => onToggleComplete(row.id, status !== "completed")}
                >
                  {status === "completed" ? "Reopen" : "Complete"}
                </Button>
                <span aria-hidden="true">|</span>
                <Button
                  variant="link"
                  size="sm"
                  className="text-rose-700"
                  disabled={isMutating}
                  onClick={() => onDelete(row)}
                >
                  Delete
                </Button>
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {rollup?.forecast && !isCompact ? (
              <span title={rollup.forecast.hint}>
                <MilestoneScheduleBadge status={rollup.forecast.scheduleStatus} />
              </span>
            ) : null}
            <Link
              className={buttonClassName({ variant: "secondary", size: "sm" })}
              to={buildMilestonePrintPath(projectId, row.id)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Print
            </Link>
            {status === "upcoming" ? (
              <Button size="sm" variant="secondary" disabled={isMutating} onClick={() => onStart(row)}>
                Start
              </Button>
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
