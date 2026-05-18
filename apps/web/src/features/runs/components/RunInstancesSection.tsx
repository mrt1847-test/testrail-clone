import type { Dispatch, SetStateAction } from "react";

import type { ProjectMemberRow } from "../../projects/api/settingsApi";
import type { RunInstanceGroupBy } from "../types";
import type { RunFilterCaseType, RunFilterPriority, RunSortBy, RunSortDir } from "../utils/runInstanceListParams";
import type { RunListColumn } from "../utils/runInstanceColumns";
import type { TestInstanceRow } from "../types";
import type { ResultStatus } from "./resultEntryTypes";
import { RunInstancesToolbar } from "./RunInstancesToolbar";
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
  allPageSelected: boolean;
  allFilteredSelected: boolean;
  onSelectAllMatchingFilter: () => void;
  selectAllMatchingBusy: boolean;
  onQuickResultSave: (
    testId: string,
    payload: { status: ResultStatus; comment?: string; elapsed?: string; version?: string; defects?: string[] }
  ) => void;
  isSavingQuickResult: boolean;
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
    allPageSelected,
    allFilteredSelected,
    onSelectAllMatchingFilter,
    selectAllMatchingBusy,
    onQuickResultSave,
    isSavingQuickResult,
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
    groupedTotal
  } = props;
  const listTotal = groupedTotal ?? total;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
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
        isSavingQuickResult={isSavingQuickResult}
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
      />
    </div>
  );
}
