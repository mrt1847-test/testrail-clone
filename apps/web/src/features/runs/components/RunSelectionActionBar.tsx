import { useEffect, useMemo, useState } from "react";

import type { ProjectMemberRow } from "../../projects/api/settingsApi";
import {
  Button,
  OverflowMenu,
  SelectionActionBar,
  type OverflowMenuGroup
} from "../../../shared/ui";
import type { BulkResultFeedback } from "../hooks/useRunBulkActions";
import type { ProjectStatusOption } from "../utils/projectStatuses";
import { buildRunSelectionActionBarModel } from "../utils/runSelectionActionBarModel";
import type { ResultStatus } from "./resultEntryTypes";
import { UntestedPolicyHint } from "./UntestedPolicyHint";

type Props = {
  members: ProjectMemberRow[];
  statusOptions: ProjectStatusOption[];
  selectedCount: number;
  totalMatching: number;
  allFilteredSelected: boolean;
  bulkStatus: ResultStatus;
  onBulkStatusChange: (value: ResultStatus) => void;
  bulkDisableUntested: boolean;
  bulkComment: string;
  onBulkCommentChange: (value: string) => void;
  canBulkSubmit: boolean;
  isBulkPending: boolean;
  bulkFeedback?: BulkResultFeedback | null;
  onDismissBulkFeedback?: () => void;
  onRetryFailedBulk?: () => void;
  canRetryFailedBulk?: boolean;
  onBulkSubmit: () => void;
  onClearSelection: () => void;
  onSelectAllMatching: () => void;
  selectAllMatchingBusy: boolean;
  currentUserId?: string | null;
  onAssignSelected: (assignedTo: string | null) => void;
  isAssignPending: boolean;
  readOnly?: boolean;
};

const compactSelectClass =
  "min-h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50";

function bulkFeedbackClass(type: BulkResultFeedback["type"]) {
  if (type === "success") return "bg-emerald-100 text-emerald-900";
  if (type === "partial") return "bg-amber-100 text-amber-950";
  return "bg-red-100 text-red-900";
}

