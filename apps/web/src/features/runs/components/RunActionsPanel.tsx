import type { ProjectMemberRow } from "../../projects/api/settingsApi";
import type { BulkResultFeedback } from "../hooks/useRunBulkActions";
import type { ProjectStatusOption } from "../utils/projectStatuses";
import type { ResultStatus } from "./resultEntryTypes";
import { pickDefaultStatusOption, StatusPicker } from "./StatusPicker";
import { UntestedPolicyHint } from "./UntestedPolicyHint";

type Props = {
  members: ProjectMemberRow[];
  statusOptions: ProjectStatusOption[];
  bulkDisableUntested: boolean;
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
  onAssignRunToMe?: () => void;
  onClearRunAssignee?: () => void;
  currentUserId?: string | null;
  onAssignSelectedToMe?: () => void;
  onClearSelectedAssignees?: () => void;
  isTestAssignPending?: boolean;
  isRerunPending: boolean;
  onOpenRerunDialog: () => void;
  isDuplicatePending?: boolean;
  onOpenDuplicateDialog?: () => void;
  onOpenCompareDialog?: () => void;
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
    statusOptions,
    bulkDisableUntested,
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
    onAssignRunToMe,
    onClearRunAssignee,
    currentUserId,
    onAssignSelectedToMe,
    onClearSelectedAssignees,
    isTestAssignPending = false,
    isRerunPending,
    onOpenRerunDialog,
    isDuplicatePending = false,
    onOpenDuplicateDialog,
    onOpenCompareDialog,
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

  const bulkActiveStatus =
    statusOptions.find((option) => option.canonicalStatus === bulkStatus) ??
    pickDefaultStatusOption(statusOptions, bulkStatus);

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
          <StatusPicker
            options={statusOptions}
            selectedId={bulkActiveStatus.id}
            disableUntested={bulkDisableUntested}
            columns={3}
            onSelect={(option) => onBulkStatusChange(option.canonicalStatus)}
          />
          <UntestedPolicyHint visible={bulkDisableUntested} />
          <input
            className="w-full rounded border border-slate-300 px-2 py-1"
            placeholder="comment (optional)"
            value={bulkComment}
            onChange={(e) => onBulkCommentChange(e.target.value)}
          />
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
            disabled={!canBulkSubmit}
            onClick={onBulkSubmit}
          >
            {isBulkPending ? "Applying…" : `Apply to selected (${selectedCount})`}
          </button>
          {selectedCount > 0 && currentUserId && onAssignSelectedToMe && onClearSelectedAssignees ? (
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-2">
              <button
                type="button"
                className="rounded border border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-900 disabled:opacity-50"
                disabled={isTestAssignPending}
                onClick={onAssignSelectedToMe}
              >
                {isTestAssignPending ? "Assigning…" : "Assign selected to me"}
              </button>
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                disabled={isTestAssignPending}
                onClick={onClearSelectedAssignees}
              >
                Clear selected assignees
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <div className="rounded border border-slate-200 p-2 text-xs text-slate-600">
        <p className="mb-2 font-medium text-slate-700">Run assignee</p>
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
        {currentUserId && onAssignRunToMe && onClearRunAssignee ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded border border-sky-200 bg-sky-50 px-2 py-1 text-sky-900 disabled:opacity-50"
              disabled={isAssignPending}
              onClick={onAssignRunToMe}
            >
              Assign run to me
            </button>
            <button
              type="button"
              className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
              disabled={isAssignPending}
              onClick={onClearRunAssignee}
            >
              Clear run assignee
            </button>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {onOpenDuplicateDialog ? (
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
            disabled={isDuplicatePending}
            onClick={onOpenDuplicateDialog}
          >
            Duplicate run…
          </button>
        ) : null}
        {onOpenCompareDialog ? (
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1 text-xs"
            onClick={onOpenCompareDialog}
          >
            Compare with run…
          </button>
        ) : null}
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
