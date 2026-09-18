import { useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import {
  hasRangeMultiSelectModifier,
  resolveRangeMultiSelectClick
} from "../../../shared/selection/rangeMultiSelect";
import type { TestInstanceRow } from "../types";
import { useProjectStatuses } from "../hooks/useProjectStatuses";
import { pickDefaultStatusOption } from "./StatusPicker";
import type { ResultStatus } from "./resultEntryTypes";
import { SaveFeedback, type SaveFeedbackStatus } from "../../../shared/ui";
import { StatusBadge } from "../../../shared/ui/StatusBadge";
import type { ProjectMemberRow } from "../../projects/api/settingsApi";
import { memberLabelForUserId } from "../utils/assigneeDisplay";
import { TestAssigneeQuickActions } from "./TestAssigneeQuickActions";
import type { RunListColumn } from "../utils/runInstanceColumns";
import { RUN_LIST_COLUMN_LABELS } from "../utils/runInstanceColumns";
import { tableDensityClasses, type UiDensity } from "../../../shared/ui/density/uiDensity";
import { isEvidenceRequiringStatus } from "../utils/runSelectedTestState";
import {
  runTestRowClassName,
  runTestTitleClassName,
  showInlineAssigneeActions
} from "../utils/runExecutionDensity";

function formatCaseMeta(value: string | null | undefined) {
  if (!value) return "—";
  const normalized = value.trim();
  if (!normalized) return "—";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

export type TestInstanceTableGroup = {
  groupLabel: string;
  sectionId?: string | null;
  instances: TestInstanceRow[];
};

type Props = {
  projectId: string;
  pagedInstances: TestInstanceRow[];
  groups?: TestInstanceTableGroup[];
  inlineStatusSelect?: boolean;
  hidePagination?: boolean;
  selectedInstanceId: string | null;
  onSelectInstance: (instance: TestInstanceRow) => void;
  selectedTestIds: string[];
  setSelectedTestIds: Dispatch<SetStateAction<string[]>>;
  allPageSelected: boolean;
  allFilteredSelected: boolean;
  onSelectAllMatchingFilter: () => void;
  selectAllMatchingBusy: boolean;
  onQuickResultSave: (
    testId: string,
    payload: { status: ResultStatus; comment?: string; elapsed?: string; version?: string; defects?: string[] }
  ) => void;
  onComposeResult?: (instance: TestInstanceRow, status: ResultStatus) => void;
  isSavingQuickResult: boolean;
  saveFeedback?: {
    testId: string;
    status: SaveFeedbackStatus;
    message: string;
    canUndo: boolean;
  } | null;
  onRetrySave?: () => void;
  onUndoSave?: () => void;
  page: number;
  totalPages: number;
  total: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  subscribedTestIds?: Set<string>;
  onToggleSubscribe?: (testId: string, subscribed: boolean) => void;
  isSubscribePending?: boolean;
  members?: ProjectMemberRow[];
  currentUserId?: string | null;
  onAssignTest: (testId: string, assignedTo: string | null) => void;
  assigningTestId?: string | null;
  runClosed?: boolean;
  visibleColumns?: RunListColumn[];
  density?: UiDensity;
};

export function TestInstanceTable(props: Props) {
  const {
    projectId,
    pagedInstances,
    selectedInstanceId,
    onSelectInstance,
    selectedTestIds,
    setSelectedTestIds,
    allPageSelected,
    allFilteredSelected,
    onSelectAllMatchingFilter,
    selectAllMatchingBusy,
    onQuickResultSave,
    onComposeResult,
    isSavingQuickResult,
    saveFeedback = null,
    onRetrySave,
    onUndoSave,
    page,
    totalPages,
    total,
    onPrevPage,
    onNextPage,
    subscribedTestIds,
    onToggleSubscribe,
    isSubscribePending,
    members = [],
    currentUserId,
    onAssignTest,
    assigningTestId = null,
    runClosed = false,
    groups,
    inlineStatusSelect = false,
    hidePagination = false,
    visibleColumns = [],
    density = "compact"
  } = props;
  const densityClasses = tableDensityClasses(density);
  const showPriority = visibleColumns.includes("priority");
  const showType = visibleColumns.includes("type");
  const columnCount = 6 + (showPriority ? 1 : 0) + (showType ? 1 : 0) + (onToggleSubscribe ? 1 : 0);
  const statusQuery = useProjectStatuses(projectId);
  const statusOptions = statusQuery.data ?? [];

  const selectionAnchorIndexRef = useRef<number | null>(null);
  const skipNextCheckboxChangeRef = useRef(false);
  const displayRows = useMemo(() => {
    if (groups?.length) return groups.flatMap((group) => group.instances);
    return pagedInstances;
  }, [groups, pagedInstances]);
  const orderedTestIds = useMemo(() => displayRows.map((row) => row.id), [displayRows]);

  useEffect(() => {
    selectionAnchorIndexRef.current = null;
  }, [page]);

  function handleTestSelectClick(event: React.MouseEvent<HTMLInputElement>, testId: string) {
    if (!hasRangeMultiSelectModifier(event)) return;
    event.preventDefault();
    skipNextCheckboxChangeRef.current = true;
    const result = resolveRangeMultiSelectClick({
      orderedIds: orderedTestIds,
      clickedId: testId,
      selected: new Set(selectedTestIds),
      anchorIndex: selectionAnchorIndexRef.current,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey
    });
    if (result.kind === "applied") {
      setSelectedTestIds(Array.from(result.selected));
      selectionAnchorIndexRef.current = result.anchorIndex;
    }
  }

  function toggleTestSelection(testId: string, checked: boolean) {
    setSelectedTestIds((prev) =>
      checked ? Array.from(new Set([...prev, testId])) : prev.filter((id) => id !== testId)
    );
    const index = orderedTestIds.indexOf(testId);
    if (index >= 0) selectionAnchorIndexRef.current = index;
  }

  function statusOptionForRow(row: TestInstanceRow) {
    return (
      statusOptions.find((option) => option.canonicalStatus === row.status) ??
      pickDefaultStatusOption(statusOptions, row.status as ResultStatus)
    );
  }

  function renderInstanceRow(row: TestInstanceRow) {
    const statusOption = statusOptionForRow(row);
    return (
      <tr
        key={row.id}
        data-test-id={row.id}
        data-run-test-row=""
        aria-selected={selectedInstanceId === row.id}
        className={runTestRowClassName(selectedInstanceId === row.id)}
        onClick={() => onSelectInstance(row)}
      >
        <td className={densityClasses.cell} onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            aria-label={`Select ${row.caseCode}`}
            checked={selectedTestIds.includes(row.id)}
            onChange={(e) => {
              if (skipNextCheckboxChangeRef.current) {
                skipNextCheckboxChangeRef.current = false;
                return;
              }
              toggleTestSelection(row.id, e.target.checked);
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleTestSelectClick(e, row.id);
            }}
          />
        </td>
        <td className={`${densityClasses.cell} font-mono text-slate-800`}>{row.caseCode}</td>
        <td
          className={`${densityClasses.cell} ${runTestTitleClassName(selectedInstanceId === row.id)}`}
          title={row.title}
        >
          {selectedInstanceId === row.id ? <span className="sr-only">Selected: </span> : null}
          {row.title}
        </td>
        {showPriority ? (
          <td className={`${densityClasses.cell} text-slate-700`}>{formatCaseMeta(row.casePriority)}</td>
        ) : null}
        {showType ? (
          <td className={`${densityClasses.cell} text-slate-700`}>{formatCaseMeta(row.caseType)}</td>
        ) : null}
        <td className={densityClasses.cell}>
          {row.caseChanged ? (
            <span
              className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
              title={
                row.changedFields?.length
                  ? `Underlying case changed: ${row.changedFields.join(", ")}`
                  : "Underlying case changed after this run was created"
              }
            >
              Changed
            </span>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          )}
        </td>
        <td className={densityClasses.cell} onClick={(e) => e.stopPropagation()}>
          <div className={showInlineAssigneeActions(density) ? "space-y-1" : undefined}>
            <p className="truncate text-slate-700" title={memberLabelForUserId(row.assignedTo, members)}>
              {memberLabelForUserId(row.assignedTo, members)}
            </p>
            {!runClosed && showInlineAssigneeActions(density) ? (
              <TestAssigneeQuickActions
                assignedTo={row.assignedTo}
                currentUserId={currentUserId}
                compact
                disabled={assigningTestId != null && assigningTestId !== row.id}
                pending={assigningTestId === row.id}
                onAssignToMe={() => onAssignTest(row.id, currentUserId ?? null)}
                onClearAssignee={() => onAssignTest(row.id, null)}
              />
            ) : null}
          </div>
        </td>
        <td className={densityClasses.cell} onClick={(e) => e.stopPropagation()}>
          <div className="space-y-0.5">
            {inlineStatusSelect && !runClosed && statusOptions.length > 0 ? (
              <select
                className={`w-full max-w-[9rem] rounded border border-slate-200 bg-white px-1.5 text-xs text-slate-800 ${
                  density === "compact" ? "h-7 py-0" : "py-1"
                }`}
                value={statusOption.id}
                disabled={isSavingQuickResult}
                aria-label={`Status for ${row.caseCode}. Failed, Blocked, and Retest open the result composer.`}
                title="Passed saves immediately. Failed, Blocked, and Retest open the result composer."
                onChange={(e) => {
                  const next = statusOptions.find((option) => option.id === e.target.value);
                  if (!next || next.isUntested) return;
                  if (isEvidenceRequiringStatus(next.canonicalStatus) && onComposeResult) {
                    onComposeResult(row, next.canonicalStatus);
                    return;
                  }
                  onQuickResultSave(row.id, { status: next.canonicalStatus });
                }}
              >
                {statusOptions.map((option) => (
                  <option key={option.id} value={option.id} disabled={option.isUntested}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : runClosed ? (
              <StatusBadge status={row.status} />
            ) : (
              <StatusBadge status={row.status} interactive onClick={() => onSelectInstance(row)} />
            )}
            {saveFeedback?.testId === row.id && saveFeedback.status !== "idle" ? (
              <SaveFeedback
                status={saveFeedback.status}
                message={saveFeedback.message}
                onRetry={saveFeedback.status === "failed" ? onRetrySave : undefined}
                onUndo={saveFeedback.status === "saved" && saveFeedback.canUndo ? onUndoSave : undefined}
              />
            ) : null}
          </div>
        </td>
        {onToggleSubscribe ? (
          <td className={densityClasses.cell} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              disabled={isSubscribePending}
              title={subscribedTestIds?.has(row.id) ? "Unsubscribe from email updates" : "Subscribe to email updates"}
              className={`text-xs font-medium underline disabled:opacity-50 ${
                subscribedTestIds?.has(row.id) ? "text-indigo-700" : "text-slate-600"
              }`}
              onClick={() => onToggleSubscribe(row.id, !subscribedTestIds?.has(row.id))}
            >
              {subscribedTestIds?.has(row.id) ? "Watching" : "Watch"}
            </button>
          </td>
        ) : null}
      </tr>
    );
  }

  const tableBody =
    groups && groups.length > 0 ? (
      groups.map((group) => (
        <tbody key={group.groupLabel + (group.sectionId ?? "")} className="divide-y divide-slate-100 bg-white">
          {group.groupLabel ? (
            <tr className="bg-slate-100/90">
              <td
                colSpan={columnCount}
                className={`${densityClasses.groupHeader} font-semibold uppercase tracking-wide text-slate-600`}
              >
                {group.groupLabel}
              </td>
            </tr>
          ) : null}
          {group.instances.map((row) => renderInstanceRow(row))}
        </tbody>
      ))
    ) : (
      <tbody className="divide-y divide-slate-100 bg-white">{displayRows.map((row) => renderInstanceRow(row))}</tbody>
    );

  return (
    <>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className={`w-full min-w-[640px] text-left ${densityClasses.table}`} data-run-density={density}>
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 font-medium uppercase tracking-wide text-slate-600 shadow-[0_1px_0_0_rgb(226_232_240)]">
            <tr>
              <th className={`w-10 ${densityClasses.header}`} scope="col">
                <span className="sr-only">Select row for bulk actions</span>
                <input
                  type="checkbox"
                  title="Select all on this page"
                  checked={allPageSelected}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedTestIds((prev) =>
                        Array.from(new Set([...prev, ...displayRows.map((instance) => instance.id)]))
                      );
                      return;
                    }
                    const filteredSet = new Set(displayRows.map((instance) => instance.id));
                    setSelectedTestIds((prev) => prev.filter((id) => !filteredSet.has(id)));
                  }}
                />
              </th>
              <th className={densityClasses.header} scope="col">
                Case
              </th>
              <th className={`min-w-[8rem] ${densityClasses.header}`} scope="col">
                Title
              </th>
              {showPriority ? (
                <th className={`w-24 ${densityClasses.header}`} scope="col">
                  {RUN_LIST_COLUMN_LABELS.priority}
                </th>
              ) : null}
              {showType ? (
                <th className={`w-24 ${densityClasses.header}`} scope="col">
                  {RUN_LIST_COLUMN_LABELS.type}
                </th>
              ) : null}
              <th className={`w-28 ${densityClasses.header}`} scope="col">
                Updated
              </th>
              <th className={`min-w-[9rem] ${densityClasses.header}`} scope="col">
                Assignee
              </th>
              <th className={`w-36 ${densityClasses.header}`} scope="col">
                Status
              </th>
            </tr>
          </thead>
          {tableBody}
        </table>
      </div>
      {hidePagination ? (
        <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
          <span className="font-medium text-slate-800">{total}</span> tests
        </div>
      ) : (
      <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p>
            Page <span className="font-medium text-slate-800">{page}</span> of {totalPages}
            <span className="mx-1 text-slate-300">·</span>
            <span className="font-medium text-slate-800">{total}</span> tests match filters
            {selectedTestIds.length > 0 ? (
              <>
                <span className="mx-1 text-slate-300">·</span>
                <span className="font-medium text-slate-800">{selectedTestIds.length}</span> selected
              </>
            ) : null}
          </p>
          {total > pagedInstances.length && !allFilteredSelected ? (
            <button
              type="button"
              className="font-medium text-sky-700 underline hover:text-sky-900 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={selectAllMatchingBusy}
              onClick={onSelectAllMatchingFilter}
            >
              {selectAllMatchingBusy ? "Selecting…" : `Select all ${total} matching filters`}
            </button>
          ) : null}
          {allFilteredSelected && total > pagedInstances.length ? (
            <p className="font-medium text-slate-700">All matching tests are selected.</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-2.5 py-1 font-medium hover:bg-slate-50 disabled:opacity-50"
            disabled={page <= 1}
            onClick={onPrevPage}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-2.5 py-1 font-medium hover:bg-slate-50 disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={onNextPage}
          >
            Next
          </button>
        </div>
      </div>
      )}
    </>
  );
}
