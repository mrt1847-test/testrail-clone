import { useState } from "react";

import type {
  CaseFilterAutomation,
  CaseListColumn,
  CasePresenceFilter,
  CaseFilterPriority,
  CaseFilterState,
  CaseFilterType,
  SavedCaseView
} from "../types";

type CaseListToolbarProps = {
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
};

export function CaseListToolbar({
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
  onAddCase
}: CaseListToolbarProps) {
  const [filtersOpen, setFiltersOpen] = useState(activeFilterCount > 0);
  const [displayOpen, setDisplayOpen] = useState(false);
  const columnOptions: Array<{ value: CaseListColumn; label: string }> = [
    { value: "type", label: "Type" },
    { value: "priority", label: "Priority" },
    { value: "automation", label: "Automation" },
    { value: "estimate", label: "Estimate" },
    { value: "refs", label: "Refs" },
    { value: "labels", label: "Labels" },
    { value: "customValues", label: "Custom values" }
  ];

  const toggleColumn = (column: CaseListColumn, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...columnsValue, column]))
      : columnsValue.filter((item) => item !== column);
    onColumnsChange(next.length > 0 ? next : ["type", "priority", "automation", "estimate"]);
  };

  return (
    <div className="border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Search cases"
          placeholder="Search cases"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="min-w-[220px] flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        />
        <select
          aria-label="Saved case views"
          value={matchedSavedViewId}
          onChange={(e) => onSavedViewSelect(e.target.value)}
          className="min-w-[200px] rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-400"
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
          onClick={() => setFiltersOpen((current) => !current)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </button>
        <button
          type="button"
          onClick={() => setDisplayOpen((current) => !current)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Display
        </button>
        <button
          type="button"
          onClick={onToggleSaveView}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          {saveViewOpen ? "Close view tools" : "Save view"}
        </button>
        <button
          type="button"
          onClick={onAddCase}
          className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Add case
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>{activeFilterCount > 0 ? `${activeFilterCount} filters applied` : "All repository filters are clear"}</span>
        <span>·</span>
        <span>{columnsValue.length} columns visible</span>
        {matchedSavedViewId ? (
          <>
            <span>·</span>
            <button
              type="button"
              onClick={onDeleteSavedView}
              className="font-medium text-slate-600 underline"
            >
              Delete selected view
            </button>
          </>
        ) : null}
      </div>

      {filtersOpen ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Filters</p>
              <p className="text-sm text-slate-600">Keep the main toolbar focused and open deeper controls only when needed.</p>
            </div>
            <button
              type="button"
              disabled={activeFilterCount === 0}
              onClick={onClearFilters}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <select
              aria-label="Filter by case state"
              value={stateValue}
              onChange={(e) => onStateChange(e.target.value as CaseFilterState)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="active">Active cases</option>
              <option value="archived">Archived cases</option>
            </select>
            <select
              aria-label="Filter by priority"
              value={priorityValue}
              onChange={(e) => onPriorityChange(e.target.value as CaseFilterPriority)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-400"
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
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="">All types</option>
              <option value="functional">Functional</option>
              <option value="integration">Integration</option>
              <option value="regression">Regression</option>
            </select>
            <select
              aria-label="Filter by automation coverage"
              value={automationValue}
              onChange={(e) => onAutomationChange(e.target.value as CaseFilterAutomation)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="">All automation states</option>
              <option value="manual">Manual only</option>
              <option value="automated">Automated only</option>
            </select>
            <select
              aria-label="Filter by references"
              value={refsValue}
              onChange={(e) => onRefsChange(e.target.value as CasePresenceFilter)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="">All refs</option>
              <option value="with">With refs</option>
              <option value="without">Without refs</option>
            </select>
            <select
              aria-label="Filter by labels"
              value={labelsValue}
              onChange={(e) => onLabelsChange(e.target.value as CasePresenceFilter)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="">All labels</option>
              <option value="with">With labels</option>
              <option value="without">Without labels</option>
            </select>
            <select
              aria-label="Filter by estimate"
              value={estimateValue}
              onChange={(e) => onEstimateChange(e.target.value as CasePresenceFilter)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-400"
            >
              <option value="">All estimates</option>
              <option value="with">With estimate</option>
              <option value="without">Without estimate</option>
            </select>
          </div>
        </div>
      ) : null}

      {displayOpen ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Display</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-700">
            {columnOptions.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5"
              >
                <input
                  type="checkbox"
                  checked={columnsValue.includes(option.value)}
                  onChange={(event) => toggleColumn(option.value, event.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {saveViewOpen ? (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Saved View</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              aria-label="Saved view name"
              placeholder="View name"
              value={saveViewName}
              onChange={(e) => onSaveViewNameChange(e.target.value)}
              className="min-w-[220px] flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
            />
            <button
              type="button"
              disabled={!saveViewName.trim()}
              onClick={onSaveView}
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save current
            </button>
            <button
              type="button"
              onClick={onCancelSaveView}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
