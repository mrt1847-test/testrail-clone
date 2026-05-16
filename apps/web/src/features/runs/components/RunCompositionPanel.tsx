import { Link } from "react-router-dom";

import { caseHref } from "../../../shared/activity/activityLinks";

export type CompositionFeedback =
  | {
      kind: "added";
      addedCount: number;
      skipped: number;
      caseIds: string[];
    }
  | {
      kind: "removed";
      caseId: string;
      title: string;
    }
  | {
      kind: "synced";
      added: number;
      removed: number;
    }
  | {
      kind: "error";
      message: string;
    };

type Props = {
  projectId: string;
  compositionMode?: "static" | "include_all_live" | "dynamic_filter";
  compositionSummary?: string | null;
  filterPriority?: "" | "low" | "medium" | "high";
  filterState?: "active" | "archived";
  onFilterPriorityChange?: (value: "" | "low" | "medium" | "high") => void;
  onFilterStateChange?: (value: "active" | "archived") => void;
  isApplyingFilter?: boolean;
  onApplyFilter?: (mode: "set" | "add" | "remove") => void;
  addCasesInput: string;
  onAddCasesInputChange: (value: string) => void;
  isAdding: boolean;
  onAddCases: () => void;
  isSyncing?: boolean;
  onSyncComposition?: () => void;
  selectedTestId: string | null;
  isRemoving: boolean;
  onRemoveWithoutResults: () => void;
  onRemoveWithResults: () => void;
  feedback: CompositionFeedback | null;
  onDismissFeedback: () => void;
};

export function RunCompositionPanel(props: Props) {
  const {
    projectId,
    compositionMode = "static",
    compositionSummary,
    filterPriority = "",
    filterState = "active",
    onFilterPriorityChange,
    onFilterStateChange,
    isApplyingFilter = false,
    onApplyFilter,
    addCasesInput,
    onAddCasesInputChange,
    isAdding,
    onAddCases,
    isSyncing = false,
    onSyncComposition,
    selectedTestId,
    isRemoving,
    onRemoveWithoutResults,
    onRemoveWithResults,
    feedback,
    onDismissFeedback
  } = props;

  const liveMode = compositionMode === "include_all_live" || compositionMode === "dynamic_filter";

  return (
    <div className="rounded border border-slate-200 p-2 text-xs text-slate-600">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-700">Run composition</p>
          <p className="mt-1 text-slate-500">
            Mode: <span className="font-medium text-slate-800">{compositionMode.replace(/_/g, " ")}</span>
            {compositionSummary ? ` · ${compositionSummary}` : null}
          </p>
        </div>
        {liveMode && onSyncComposition ? (
          <button
            type="button"
            disabled={isSyncing}
            onClick={onSyncComposition}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {isSyncing ? "Syncing…" : "Sync now"}
          </button>
        ) : null}
      </div>
      {liveMode && onApplyFilter ? (
        <div className="mt-3 rounded border border-slate-100 bg-slate-50 p-2">
          <p className="text-xs font-medium text-slate-700">Filter selection</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <label className="flex flex-col gap-1 text-[11px] text-slate-600">
              Priority
              <select
                value={filterPriority}
                onChange={(e) => onFilterPriorityChange?.(e.target.value as typeof filterPriority)}
                className="rounded border border-slate-300 px-2 py-1 text-xs"
              >
                <option value="">Any</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-slate-600">
              Case state
              <select
                value={filterState}
                onChange={(e) => onFilterStateChange?.(e.target.value as "active" | "archived")}
                className="rounded border border-slate-300 px-2 py-1 text-xs"
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["set", "add", "remove"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                disabled={isApplyingFilter}
                onClick={() => onApplyFilter(mode)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                {mode === "set" ? "Set to filter" : mode === "add" ? "Add filter" : "Remove filter"}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <p className="mt-2 text-slate-500">Comma-separated case IDs to add manually.</p>

      {feedback ? (
        <div
          className={
            feedback.kind === "error"
              ? "mt-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-red-900"
              : "mt-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-emerald-900"
          }
          role="status"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              {feedback.kind === "added" ? (
                <>
                  <p>
                    Added {feedback.addedCount} test{feedback.addedCount === 1 ? "" : "s"}
                    {feedback.skipped > 0 ? ` (${feedback.skipped} already in run)` : ""}.
                  </p>
                  {feedback.caseIds.length > 0 ? (
                    <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
                      {feedback.caseIds.map((id) => (
                        <Link key={id} to={caseHref(projectId, id)} className="underline">
                          C{id}
                        </Link>
                      ))}
                    </p>
                  ) : null}
                </>
              ) : null}
              {feedback.kind === "removed" ? (
                <p>
                  Removed test for{" "}
                  <Link to={caseHref(projectId, feedback.caseId)} className="underline">
                    C{feedback.caseId}
                  </Link>
                  {feedback.title ? ` (${feedback.title})` : ""}.
                </p>
              ) : null}
              {feedback.kind === "synced" ? (
                <p>
                  Composition synced: +{feedback.added} / -{feedback.removed} tests.
                </p>
              ) : null}
              {feedback.kind === "error" ? <p>{feedback.message}</p> : null}
            </div>
            <button type="button" className="shrink-0 underline opacity-80" onClick={onDismissFeedback}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-2 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1"
          placeholder="e.g. 101, 102"
          value={addCasesInput}
          onChange={(e) => onAddCasesInputChange(e.target.value)}
        />
        <button
          type="button"
          className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
          disabled={isAdding}
          onClick={onAddCases}
        >
          {isAdding ? "Adding…" : "Add cases"}
        </button>
      </div>
      <button
        type="button"
        className="mt-2 text-rose-700 underline disabled:opacity-50"
        disabled={!selectedTestId || isRemoving}
        onClick={onRemoveWithoutResults}
      >
        Remove selected test (no results)
      </button>
      <button
        type="button"
        className="mt-1 block text-rose-800 underline disabled:opacity-50"
        disabled={!selectedTestId || isRemoving}
        onClick={onRemoveWithResults}
      >
        Remove selected test (delete results)
      </button>
    </div>
  );
}
