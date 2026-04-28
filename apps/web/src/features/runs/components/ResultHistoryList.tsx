import type { TestResultHistoryItem, TestResultStepItem } from "../types";

type ResultHistoryListProps = {
  history: TestResultHistoryItem[];
  isHistoryLoading: boolean;
  selectedResultId: string | null;
  onSelectResult: (resultId: string) => void;
  steps: TestResultStepItem[];
  isStepsLoading: boolean;
};

export function ResultHistoryList({
  history,
  isHistoryLoading,
  selectedResultId,
  onSelectResult,
  steps,
  isStepsLoading
}: ResultHistoryListProps) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-slate-600">Result history</p>
        <div className="mt-2 max-h-64 space-y-2 overflow-auto">
          {isHistoryLoading ? (
            <p className="text-xs text-slate-500">Loading history…</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-slate-500">No results yet.</p>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                className={
                  selectedResultId === item.id
                    ? "cursor-pointer rounded border border-slate-400 bg-slate-50 p-2"
                    : "cursor-pointer rounded border border-slate-200 p-2"
                }
                onClick={() => onSelectResult(item.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectResult(item.id);
                  }
                }}
              >
                <p className="text-xs font-medium text-slate-800">
                  {item.status} · {new Date(item.createdAt).toLocaleString()}
                </p>
                {item.comment ? <p className="text-xs text-slate-700">{item.comment}</p> : null}
                <p className="text-[11px] text-slate-500">
                  source={item.source}
                  {item.elapsed ? ` · elapsed=${item.elapsed}` : ""}
                  {item.version ? ` · version=${item.version}` : ""}
                </p>
                {item.defects.length > 0 ? (
                  <p className="text-[11px] text-slate-500">defects: {item.defects.join(", ")}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded border border-slate-200 p-2">
        <p className="text-xs font-medium text-slate-700">Step results</p>
        {!selectedResultId ? (
          <p className="mt-1 text-xs text-slate-500">Select a history item to inspect per-step results.</p>
        ) : isStepsLoading ? (
          <p className="mt-1 text-xs text-slate-500">Loading step results…</p>
        ) : steps.length === 0 ? (
          <p className="mt-1 text-xs text-slate-500">No step results for this result.</p>
        ) : (
          <div className="mt-2 max-h-40 space-y-1 overflow-auto">
            {steps.map((step) => (
              <div key={step.id} className="rounded border border-slate-100 p-2">
                <p className="text-[11px] font-medium text-slate-700">
                  Step {step.stepOrder} · {step.status}
                </p>
                {step.actualResult ? <p className="text-[11px] text-slate-600">{step.actualResult}</p> : null}
                {step.comment ? <p className="text-[11px] text-slate-500">{step.comment}</p> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
