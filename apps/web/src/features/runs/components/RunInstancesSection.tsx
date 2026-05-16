import type { Dispatch, SetStateAction } from "react";
import type { ProjectMemberRow } from "../../projects/api/settingsApi";
import type { TestInstanceRow } from "../types";
import type { ResultStatus } from "./resultEntryTypes";
import { TestInstanceFilterBar } from "./TestInstanceFilterBar";
import { TestInstanceTable } from "./TestInstanceTable";

type Props = {
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
  selectedTestIds: string[];
  setSelectedTestIds: Dispatch<SetStateAction<string[]>>;
  allFilteredSelected: boolean;
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
};

export function RunInstancesSection(props: Props) {
  const {
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
    selectedTestIds,
    setSelectedTestIds,
    allFilteredSelected,
    onQuickResultSave,
    isSavingQuickResult,
    page,
    totalPages,
    total,
    onPrevPage,
    onNextPage,
    subscribedTestIds,
    onToggleSubscribe,
    isSubscribePending
  } = props;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <TestInstanceFilterBar
        searchText={searchText}
        onSearchTextChange={onSearchTextChange}
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
        assigneeFilter={assigneeFilter}
        onAssigneeFilterChange={onAssigneeFilterChange}
        members={members}
        hideStatusFilter={hideStatusFilter}
      />
      <TestInstanceTable
        pagedInstances={pagedInstances}
        selectedInstanceId={selectedInstanceId}
        onSelectInstance={onSelectInstance}
        selectedTestIds={selectedTestIds}
        setSelectedTestIds={setSelectedTestIds}
        allFilteredSelected={allFilteredSelected}
        onQuickResultSave={onQuickResultSave}
        isSavingQuickResult={isSavingQuickResult}
        page={page}
        totalPages={totalPages}
        total={total}
        onPrevPage={onPrevPage}
        onNextPage={onNextPage}
        subscribedTestIds={subscribedTestIds}
        onToggleSubscribe={onToggleSubscribe}
        isSubscribePending={isSubscribePending}
      />
    </div>
  );
}