function BulkResultStatus({
  feedback,
  onDismiss,
  onRetry,
  canRetry
}: {
  feedback: BulkResultFeedback;
  onDismiss?: () => void;
  onRetry?: () => void;
  canRetry?: boolean;
}) {
  const failures = "failures" in feedback ? feedback.failures ?? [] : [];
  const live = feedback.type === "success" ? "polite" : "assertive";
  return (
    <div
      className={`flex items-start justify-between gap-2 rounded px-2 py-1.5 text-xs ${bulkFeedbackClass(feedback.type)}`}
      role={feedback.type === "success" ? "status" : "alert"}
      aria-live={live}
    >
      <div className="min-w-0">
        <p>{feedback.message}</p>
        {failures.length > 0 ? (
          <ul className="mt-1 max-h-24 space-y-0.5 overflow-y-auto">
            {failures.map((row) => (
              <li key={row.caseId}>
                <span className="font-medium">{row.caseCode}</span>
                <span> — {row.title}: </span>
                <span>{row.message}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onRetry && failures.length > 0 ? (
          <Button
            variant="link"
            size="sm"
            className="text-current"
            disabled={!canRetry}
            onClick={onRetry}
            aria-label="Retry failed bulk results"
          >
            Retry
          </Button>
        ) : null}
        {onDismiss ? (
          <Button variant="link" size="sm" className="text-current" onClick={onDismiss}>
            Dismiss
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function RunSelectionActionBar({
  members,
  statusOptions,
  selectedCount,
  totalMatching,
  allFilteredSelected,
  bulkStatus,
  onBulkStatusChange,
  bulkDisableUntested,
  bulkComment,
  onBulkCommentChange,
  canBulkSubmit,
  isBulkPending,
  bulkFeedback = null,
  onDismissBulkFeedback,
  onRetryFailedBulk,
  canRetryFailedBulk = false,
  onBulkSubmit,
  onClearSelection,
  onSelectAllMatching,
  selectAllMatchingBusy,
  currentUserId,
  onAssignSelected,
  isAssignPending,
  readOnly = false
}: Props) {
  const [commentVisible, setCommentVisible] = useState(false);
  const [assignee, setAssignee] = useState("");
  const model = buildRunSelectionActionBarModel({
    selectedCount,
    totalMatching,
    allFilteredSelected,
    commentVisible
  });

  useEffect(() => {
    if (selectedCount < 1) {
      setCommentVisible(false);
      setAssignee("");
    }
  }, [selectedCount]);

  const uniqueStatuses = useMemo(() => {
    const seen = new Set<ResultStatus>();
    return statusOptions.filter((option) => {
      if (seen.has(option.canonicalStatus)) return false;
      seen.add(option.canonicalStatus);
      return true;
    });
  }, [statusOptions]);

  const groups = useMemo<OverflowMenuGroup[]>(() => {
    if (!model) return [];
    return [
      {
        id: "selection",
        label: "Selection actions",
        items: model.overflowItems
          .filter((item) => currentUserId || item.id !== "assign-to-me")
          .map((item) => {
            if (item.id === "add-comment") return { ...item, onSelect: () => setCommentVisible(true) };
            if (item.id === "hide-comment") return { ...item, onSelect: () => setCommentVisible(false) };
            if (item.id === "select-all-matching") {
              return { ...item, disabled: selectAllMatchingBusy, onSelect: onSelectAllMatching };
            }
            if (item.id === "assign-to-me") {
              return {
                ...item,
                disabled: readOnly || isAssignPending,
                onSelect: () => currentUserId && onAssignSelected(currentUserId)
              };
            }
            return {
              ...item,
              disabled: readOnly || isAssignPending,
              onSelect: () => onAssignSelected(null)
            };
          })
      }
    ];
  }, [
    currentUserId,
    isAssignPending,
    model,
    onAssignSelected,
    onSelectAllMatching,
    readOnly,
    selectAllMatchingBusy
  ]);

  const feedback = bulkFeedback ? (
    <BulkResultStatus
      feedback={bulkFeedback}
      onDismiss={onDismissBulkFeedback}
      onRetry={onRetryFailedBulk}
      canRetry={canRetryFailedBulk}
    />
  ) : null;

  if (!model) {
    return feedback ? <div className="border-b border-slate-200 px-3 py-2">{feedback}</div> : null;
  }

  return (
    <>
      <SelectionActionBar selectedCount={selectedCount} aria-label="Selected test actions">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="mr-1 whitespace-nowrap text-sm text-sky-950">{model.selectedLabel}</strong>

          <label className="sr-only" htmlFor="bulk-result-status">
            Result status
          </label>
          <select
            id="bulk-result-status"
            className={`${compactSelectClass} min-w-28`}
            value={bulkStatus}
            disabled={readOnly || isBulkPending}
            onChange={(event) => onBulkStatusChange(event.target.value as ResultStatus)}
          >
            {uniqueStatuses.map((option) => (
              <option
                key={option.canonicalStatus}
                value={option.canonicalStatus}
                disabled={bulkDisableUntested && option.isUntested}
              >
                {option.label}
              </option>
            ))}
          </select>
          <Button size="sm" disabled={readOnly || !canBulkSubmit} loading={isBulkPending} onClick={onBulkSubmit}>
            Apply result
          </Button>

          <span aria-hidden="true" className="hidden h-6 w-px bg-sky-200 sm:block" />
          <label className="sr-only" htmlFor="bulk-test-assignee">
            Selected tests assignee
          </label>
          <select
            id="bulk-test-assignee"
            className={`${compactSelectClass} min-w-32 max-w-44`}
            value={assignee}
            disabled={readOnly || isAssignPending}
            onChange={(event) => setAssignee(event.target.value)}
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.userId}>
                {member.name ?? member.email}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="sm"
            disabled={readOnly || isAssignPending}
            loading={isAssignPending}
            onClick={() => onAssignSelected(assignee || null)}
          >
            Assign
          </Button>

          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={onClearSelection}>
              Clear selection
            </Button>
            <OverflowMenu label="Selection actions" size="sm" groups={groups} />
          </div>
        </div>

        {commentVisible ? (
          <div className="mt-2 border-t border-sky-200 pt-2">
            <label className="block text-xs font-medium text-slate-700" htmlFor="bulk-result-comment">
              Result comment
            </label>
            <textarea
              id="bulk-result-comment"
              className="mt-1 block min-h-16 w-full resize-y rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={bulkComment}
              rows={2}
              disabled={readOnly || isBulkPending}
              placeholder="Optional comment for all selected tests"
              onChange={(event) => onBulkCommentChange(event.target.value)}
            />
          </div>
        ) : null}

        <UntestedPolicyHint visible={bulkDisableUntested} />
      </SelectionActionBar>
      {feedback ? <div className="border-b border-sky-200 bg-sky-50/95 px-3 pb-2">{feedback}</div> : null}
    </>
  );
}
