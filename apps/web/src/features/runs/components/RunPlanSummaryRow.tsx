import { Link } from "react-router-dom";

import { useEntityContextMenu } from "../../../shared/ui/EntityContextMenu";
import { captureListStateFromSearch } from "../../projects/utils/listViewDeepLink";
import type { RunPlanOverviewItem } from "../api/runsOverviewApi";
import { formatRunStatusSummary } from "../utils/formatRunStatusSummary";
import { RunPlanProgressBar } from "./RunPlanProgressBar";

type RunPlanSummaryRowProps = {
  projectId: string;
  item: RunPlanOverviewItem;
  highlight?: boolean;
  listSearch?: string;
  onHighlight?: () => void;
};

function formatCreatedMeta(createdAt: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(createdAt));
}

export function RunPlanSummaryRow({
  projectId,
  item,
  highlight = false,
  listSearch = "",
  onHighlight
}: RunPlanSummaryRowProps) {
  const { openEntityContextMenu } = useEntityContextMenu();
  const entityKind = item.type === "plan" ? "plan" : "run";
  const listParams =
    item.type === "run" && listSearch ? captureListStateFromSearch(listSearch, "run-list") : undefined;

  return (
    <li
      data-run-row-id={item.type === "run" ? item.id : undefined}
      data-plan-row-id={item.type === "plan" ? item.id : undefined}
      className={`flex gap-3 border-b border-slate-200 py-4 last:border-b-0 dark:border-slate-700 ${
        highlight ? "bg-sky-50/80 dark:bg-sky-950/40" : ""
      }`}
      onContextMenu={(event) =>
        openEntityContextMenu(event, {
          projectId,
          kind: entityKind,
          entityId: item.id,
          listSearchParams: listParams
        })
      }
    >
      <div
        className={`mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded border text-base font-semibold ${
          item.type === "plan"
            ? "border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-200"
            : "border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
        }`}
      >
        {item.type === "plan" ? "P" : "R"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              to={`/projects/${projectId}/${item.viewPath}`}
              className="font-semibold text-slate-900 hover:underline dark:text-slate-100"
              onClick={onHighlight}
            >
              {item.name}
            </Link>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              <span>{formatCreatedMeta(item.createdAt)}</span>
              <span aria-hidden="true"> · </span>
              <Link
                to={`/projects/${projectId}/${item.editPath}`}
                className="text-indigo-800 hover:underline dark:text-indigo-300"
              >
                Edit
              </Link>
            </p>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{formatRunStatusSummary(item.statusCounts)}</p>
          </div>
          <p className="shrink-0 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {item.percentPassed}%
          </p>
        </div>
        <RunPlanProgressBar statusCounts={item.statusCounts} className="mt-3 max-w-2xl" />
      </div>
    </li>
  );
}
