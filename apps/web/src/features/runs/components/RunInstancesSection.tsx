import type { Dispatch, SetStateAction } from "react";
import type { ProjectMemberRow } from "../../projects/api/settingsApi";
import type { TestInstanceRow } from "../types";
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
  instanceAssignees: Record<string, string>;
  onInstanceAssigneeChange: (testId: string, value: string) => void;
  onSaveInstanceAssignee: (testId: string) => void;
  isSavingInstanceAssignee: boolean;
  page: number;
  totalPages: number;
  total: number;
  onPrevPage: () => void;
  onNextPage: () => void;
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
    instanceAssignees,
    onInstanceAssigneeChange,
    onSaveInstanceAssignee,
    isSavingInstanceAssignee,
    page,
    totalPages,
    total,
    onPrevPage,
    onNextPage
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
      />
      <TestInstanceTable
        pagedInstances={pagedInstances}
        selectedInstanceId={selectedInstanceId}
        onSelectInstance={onSelectInstance}
        members={members}
        selectedTestIds={selectedTestIds}
        setSelectedTestIds={setSelectedTestIds}
        allFilteredSelected={allFilteredSelected}
        instanceAssignees={instanceAssignees}
        onInstanceAssigneeChange={onInstanceAssigneeChange}
        onSaveInstanceAssignee={onSaveInstanceAssignee}
        isSavingInstanceAssignee={isSavingInstanceAssignee}
        page={page}
        totalPages={totalPages}
        total={total}
        onPrevPage={onPrevPage}
        onNextPage={onNextPage}
      />
    </div>
  );
}
