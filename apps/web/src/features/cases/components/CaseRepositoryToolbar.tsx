import { useState } from "react";

import { useProjectArchived } from "../../projects/context/ProjectArchiveContext";
import type {
  CaseFilterAutomation,
  CaseFilterPriority,
  CaseFilterState,
  CaseFilterType,
  CaseListColumn,
  CasePresenceFilter,
  SavedCaseView
} from "../types";
import { CASE_GROUP_BY_OPTIONS, type CaseGroupBy } from "../utils/caseRepositoryGrouping";
import { CaseColumnsDialog } from "./CaseColumnsDialog";
import { CaseToolbarMenu } from "./CaseToolbarMenu";

const toolbarButtonClass =
  "rounded border border-slate-400 bg-gradient-to-b from-white to-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800 shadow-sm hover:from-slate-50 hover:to-slate-200 disabled:cursor-not-allowed disabled:opacity-50";

const toolbarButtonActiveClass =
  "rounded border border-slate-600 bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-900 shadow-inner";

export type BulkEditScope = "selected" | "view" | "filter";

type CaseRepositoryToolbarProps = {
  selectedSectionLabel?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  priorityValue: CaseFilterPriority;
  onPriorityChange: (value: CaseFilterPriority) => void;
  caseTypeValue: CaseFilterType;
  onCaseTypeChange: (value: CaseFilterType) => void;
  automationValue: CaseFilterAutomation;
  onAutomationChange: (value: CaseFilterAutomation) => void;
  refsValue: CasePresenceFilter;
  onRefsChange: (value: CasePresenceFilter) => void;
  labelsValue: CasePresenceFilter;
  onLabelsChange: (value: CasePresenceFilter) => void;
  estimateValue: CasePresenceFilter;
  onEstimateChange: (value: CasePresenceFilter) => void;
  stateValue: CaseFilterState;
  onStateChange: (value: CaseFilterState) => void;
  groupByValue: CaseGroupBy;
  onGroupByChange: (value: CaseGroupBy) => void;
  columnsValue: CaseListColumn[];
  onColumnsChange: (value: CaseListColumn[]) => void;
  activeFilterCount: number;
  onClearFilters: () => void;
  savedViews: SavedCaseView[];
  matchedSavedViewId: string;
  onSavedViewSelect: (viewId: string) => void;
  saveViewOpen: boolean;
  saveViewName: string;
  onSaveViewNameChange: (value: string) => void;
  onToggleSaveView: () => void;
  onSaveView: () => void;
  onCancelSaveView: () => void;
  onDeleteSavedView: () => void;
  onAddCase?: () => void;
  onBulkEditScope?: (scope: BulkEditScope) => void;
  selectedCaseCount?: number;
  visibleCaseCount?: number;
  filterScopeBusy?: boolean;
};

