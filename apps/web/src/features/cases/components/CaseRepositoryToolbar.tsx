import { useState } from "react";

import type {
  CaseFilterAutomation,
  CaseFilterPriority,
  CaseFilterState,
  CaseFilterType,
  CaseColumnWidths,
  CaseListColumn,
  CasePresenceFilter,
  SavedCaseView
} from "../types";
import type { CaseGroupBy } from "../utils/caseRepositoryGrouping";
import type { UiDensity } from "../../../shared/ui/density/uiDensity";
import { buildCaseRepositoryViewMenu } from "../utils/caseRepositoryViewMenu";
import { CaseColumnsDialog } from "./CaseColumnsDialog";
import { OverflowMenu, WorkbenchToolbar } from "../../../shared/ui";

const toolbarButtonClass =
  "inline-flex min-h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50";

const toolbarButtonActiveClass =
  "inline-flex min-h-8 items-center justify-center rounded-md border border-slate-700 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-inner focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

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
  columnWidths: Record<CaseListColumn, number>;
  onColumnsChange: (value: CaseListColumn[]) => void;
  onColumnWidthsChange: (value: CaseColumnWidths) => void;
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
  density: UiDensity;
  onDensityChange: (value: UiDensity) => void;
  onExpandAllGroups?: () => void;
  onCollapseAllGroups?: () => void;
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
    columnWidths,
    onColumnsChange,
    onColumnWidthsChange,
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
    density,
    onDensityChange,
    onExpandAllGroups,
    onCollapseAllGroups
  } = props;

  const [columnsDialogOpen, setColumnsDialogOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(activeFilterCount > 0);
  const showDeleted = stateValue === "archived";
  const matchedSavedView = savedViews.find((view) => view.id === matchedSavedViewId);
  const viewGroups = buildCaseRepositoryViewMenu({
    groupByValue,
    density,
    showDeleted,
    visibleColumnCount: columnsValue.length,
    onGroupByChange,
    onDensityChange,
    onOpenColumnsAndViews: () => setColumnsDialogOpen(true),
    onToggleArchived: () => onStateChange(showDeleted ? "active" : "archived"),
    onExpandAllGroups,
    onCollapseAllGroups
  });

  return (
    <>
      <WorkbenchToolbar id="contentToolbar" className="border-b border-slate-300 bg-slate-50">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
          {selectedSectionLabel ? (
            <span className="max-w-36 truncate text-xs font-semibold text-slate-600" title={selectedSectionLabel}>
              {selectedSectionLabel}
            </span>
          ) : null}
          <label className="relative min-w-[220px] flex-1 sm:max-w-md">
            <span className="sr-only">Search cases</span>
            <input
              aria-label="Search cases"
              placeholder="Search cases…"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="min-h-8 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <button
            type="button"
            className={filtersOpen ? toolbarButtonActiveClass : toolbarButtonClass}
            aria-expanded={filtersOpen}
            aria-controls="caseRepositoryFilters"
            aria-label={activeFilterCount > 0 ? `Filter, ${activeFilterCount} active` : "Filter cases"}
            onClick={() => setFiltersOpen((value) => !value)}
          >
            Filter
            {activeFilterCount > 0 ? (
              <span className="ml-1.5 rounded-full bg-blue-700 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
          <OverflowMenu label={matchedSavedView ? `View: ${matchedSavedView.name}` : "View"} groups={viewGroups} align="left" />
        </div>

        {filtersOpen ? (
          <div id="caseRepositoryFilters" className="border-b border-slate-300 bg-white px-3 py-3">
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
                aria-label="Filter by priority"
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
                aria-label="Filter by case type"
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
                aria-label="Filter by automation"
                value={automationValue}
                onChange={(e) => onAutomationChange(e.target.value as CaseFilterAutomation)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              >
                <option value="">All automation</option>
                <option value="manual">Manual</option>
                <option value="automated">Automated</option>
              </select>
              <select
                aria-label="Filter by references"
                value={refsValue}
                onChange={(e) => onRefsChange(e.target.value as CasePresenceFilter)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              >
                <option value="">All refs</option>
                <option value="with">With refs</option>
                <option value="without">Without refs</option>
              </select>
              <select
                aria-label="Filter by labels"
                value={labelsValue}
                onChange={(e) => onLabelsChange(e.target.value as CasePresenceFilter)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              >
                <option value="">All labels</option>
                <option value="with">With labels</option>
                <option value="without">Without labels</option>
              </select>
              <select
                aria-label="Filter by estimate"
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
      </WorkbenchToolbar>

      <CaseColumnsDialog
        open={columnsDialogOpen}
        columns={columnsValue}
        columnWidths={columnWidths}
        onColumnsChange={onColumnsChange}
        onColumnWidthsChange={onColumnWidthsChange}
        onClose={() => setColumnsDialogOpen(false)}
        saveViewOpen={saveViewOpen}
        saveViewName={saveViewName}
        onSaveViewNameChange={onSaveViewNameChange}
        onToggleSaveView={onToggleSaveView}
        onSaveView={onSaveView}
        onCancelSaveView={onCancelSaveView}
        canDeleteSavedView={Boolean(matchedSavedViewId)}
        onDeleteSavedView={onDeleteSavedView}
        savedViews={savedViews}
        matchedSavedViewId={matchedSavedViewId}
        onSavedViewSelect={(viewId) => {
          onSavedViewSelect(viewId);
          setColumnsDialogOpen(false);
        }}
      />
    </>
  );
}
