import { Link } from "react-router-dom";

import { useEntityContextMenu } from "../../../shared/ui/EntityContextMenu";
import { captureListStateFromSearch } from "../../projects/utils/listViewDeepLink";
import type { RunPlanOverviewItem } from "../api/runsOverviewApi";
import { formatRunListKind, formatRunListWorkSummary } from "../utils/runListHubModel";
import { RunPlanProgressBar } from "./RunPlanProgressBar";

type RunPlanSummaryRowProps = {
  projectId: string;
  item: RunPlanOverviewItem;
  highlight?: boolean;
  listSearch?: string;
  onHighlight?: () => void;
};

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
  const href = `/projects/${projectId}/${item.viewPath}`;

  return (
    <li
      data-run-row-id={item.type === "run" ? item.id : undefined}
      data-plan-row-id={item.type === "plan" ? item.id : undefined}
      className={`border-b border-slate-200 py-2 last:border-b-0 dark:border-slate-700 ${
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
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{formatRunListKind(item.type)}</p>
          <Link
            to={href}
            className="font-medium text-slate-900 underline-offset-2 hover:underline dark:text-slate-100"
            onClick={onHighlight}
          >
            {item.name}
          </Link>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{formatRunListWorkSummary(item)}</p>
        </div>
        <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {item.percentPassed}%
        </p>
      </div>
      <RunPlanProgressBar compact statusCounts={item.statusCounts} className="mt-1.5 max-w-xl" />
    </li>
  );
}
