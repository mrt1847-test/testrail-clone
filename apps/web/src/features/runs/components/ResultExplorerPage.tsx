import { useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";

export function ResultExplorerPage() {
  const { runId } = useParams();

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Result Explorer</h2>
        <p className="mt-2 text-sm text-slate-700">
          Scope: {runId ? `Run ${runId}` : "Project-wide"} / filters: status, source, case, run.
        </p>
      </div>
      <EmptyState
        title="No results yet"
        description="Result history rows with metadata, logs, and attachments will render here."
      />
    </div>
  );
}
