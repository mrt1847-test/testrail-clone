type ElapsedTimerFieldProps = {
  elapsed: string;
  elapsedError: string;
  isRunning: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
};

export function ElapsedTimerField({
  elapsed,
  elapsedError,
  isRunning,
  onChange,
  onBlur,
  onStart,
  onStop,
  onReset
}: ElapsedTimerFieldProps) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-slate-600">
        Elapsed
        <input
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm font-normal text-slate-800 outline-none focus:border-slate-500 disabled:bg-slate-50"
          placeholder="e.g. 3m 20s"
          value={elapsed}
          disabled={isRunning}
          onBlur={onBlur}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          className="rounded border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50"
          disabled={isRunning}
          onClick={onStart}
        >
          Start
        </button>
        <button
          type="button"
          className="rounded border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50"
          disabled={!isRunning}
          onClick={onStop}
        >
          Stop
        </button>
        <button type="button" className="rounded border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700" onClick={onReset}>
          Reset
        </button>
      </div>
      {elapsedError ? <p className="text-xs text-red-600">{elapsedError}</p> : null}
    </div>
  );
}
