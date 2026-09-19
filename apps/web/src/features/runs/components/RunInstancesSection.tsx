import type { Dispatch, SetStateAction } from "react";

import type { UiDensity } from "../../../shared/ui/density/uiDensity";
import type { ProjectMemberRow } from "../../projects/api/settingsApi";
import type { RunInstanceGroupBy } from "../types";
import type { RunFilterCaseType, RunFilterPriority, RunSortBy, RunSortDir } from "../utils/runInstanceListParams";
import type { RunListColumn } from "../utils/runInstanceColumns";
import type { TestInstanceRow } from "../types";
import type { SaveFeedbackStatus } from "../../../shared/ui";
import type { ResultStatus } from "./resultEntryTypes";
import type { BulkResultFeedback } from "../hooks/useRunBulkActions";
import type { ProjectStatusOption } from "../utils/projectStatuses";
import { RunInstancesToolbar } from "./RunInstancesToolbar";
import { RunSelectionActionBar } from "./RunSelectionActionBar";
import { TestInstanceTable, type TestInstanceTableGroup } from "./TestInstanceTable";

type Props = {
  projectId: string;
  pagedInstances: TestInstanceRow[];
  selectedInstanceId: string | null;
  onSelectInstance: (instance: TestInstanceRow) => void;
  members: ProjectMemberRow[];
  searchText: string;
  onSearchTextChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  assigneeFilter: string;
  onAssigneeFilterChange: (value: string) => void;
  priorityFilter: RunFilterPriority;
  onPriorityFilterChange: (value: RunFilterPriority) => void;
  caseTypeFilter: RunFilterCaseType;
  onCaseTypeFilterChange: (value: RunFilterCaseType) => void;
  caseChangedFilter: boolean;
  onCaseChangedFilterChange: (value: boolean) => void;
  sortBy: RunSortBy;
  onSortByChange: (value: RunSortBy) => void;
  sortDir: RunSortDir;
  onSortDirChange: (value: RunSortDir) => void;
  groupBy: RunInstanceGroupBy;
  onGroupByChange: (value: RunInstanceGroupBy) => void;
  listColumns: RunListColumn[];
  onListColumnsChange: (columns: RunListColumn[]) => void;
  onClearFilters: () => void;
  selectedTestIds: string[];
  setSelectedTestIds: Dispatch<SetStateAction<string[]>>;
  statusOptions: ProjectStatusOption[];
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
  onAssignSelected: (assignedTo: string | null) => void;
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
  saveFeedbackByTestId?: Record<
    string,
    {
      testId: string;
      status: SaveFeedbackStatus;
      message: string;
      canUndo: boolean;
    }
  >;
  onRetrySave?: (testId: string) => void;
  onUndoSave?: (testId: string) => void;
  page: number;
  totalPages: number;
  total: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  subscribedTestIds?: Set<string>;
  onToggleSubscribe?: (testId: string, subscribed: boolean) => void;
  isSubscribePending?: boolean;
  hideStatusFilter?: boolean;
  currentUserId?: string | null;
  onAssignTest: (testId: string, assignedTo: string | null) => void;
  assigningTestId?: string | null;
  runClosed?: boolean;
  groups?: TestInstanceTableGroup[];
  inlineStatusSelect?: boolean;
  hidePagination?: boolean;
  groupedTotal?: number;
  density: UiDensity;
  onDensityChange: (value: UiDensity) => void;
};

