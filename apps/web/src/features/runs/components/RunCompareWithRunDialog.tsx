import { useMemo, useState } from "react";

type RunOption = { id: string; name: string };

type Props = {
  open: boolean;
  projectId: string;
  sourceRunId: string;
  sourceRunName: string;
  runs: RunOption[];
  isPending?: boolean;
  onCancel: () => void;
  onConfirm: (otherRunId: string) => void;
};

export function RunCompareWithRunDialog({
  open,
  sourceRunId,
  sourceRunName,
  runs,
  isPending = false,
  onCancel,
  onConfirm
}: Props) {
  const [otherRunId, setOtherRunId] = useState("");

  const options = useMemo(
    () => runs.filter((run) => run.id !== sourceRunId).sort((a, b) => a.name.localeCompare(b.name)),
    [runs, sourceRunId]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="compare-runs-title"
    >
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
        <h2 id="compare-runs-title" className="text-base font-semibold text-slate-900">
          Compare runs
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Compare test statuses side-by-side. Run A is <span className="font-medium">{sourceRunName}</span>.
        </p>
        <label className="mt-4 block text-sm">
          <span className="font-medium text-slate-700">Run B</span>
          <select
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={otherRunId}
            onChange={(e) => setOtherRunId(e.target.value)}
          >
            <option value="">Select another run…</option>
            {options.map((run) => (
              <option key={run.id} value={run.id}>
                {run.name}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm"
            disabled={isPending}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            disabled={isPending || !otherRunId}
            onClick={() => onConfirm(otherRunId)}
          >
            Compare
          </button>
        </div>
      </div>
    </div>
  );
}

