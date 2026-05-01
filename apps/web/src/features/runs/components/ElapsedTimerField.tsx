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
    <>
      <input
        className="w-full rounded border border-slate-300 px-2 py-1 text-xs disabled:bg-slate-50 sm:w-28"
        placeholder="elapsed"
        value={elapsed}
        disabled={isRunning}
        onBlur={onBlur}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex w-full items-center gap-1 sm:w-auto">
        <button
          type="button"
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
          disabled={isRunning}
          onClick={onStart}
        >
          Start
        </button>
        <button
          type="button"
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
          disabled={!isRunning}
          onClick={onStop}
        >
          Stop
        </button>
        <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700" onClick={onReset}>
          Reset
        </button>
      </div>
      {elapsedError ? <p className="basis-full text-xs text-red-600">{elapsedError}</p> : null}
    </>
  );
}