export function RunInstancesSection(props: Props) {
  const {
    projectId,
    pagedInstances,
    selectedInstanceId,
    onSelectInstance,
    members,
    searchText,
    onSearchTextChange,
    statusFilter,
    onStatusFilterChange,
    assigneeFilter,
    onAssigneeFilterChange,
    priorityFilter,
    onPriorityFilterChange,
    caseTypeFilter,
    onCaseTypeFilterChange,
    caseChangedFilter,
    onCaseChangedFilterChange,
    sortBy,
    onSortByChange,
    sortDir,
    onSortDirChange,
    groupBy,
    onGroupByChange,
    listColumns,
    onListColumnsChange,
    onClearFilters,
    selectedTestIds,
    setSelectedTestIds,
    statusOptions,
    bulkStatus,
    onBulkStatusChange,
    bulkDisableUntested,
    bulkComment,
    onBulkCommentChange,
    canBulkSubmit,
    isBulkPending,
    bulkFeedback,
    onDismissBulkFeedback,
    onRetryFailedBulk,
    canRetryFailedBulk,
    onBulkSubmit,
    onAssignSelected,
    allPageSelected,
    allFilteredSelected,
    onSelectAllMatchingFilter,
    selectAllMatchingBusy,
    onQuickResultSave,
    onComposeResult,
    isSavingQuickResult,
    saveFeedback,
    saveFeedbackByTestId,
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
    hideStatusFilter,
    currentUserId,
    onAssignTest,
    assigningTestId,
    runClosed,
    groups,
    inlineStatusSelect,
    hidePagination,
    groupedTotal,
    density,
    onDensityChange
  } = props;
  const listTotal = groupedTotal ?? total;

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:h-full">
      <RunInstancesToolbar
        searchText={searchText}
        onSearchTextChange={onSearchTextChange}
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
        assigneeFilter={assigneeFilter}
        onAssigneeFilterChange={onAssigneeFilterChange}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={onPriorityFilterChange}
        caseTypeFilter={caseTypeFilter}
        onCaseTypeFilterChange={onCaseTypeFilterChange}
        caseChangedFilter={caseChangedFilter}
        onCaseChangedFilterChange={onCaseChangedFilterChange}
        sortBy={sortBy}
        onSortByChange={onSortByChange}
        sortDir={sortDir}
        onSortDirChange={onSortDirChange}
        groupBy={groupBy}
        onGroupByChange={onGroupByChange}
        columns={listColumns}
        onColumnsChange={onListColumnsChange}
        members={members}
        hideStatusFilter={hideStatusFilter}
        onClearFilters={onClearFilters}
        density={density}
        onDensityChange={onDensityChange}
      />
      <RunSelectionActionBar
        members={members}
        statusOptions={statusOptions}
        selectedCount={selectedTestIds.length}
        totalMatching={listTotal}
        allFilteredSelected={allFilteredSelected}
        bulkStatus={bulkStatus}
        onBulkStatusChange={onBulkStatusChange}
        bulkDisableUntested={bulkDisableUntested}
        bulkComment={bulkComment}
        onBulkCommentChange={onBulkCommentChange}
        canBulkSubmit={canBulkSubmit}
        isBulkPending={isBulkPending}
        bulkFeedback={bulkFeedback}
        onDismissBulkFeedback={onDismissBulkFeedback}
        onRetryFailedBulk={onRetryFailedBulk}
        canRetryFailedBulk={canRetryFailedBulk}
        onBulkSubmit={onBulkSubmit}
        onClearSelection={() => setSelectedTestIds([])}
        onSelectAllMatching={onSelectAllMatchingFilter}
        selectAllMatchingBusy={selectAllMatchingBusy}
        currentUserId={currentUserId}
        onAssignSelected={onAssignSelected}
        isAssignPending={assigningTestId === "__bulk__"}
        readOnly={runClosed}
      />
      <TestInstanceTable
        projectId={projectId}
        pagedInstances={pagedInstances}
        selectedInstanceId={selectedInstanceId}
        onSelectInstance={onSelectInstance}
        selectedTestIds={selectedTestIds}
        setSelectedTestIds={setSelectedTestIds}
        allPageSelected={allPageSelected}
        allFilteredSelected={allFilteredSelected}
        onSelectAllMatchingFilter={onSelectAllMatchingFilter}
        selectAllMatchingBusy={selectAllMatchingBusy}
        onQuickResultSave={onQuickResultSave}
        onComposeResult={onComposeResult}
        isSavingQuickResult={isSavingQuickResult}
        saveFeedback={saveFeedback}
        saveFeedbackByTestId={saveFeedbackByTestId}
        onRetrySave={onRetrySave}
        onUndoSave={onUndoSave}
        page={page}
        totalPages={totalPages}
        onPrevPage={onPrevPage}
        onNextPage={onNextPage}
        subscribedTestIds={subscribedTestIds}
        onToggleSubscribe={onToggleSubscribe}
        isSubscribePending={isSubscribePending}
        members={members}
        currentUserId={currentUserId}
        onAssignTest={onAssignTest}
        assigningTestId={assigningTestId}
        runClosed={runClosed}
        groups={groups}
        inlineStatusSelect={inlineStatusSelect}
        hidePagination={hidePagination}
        total={listTotal}
        visibleColumns={listColumns}
        density={density}
      />
    </div>
  );
}
