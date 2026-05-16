type Props = {
  isNavigating: boolean;
  onNextFailed: () => void;
  onNextBlocked: () => void;
  onPrevTest: () => void;
  onNextTest: () => void;
  onShowShortcuts?: () => void;
  /** `inline` = no card chrome (fits under status sidebar). */
  variant?: "card" | "inline";
};

const btnClass =
  "rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

export function RunExecutionToolbar({
  isNavigating,
  onNextFailed,
  onNextBlocked,
  onPrevTest,
  onNextTest,
  onShowShortcuts,
  variant = "card"
}: Props) {
  const buttons = (
    <>
      <button type="button" className={btnClass} disabled={isNavigating} onClick={onNextFailed} title="Next failed (F)">
        Failed →
      </button>
      <button type="button" className={btnClass} disabled={isNavigating} onClick={onNextBlocked} title="Next blocked (B)">
        Blocked →
      </button>
      <button type="button" className={btnClass} disabled={isNavigating} onClick={onPrevTest} title="Previous test (K)">
        ← Prev
      </button>
      <button type="button" className={btnClass} disabled={isNavigating} onClick={onNextTest} title="Next test (J)">
        Next →
      </button>
      {onShowShortcuts ? (
        <button type="button" className={btnClass} onClick={onShowShortcuts} title="Keyboard shortcuts">
          ?
        </button>
      ) : null}
    </>
  );

  if (variant === "inline") {
    return (
      <div className="flex flex-wrap gap-1 border-t border-slate-100 p-2" aria-label="Test execution navigation">
        {buttons}
      </div>
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
      aria-label="Test execution navigation"
    >
      {buttons}
    </div>
  );
}
