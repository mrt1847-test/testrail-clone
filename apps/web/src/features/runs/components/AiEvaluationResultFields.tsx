type AiEvaluationResultFieldsProps = {
  expectedOutput?: string;
  actualOutput: string;
  qualityRating: string;
  latencyMs: string;
  traces: string;
  onActualOutputChange: (value: string) => void;
  onQualityRatingChange: (value: string) => void;
  onLatencyMsChange: (value: string) => void;
  onTracesChange: (value: string) => void;
};

export function AiEvaluationResultFields({
  expectedOutput,
  actualOutput,
  qualityRating,
  latencyMs,
  traces,
  onActualOutputChange,
  onQualityRatingChange,
  onLatencyMsChange,
  onTracesChange
}: AiEvaluationResultFieldsProps) {
  return (
    <div className="space-y-3 rounded-md border border-violet-200 bg-violet-50/50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-900">AI evaluation</p>
      {expectedOutput?.trim() ? (
        <p className="text-xs text-slate-600">
          <span className="font-medium text-slate-700">Expected output:</span> {expectedOutput}
        </p>
      ) : null}
      <label className="grid gap-1 text-sm text-slate-700">
        <span>Actual output</span>
        <textarea
          value={actualOutput}
          onChange={(event) => onActualOutputChange(event.target.value)}
          className="min-h-[72px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm text-slate-700">
          <span>Quality rating (1–5)</span>
          <input
            type="number"
            min={1}
            max={5}
            value={qualityRating}
            onChange={(event) => onQualityRatingChange(event.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-700">
          <span>Latency (ms)</span>
          <input
            type="number"
            min={0}
            value={latencyMs}
            onChange={(event) => onLatencyMsChange(event.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
          />
        </label>
      </div>
      <label className="grid gap-1 text-sm text-slate-700">
        <span>Traces</span>
        <textarea
          value={traces}
          onChange={(event) => onTracesChange(event.target.value)}
          className="min-h-[64px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
        />
      </label>
    </div>
  );
}
