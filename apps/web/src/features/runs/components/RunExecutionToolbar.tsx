import { Button } from "../../../shared/ui/Button";

type Props = {
  isNavigating: boolean;
  onNextFailed: () => void;
  onNextBlocked: () => void;
  onNextUntested?: () => void;
  onPassAndNext?: () => void;
  isSavingResult?: boolean;
  jumpToNext?: boolean;
  onJumpToNextChange?: (enabled: boolean) => void;
  onPrevTest: () => void;
  onNextTest: () => void;
  onShowShortcuts?: () => void;
  /** `inline` = no card chrome (fits under status sidebar). */
  variant?: "card" | "inline";
};

export function RunExecutionToolbar({
  isNavigating,
  onNextFailed,
  onNextBlocked,
  onNextUntested,
  onPassAndNext,
  isSavingResult = false,
  jumpToNext,
  onJumpToNextChange,
  onPrevTest,
  onNextTest,
  onShowShortcuts,
  variant = "card"
}: Props) {
  const passBusy = isNavigating || isSavingResult;
  const buttons = (
    <>
      {onPassAndNext ? (
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={passBusy}
          onClick={onPassAndNext}
          title="Pass current test and go to next (P)"
        >
          Pass &amp; Next
        </Button>
      ) : null}
      <Button type="button" size="sm" variant="secondary" disabled={isNavigating} onClick={onNextFailed} title="Next failed (F)">
        Failed →
      </Button>
      <Button type="button" size="sm" variant="secondary" disabled={isNavigating} onClick={onNextBlocked} title="Next blocked (B)">
        Blocked →
      </Button>
      {onNextUntested ? (
        <Button type="button" size="sm" variant="secondary" disabled={isNavigating} onClick={onNextUntested} title="Next untested (U)">
          Untested →
        </Button>
      ) : null}
      <Button type="button" size="sm" variant="secondary" disabled={isNavigating} onClick={onPrevTest} title="Previous test (K)">
        ← Prev
      </Button>
      <Button type="button" size="sm" variant="secondary" disabled={isNavigating} onClick={onNextTest} title="Next test (J)">
        Next →
      </Button>
      {onShowShortcuts ? (
        <Button type="button" size="sm" variant="secondary" onClick={onShowShortcuts} title="Keyboard shortcuts">
          ?
        </Button>
      ) : null}
      {onJumpToNextChange != null && jumpToNext != null ? (
        <label className="ml-1 inline-flex items-center gap-1 text-[10px] text-slate-600">
          <input
            type="checkbox"
            className="rounded border-slate-300"
            checked={jumpToNext}
            onChange={(e) => onJumpToNextChange(e.target.checked)}
          />
          Jump to next after save
        </label>
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
