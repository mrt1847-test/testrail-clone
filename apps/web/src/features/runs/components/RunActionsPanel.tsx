import type { ProjectMemberRow } from "../../projects/api/settingsApi";
import type { BulkResultFeedback } from "../hooks/useRunBulkActions";
import type { ResultStatus } from "./resultEntryTypes";

type Props = {
  members: ProjectMemberRow[];
  bulkStatus: ResultStatus;
  onBulkStatusChange: (value: ResultStatus) => void;
  bulkComment: string;
  onBulkCommentChange: (value: string) => void;
  canBulkSubmit: boolean;
  isBulkPending: boolean;
  selectedCount: number;
  bulkFeedback?: BulkResultFeedback | null;
  onDismissBulkFeedback?: () => void;
  onBulkSubmit: () => void;
  assigneeInput: string;
  onAssigneeInputChange: (value: string) => void;
  isAssignPending: boolean;
  onAssignRun: () => void;
  isRerunPending: boolean;
  onOpenRerunDialog: () => void;
  canCloseRun: boolean;
  isCloseRunPending: boolean;
  onOpenCloseRunDialog: () => void;
  canReopenRun: boolean;
  isReopenRunPending: boolean;
  onReopenRun: () => void;
};

function bulkFeedbackClass(feedback: BulkResultFeedback) {
  if (feedback.type === "success") {
    return "mb-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-emerald-900";
  }
  if (feedback.type === "partial") {
    return "mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-950";
  }
  return "mb-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-red-900";
}

export function RunActionsPanel(props: Props) {
  const {
    members,
    bulkStatus,
    onBulkStatusChange,
    bulkComment,
    onBulkCommentChange,
    canBulkSubmit,
    isBulkPending,
    selectedCount,
    bulkFeedback = null,
    onDismissBulkFeedback,
    onBulkSubmit,
    assigneeInput,
    onAssigneeInputChange,
    isAssignPending,
    onAssignRun,
    isRerunPending,
    onOpenRerunDialog,
    canCloseRun,
    isCloseRunPending,
    onOpenCloseRunDialog,
    canReopenRun,
    isReopenRunPending,
    onReopenRun
  } = props;

  const failureRows =
    bulkFeedback && (bulkFeedback.type === "partial" || bulkFeedback.type === "error")
      ? bulkFeedback.failures ?? []
      : [];

  return (
    <div className="space-y-2">
      <div className="rounded border border-slate-200 p-2 text-xs text-slate-600">
        <p className="mb-2 font-medium text-slate-700">Bulk manual result entry</p>
        {bulkFeedback ? (
          <div className={bulkFeedbackClass(bulkFeedback)} role="status">
            <div className="flex items-start justify-between gap-2">
              <p>{bulkFeedback.message}</p>
              {onDismissBulkFeedback ? (
                <button
                  type="button"
                  className="shrink-0 underline opacity-80 hover:opacity-100"
                  onClick={onDismissBulkFeedback}
                >
                  Dismiss
                </button>
              ) : null}
            </div>
            {failureRows.length > 0 ? (
              <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto border-t border-current/10 pt-2 text-[11px]">
                {failureRows.map((row) => (
                  <li key={row.caseId}>
                    <span className="font-medium">{row.caseCode}</span>
                    <span className="text-current/80"> — {row.title}: </span>
                    <span>{row.message}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <select
              className="rounded border border-slate-300 px-2 py-1"
              value={bulkStatus}
              onChange={(e) => onBulkStatusChange(e.target.value as ResultStatus)}
            >
              <option value="passed">passed</option>
              <option value="failed">failed</option>
              <option value="blocked">blocked</option>
              <option value="retest">retest</option>
              <option value="untested">untested</option>
            </select>
            <input
              className="flex-1 rounded border border-slate-300 px-2 py-1"
              placeholder="comment (optional)"
              value={bulkComment}
              onChange={(e) => onBulkCommentChange(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
            disabled={!canBulkSubmit}
            onClick={onBulkSubmit}
          >
            {isBulkPending ? "Applying…" : `Apply to selected (${selectedCount})`}
          </button>
        </div>
      </div>
      <div className="rounded border border-slate-200 p-2 text-xs text-slate-600">
        <div className="flex gap-2">
          <select
            className="flex-1 rounded border border-slate-300 px-2 py-1"
            value={assigneeInput}
            onChange={(e) => onAssigneeInputChange(e.target.value)}
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.userId}>
                {member.name ?? member.email} ({member.role})
              </option>
            ))}
          </select>
          <button type="button" className="rounded border border-slate-300 px-2 py-1" disabled={isAssignPending} onClick={onAssignRun}>
            Assign
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs" disabled={isRerunPending} onClick={onOpenRerunDialog}>
          Rerun…
        </button>
        <button
          type="button"
          className="rounded bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-50"
          disabled={!canCloseRun || isCloseRunPending}
          onClick={onOpenCloseRunDialog}
        >
          Close run
        </button>
        <button
          type="button"
          className="rounded border border-emerald-700 px-2 py-1 text-xs text-emerald-800 disabled:opacity-50"
          disabled={!canReopenRun || isReopenRunPending}
          onClick={onReopenRun}
        >
          {isReopenRunPending ? "Reopening…" : "Reopen run"}
        </button>
      </div>
    </div>
  );
}