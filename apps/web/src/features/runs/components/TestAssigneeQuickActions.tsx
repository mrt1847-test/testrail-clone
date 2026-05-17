type Props = {
  assignedTo: string | null | undefined;
  currentUserId: string | null | undefined;
  disabled?: boolean;
  pending?: boolean;
  compact?: boolean;
  onAssignToMe: () => void;
  onClearAssignee: () => void;
};

const linkClass =
  "font-medium text-sky-700 underline hover:text-sky-900 disabled:cursor-not-allowed disabled:opacity-50";

export function TestAssigneeQuickActions({
  assignedTo,
  currentUserId,
  disabled = false,
  pending = false,
  compact = false,
  onAssignToMe,
  onClearAssignee
}: Props) {
  const isMe = Boolean(currentUserId && assignedTo === currentUserId);
  const canAssignMe = Boolean(currentUserId) && !isMe;
  const canClear = Boolean(assignedTo);

  if (!currentUserId) {
    return <span className="text-xs text-slate-400">Sign in to assign</span>;
  }

  return (
    <div className={compact ? "flex flex-wrap items-center gap-1.5" : "flex flex-wrap gap-2"}>
      <button
        type="button"
        className={linkClass}
        disabled={disabled || pending || !canAssignMe}
        title="Assign this test to you"
        onClick={onAssignToMe}
      >
        {pending ? "…" : "Assign to me"}
      </button>
      {canClear ? (
        <>
          <span className="text-slate-300">·</span>
          <button
            type="button"
            className={linkClass}
            disabled={disabled || pending}
            title="Clear assignee"
            onClick={onClearAssignee}
          >
            Clear
          </button>
        </>
      ) : null}
    </div>
  );
}
