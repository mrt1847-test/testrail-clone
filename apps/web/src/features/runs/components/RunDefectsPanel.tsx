import { Link } from "react-router-dom";

import { buildReportPageHref } from "../../projects/reports/reportRoutes";
import type { ResultDefectLinkItem, TestResultHistoryItem } from "../types";

type Props = {
  projectId: string;
  runId: string;
  history: TestResultHistoryItem[];
  linkedDefects: ResultDefectLinkItem[];
  isLoading?: boolean;
  onOpenPushDefect?: () => void;
  canPushDefect?: boolean;
};

function uniqueDefectKeys(history: TestResultHistoryItem[], links: ResultDefectLinkItem[]) {
  const keys = new Set<string>();
  for (const item of history) {
    for (const key of item.defects ?? []) {
      const trimmed = key.trim();
      if (trimmed) keys.add(trimmed);
    }
  }
  for (const link of links) {
    const trimmed = link.defectKey.trim();
    if (trimmed) keys.add(trimmed);
  }
  return [...keys].sort((left, right) => left.localeCompare(right));
}

export function RunDefectsPanel({
  projectId,
  runId,
  history,
  linkedDefects,
  isLoading,
  onOpenPushDefect,
  canPushDefect
}: Props) {
  const defectKeys = uniqueDefectKeys(history, linkedDefects);

  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-slate-600">
        Defects linked on results in this test and integration links for the selected result.
      </p>
      {canPushDefect && onOpenPushDefect ? (
        <button
          type="button"
          className="rounded border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-900 hover:bg-indigo-100"
          onClick={onOpenPushDefect}
        >
          Push defect…
        </button>
      ) : null}
      {isLoading ? <p className="text-xs text-slate-500">Loading defects…</p> : null}
      {!isLoading && defectKeys.length === 0 ? (
        <p className="text-xs text-slate-500">No defects recorded for this test yet.</p>
      ) : null}
      {defectKeys.length > 0 ? (
        <ul className="space-y-1 text-xs">
          {defectKeys.map((key) => (
            <li key={key} className="rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-slate-800">
              {key}
            </li>
          ))}
        </ul>
      ) : null}
      {linkedDefects.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Integration links</p>
          <ul className="space-y-1 text-xs">
            {linkedDefects.map((link) => (
              <li key={link.id} className="rounded border border-slate-200 px-2 py-1">
                <span className="font-mono text-slate-800">{link.defectKey}</span>
                {link.url ? (
                  <a href={link.url} target="_blank" rel="noreferrer" className="ml-2 text-blue-700 hover:underline">
                    Open
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Link
        to={buildReportPageHref(projectId, "defect_summary", { runId, scopeType: "run", scopeId: runId })}
        className="inline-block text-xs font-medium text-blue-700 hover:underline"
      >
        Open defect summary report for this run →
      </Link>
    </div>
  );
}
