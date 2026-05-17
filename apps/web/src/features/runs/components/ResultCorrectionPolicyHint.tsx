type Props = {
  hasHistory?: boolean;
  className?: string;
};

const DEFAULT_GUIDANCE =
  "Submitted results cannot be edited. Add a new result below to correct status, comments, or custom values.";

export function ResultCorrectionPolicyHint({ hasHistory = false, className = "" }: Props) {
  return (
    <p className={`text-xs text-slate-500 ${className}`.trim()}>
      {hasHistory
        ? "Earlier results in history are read-only. Add a new result to change the latest status or notes."
        : DEFAULT_GUIDANCE}
    </p>
  );
}
