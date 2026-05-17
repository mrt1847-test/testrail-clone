import type { BulkCaseFeedback } from "../utils/bulkCaseFeedback";
import { bulkCaseFeedbackClass } from "../utils/bulkCaseFeedback";

type BulkCaseResultBannerProps = {
  feedback: BulkCaseFeedback | null;
  onDismiss?: () => void;
};

export function BulkCaseResultBanner({ feedback, onDismiss }: BulkCaseResultBannerProps) {
  if (!feedback) return null;

  const failures = feedback.failures ?? [];

  return (
    <div className={bulkCaseFeedbackClass(feedback)} role="status">
      <div className="flex items-start justify-between gap-2">
        <p>{feedback.message}</p>
        {onDismiss ? (
          <button type="button" className="shrink-0 text-xs underline opacity-80 hover:opacity-100" onClick={onDismiss}>
            Dismiss
          </button>
        ) : null}
      </div>
      {failures.length > 0 ? (
        <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto border-t border-current/10 pt-2 text-xs">
          {failures.map((row) => (
            <li key={row.caseId}>
              <span className="font-medium">{row.label}</span>
              <span className="opacity-80"> — {row.error}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
