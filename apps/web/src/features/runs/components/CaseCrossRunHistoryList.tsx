import { Link } from "react-router-dom";

import { StatusBadge } from "../../../shared/ui/StatusBadge";
import type { CaseExecutionHistoryItem } from "../types";
import { CaseExecutionTrendChart } from "./CaseExecutionTrendChart";

type Props = {
  projectId: string;
  currentRunId: string;
  items: CaseExecutionHistoryItem[];
  isLoading: boolean;
};

export function CaseCrossRunHistoryList({ projectId, currentRunId, items, isLoading }: Props) {
  if (isLoading) {
    return <p className="text-xs text-slate-500">Loading execution history…</p>;
  }

  if (items.length === 0) {
    return <p className="text-xs text-slate-500">No results recorded for this case in other runs yet.</p>;
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Trend (all runs)</p>
        <CaseExecutionTrendChart items={items} className="mt-1" />
      </div>
      <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
        {items.map((item) => {
          const inCurrentRun = item.runId === currentRunId;
          return (
            <li
              key={item.resultId}
              className={`rounded border px-2 py-1.5 ${inCurrentRun ? "border-sky-200 bg-sky-50/60" : "border-slate-200 bg-white"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-1">
                <Link
                  to={`/projects/${projectId}/runs/${item.runId}?testId=${item.testId}`}
                  className="font-medium text-blue-700 hover:underline"
                >
                  {item.runName}
                  {item.runClosed ? " (closed)" : ""}
                </Link>
                <StatusBadge status={item.status} />
              </div>
              <p className="mt-0.5 text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
              {item.comment ? <p className="mt-1 text-slate-700">{item.comment}</p> : null}
              {item.defects.length > 0 ? (
                <p className="mt-1 text-slate-600">Defects: {item.defects.join(", ")}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
