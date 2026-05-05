import type { ProjectMemberRow } from "../../projects/api/settingsApi";
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

  return (
    <div className="mt-6 space-y-2 border-t border-slate-100 pt-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Run actions</h4>
      <div className="rounded border border-slate-200 p-2 text-xs text-slate-600">
        <p className="mb-2 font-medium text-slate-700">Bulk manual result entry</p>
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
          <button className="rounded border border-slate-300 px-2 py-1" disabled={isAssignPending} onClick={onAssignRun}>
            Assign
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="rounded border border-slate-300 px-2 py-1 text-xs" disabled={isRerunPending} onClick={onOpenRerunDialog}>
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
