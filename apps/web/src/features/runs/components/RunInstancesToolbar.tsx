import { useState } from "react";

import { CaseToolbarMenu } from "../../cases/components/CaseToolbarMenu";
import type { ProjectMemberRow } from "../../projects/api/settingsApi";
import type { RunInstanceGroupBy } from "../types";
import type { RunFilterCaseType, RunFilterPriority, RunSortBy, RunSortDir } from "../utils/runInstanceListParams";
import { countActiveRunListFilters } from "../utils/runInstanceListParams";
import type { RunListColumn } from "../utils/runInstanceColumns";
import { RUN_GROUP_BY_OPTIONS, RUN_SORT_OPTIONS } from "../utils/runExecutionTable";
import { RunColumnsDialog } from "./RunColumnsDialog";

const toolbarButtonClass =
  "rounded border border-slate-400 bg-gradient-to-b from-white to-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800 shadow-sm hover:from-slate-50 hover:to-slate-200";

const toolbarButtonActiveClass =
  "rounded border border-slate-600 bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-900 shadow-inner";

type Props = {
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
  columns: RunListColumn[];
  onColumnsChange: (columns: RunListColumn[]) => void;
  members: ProjectMemberRow[];
  hideStatusFilter?: boolean;
  onClearFilters: () => void;
};

export function RunInstancesToolbar(props: Props) {
  const {
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
    columns,
    onColumnsChange,
    members,
    hideStatusFilter,
    onClearFilters
  } = props;

  const [columnsDialogOpen, setColumnsDialogOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterCount = countActiveRunListFilters({
    status: statusFilter,
    assignee: assigneeFilter,
    search: searchText,
    priority: priorityFilter,
    caseType: caseTypeFilter,
    caseChanged: caseChangedFilter,
    sortBy,
    sortDir
  });

  const groupByLabel = RUN_GROUP_BY_OPTIONS.find((option) => option.id === groupBy)?.label ?? "Section";
  const sortLabel = RUN_SORT_OPTIONS.find((option) => option.id === sortBy)?.label ?? "Case ID";

  return (
    <>
      <div className="border-b border-slate-300 bg-[#ececec]">
        <div className="flex flex-wrap items-center gap-1 px-2 py-1.5">
          <button type="button" className={toolbarButtonClass} onClick={() => setColumnsDialogOpen(true)}>
            Columns
          </button>
          <button
            type="button"
            className={filtersOpen || activeFilterCount > 0 ? toolbarButtonActiveClass : toolbarButtonClass}
            onClick={() => setFiltersOpen((value) => !value)}
          >
            Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
          <CaseToolbarMenu
            label={`Group: ${groupByLabel}`}
            active={groupBy !== "section_id"}
            items={RUN_GROUP_BY_OPTIONS.map((option) => ({
              id: option.id,
              label: option.label,
              onSelect: () => onGroupByChange(option.id)
            }))}
          />
          <CaseToolbarMenu
            label={`Sort: ${sortLabel}${sortDir === "desc" ? " ↓" : ""}`}
            active={sortBy !== "case_id" || sortDir !== "asc"}
            items={[
              ...RUN_SORT_OPTIONS.map((option) => ({
                id: option.id,
                label: option.label,
                onSelect: () => onSortByChange(option.id)
              })),
              { id: "dir-asc", label: "Ascending", onSelect: () => onSortDirChange("asc") },
              { id: "dir-desc", label: "Descending", onSelect: () => onSortDirChange("desc") }
            ]}
          />
          {activeFilterCount > 0 ? (
            <button type="button" className={toolbarButtonClass} onClick={onClearFilters}>
              Clear filters
            </button>
          ) : null}
          <div className="flex-1" />
          <input
            aria-label="Search tests"
            placeholder="Search…"
            value={searchText}
            onChange={(e) => onSearchTextChange(e.target.value)}
            className="min-w-[160px] max-w-xs rounded border border-slate-400 bg-white px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>
        {filtersOpen ? (
          <div className="flex flex-wrap items-end gap-3 border-t border-slate-300 bg-white px-3 py-2">
            {!hideStatusFilter ? (
              <label className="flex flex-col gap-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                Status
                <select
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                  value={statusFilter}
                  onChange={(e) => onStatusFilterChange(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="untested">Untested</option>
                  <option value="passed">Passed</option>
                  <option value="failed">Failed</option>
                  <option value="blocked">Blocked</option>
                  <option value="retest">Retest</option>
                </select>
              </label>
            ) : null}
            <label className="flex flex-col gap-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Assignee
              <select
                className="min-w-[8rem] rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                value={assigneeFilter}
                onChange={(e) => onAssigneeFilterChange(e.target.value)}
              >
                <option value="all">Anyone</option>
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name || member.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Priority
              <select
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                value={priorityFilter}
                onChange={(e) => onPriorityFilterChange(e.target.value as RunFilterPriority)}
              >
                <option value="">Any</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="flex flex-col gap-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Type
              <select
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
                value={caseTypeFilter}
                onChange={(e) => onCaseTypeFilterChange(e.target.value as RunFilterCaseType)}
              >
                <option value="">Any</option>
                <option value="functional">Functional</option>
                <option value="integration">Integration</option>
                <option value="regression">Regression</option>
              </select>
            </label>
            <label className="flex items-center gap-2 pb-1 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={caseChangedFilter}
                onChange={(e) => onCaseChangedFilterChange(e.target.checked)}
                className="rounded border-slate-300"
              />
              Case changed since run
            </label>
          </div>
        ) : null}
      </div>
      <RunColumnsDialog
        open={columnsDialogOpen}
        columns={columns}
        onColumnsChange={onColumnsChange}
        onClose={() => setColumnsDialogOpen(false)}
      />
    </>
  );
}