export function CaseRepositoryToolbar(props: CaseRepositoryToolbarProps) {
  const {
    selectedSectionLabel,
    searchValue,
    onSearchChange,
    priorityValue,
    onPriorityChange,
    caseTypeValue,
    onCaseTypeChange,
    automationValue,
    onAutomationChange,
    refsValue,
    onRefsChange,
    labelsValue,
    onLabelsChange,
    estimateValue,
    onEstimateChange,
    stateValue,
    onStateChange,
    groupByValue,
    onGroupByChange,
    columnsValue,
    onColumnsChange,
    activeFilterCount,
    onClearFilters,
    savedViews,
    matchedSavedViewId,
    onSavedViewSelect,
    saveViewOpen,
    saveViewName,
    onSaveViewNameChange,
    onToggleSaveView,
    onSaveView,
    onCancelSaveView,
    onDeleteSavedView,
    onAddCase,
    onBulkEditScope,
    selectedCaseCount = 0,
    visibleCaseCount = 0,
    filterScopeBusy = false
  } = props;

  const isProjectArchived = useProjectArchived();
  const [columnsDialogOpen, setColumnsDialogOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(activeFilterCount > 0);
  const showDeleted = stateValue === "archived";

  const groupByLabel = CASE_GROUP_BY_OPTIONS.find((option) => option.id === groupByValue)?.label ?? "Section";

  return (
    <>
      <div id="contentToolbar" className="border-b border-slate-300 bg-[#ececec]">
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-300 px-2 py-1.5">
          {selectedSectionLabel ? (
            <span className="mr-2 truncate text-xs font-semibold text-slate-700">{selectedSectionLabel}</span>
          ) : null}
          <button type="button" className={toolbarButtonClass} onClick={() => setColumnsDialogOpen(true)}>
            Columns
          </button>
          <button
            type="button"
            className={filtersOpen ? toolbarButtonActiveClass : toolbarButtonClass}
            onClick={() => setFiltersOpen((value) => !value)}
          >
            Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
          <CaseToolbarMenu
            label={`Sort: ${groupByLabel}`}
            active={groupByValue !== "section_id"}
            items={CASE_GROUP_BY_OPTIONS.map((option) => ({
              id: option.id,
              label: option.label,
              description:
                option.id === "section_id"
                  ? "Group cases under section headers"
                  : option.id === "none"
                    ? "Flat list without group headers"
                    : `Group cases by ${option.label.toLowerCase()}`,
              onSelect: () => onGroupByChange(option.id)
            }))}
          />
          <div className="mx-1 h-5 w-px bg-slate-400" aria-hidden="true" />
          <button
            type="button"
            className={showDeleted ? toolbarButtonActiveClass : toolbarButtonClass}
            onClick={() => onStateChange(showDeleted ? "active" : "archived")}
            title="Show archived (deleted) test cases"
          >
            Display deleted
          </button>
          <CaseToolbarMenu
            label="Edit"
            disabled={!onBulkEditScope || isProjectArchived}
            items={[
              {
                id: "selected",
                label: "Edit selected",
                description:
                  selectedCaseCount > 0
                    ? `${selectedCaseCount} case${selectedCaseCount === 1 ? "" : "s"} selected`
                    : "Select cases with checkboxes first",
                disabled: selectedCaseCount === 0,
                onSelect: () => onBulkEditScope?.("selected")
              },
              {
                id: "view",
                label: "Edit cases in current view",
                description:
                  visibleCaseCount > 0
                    ? `${visibleCaseCount} case${visibleCaseCount === 1 ? "" : "s"} loaded in the list`
                    : "No cases in the current view",
                disabled: visibleCaseCount === 0,
                onSelect: () => onBulkEditScope?.("view")
              },
              {
                id: "filter",
                label: "Edit all cases matching filter",
                description: filterScopeBusy
                  ? "Loading cases…"
                  : "Includes cases not loaded in the current page",
                disabled: filterScopeBusy,
                onSelect: () => onBulkEditScope?.("filter")
              }
            ]}
          />
          <div className="flex-1" />
          <input
            aria-label="Search cases"
            placeholder="Search…"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="min-w-[160px] max-w-xs rounded border border-slate-400 bg-white px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-slate-500"
          />
          <select
            aria-label="Saved case views"
            value={matchedSavedViewId}
            onChange={(e) => onSavedViewSelect(e.target.value)}
            className="max-w-[160px] rounded border border-slate-400 bg-white px-2 py-1 text-xs text-slate-800"
          >
            <option value="">Custom view</option>
            {savedViews.map((view) => (
              <option key={view.id} value={view.id}>
                {view.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={isProjectArchived}
            onClick={onAddCase}
            className="rounded border border-blue-900 bg-blue-700 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add Case
          </button>
        </div>

        {filtersOpen ? (
          <div className="border-b border-slate-300 bg-[#fafafa] px-3 py-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Filter cases</span>
              <button
                type="button"
                disabled={activeFilterCount === 0}
                onClick={onClearFilters}
                className="text-xs text-blue-700 hover:underline disabled:opacity-50"
              >
                Clear
              </button>
            </div>
            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-4">
              <select
                value={priorityValue}
                onChange={(e) => onPriorityChange(e.target.value as CaseFilterPriority)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              >
                <option value="">All priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <select
                value={caseTypeValue}
                onChange={(e) => onCaseTypeChange(e.target.value as CaseFilterType)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              >
                <option value="">All types</option>
                <option value="functional">Functional</option>
                <option value="integration">Integration</option>
                <option value="regression">Regression</option>
              </select>
              <select
                value={automationValue}
                onChange={(e) => onAutomationChange(e.target.value as CaseFilterAutomation)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              >
                <option value="">All automation</option>
                <option value="manual">Manual</option>
                <option value="automated">Automated</option>
              </select>
              <select
                value={refsValue}
                onChange={(e) => onRefsChange(e.target.value as CasePresenceFilter)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              >
                <option value="">All refs</option>
                <option value="with">With refs</option>
                <option value="without">Without refs</option>
              </select>
              <select
                value={labelsValue}
                onChange={(e) => onLabelsChange(e.target.value as CasePresenceFilter)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              >
                <option value="">All labels</option>
                <option value="with">With labels</option>
                <option value="without">Without labels</option>
              </select>
              <select
                value={estimateValue}
                onChange={(e) => onEstimateChange(e.target.value as CasePresenceFilter)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              >
                <option value="">All estimates</option>
                <option value="with">With estimate</option>
                <option value="without">Without estimate</option>
              </select>
            </div>
          </div>
        ) : null}
      </div>

      <CaseColumnsDialog
        open={columnsDialogOpen}
        columns={columnsValue}
        onColumnsChange={onColumnsChange}
        onClose={() => setColumnsDialogOpen(false)}
        saveViewOpen={saveViewOpen}
        saveViewName={saveViewName}
        onSaveViewNameChange={onSaveViewNameChange}
        onToggleSaveView={onToggleSaveView}
        onSaveView={onSaveView}
        onCancelSaveView={onCancelSaveView}
        canDeleteSavedView={Boolean(matchedSavedViewId)}
        onDeleteSavedView={onDeleteSavedView}
      />
    </>
  );
}
