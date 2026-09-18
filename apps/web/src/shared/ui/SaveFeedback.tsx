import { Button } from "./Button";

export type SaveFeedbackStatus = "idle" | "saving" | "saved" | "failed";

type SaveFeedbackProps = {
  status: SaveFeedbackStatus;
  message?: string;
  onRetry?: () => void;
  onUndo?: () => void;
  className?: string;
};

const STATUS_CLASS: Record<Exclude<SaveFeedbackStatus, "idle">, string> = {
  saving: "text-slate-600",
  saved: "text-emerald-700",
  failed: "text-red-700"
};

export function SaveFeedback({ status, message, onRetry, onUndo, className = "" }: SaveFeedbackProps) {
  if (status === "idle") return null;
  const label = message ?? (status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Failed");
  return (
    <div
      className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-4 ${STATUS_CLASS[status]} ${className}`.trim()}
      data-save-feedback=""
      data-save-feedback-status={status}
      role={status === "failed" ? "alert" : "status"}
      aria-live={status === "failed" ? "assertive" : "polite"}
    >
      <span className="min-w-0 truncate">{label}</span>
      {status === "failed" && onRetry ? (
        <Button type="button" variant="link" size="sm" className="text-[11px] text-red-800" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
      {status === "saved" && onUndo ? (
        <Button type="button" variant="link" size="sm" className="text-[11px]" onClick={onUndo}>
          Undo
        </Button>
      ) : null}
    </div>
  );
}
