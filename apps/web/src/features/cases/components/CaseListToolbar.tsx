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
    <div className="border-b border-slate-200 bg-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Search cases"
          placeholder="Search title, refs, automation key, labels, custom values"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="min-w-[220px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        />
        <select
          aria-label="Filter by priority"
          value={priorityValue}
          onChange={(e) => onPriorityChange(e.target.value as CaseFilterPriority)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-400"
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
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">All types</option>
          <option value="functional">Functional</option>
          <option value="integration">Integration</option>
          <option value="regression">Regression</option>
        </select>
        <select
          aria-label="Filter by case state"
          value={stateValue}
          onChange={(e) => onStateChange(e.target.value as CaseFilterState)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="active">Active cases</option>
          <option value="archived">Archived cases</option>
        </select>
        <select
          aria-label="Filter by automation coverage"
          value={automationValue}
          onChange={(e) => onAutomationChange(e.target.value as CaseFilterAutomation)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">All automation states</option>
          <option value="manual">Manual only</option>
          <option value="automated">Automated only</option>
        </select>
        <select
          aria-label="Filter by references"
          value={refsValue}
          onChange={(e) => onRefsChange(e.target.value as CasePresenceFilter)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">All refs</option>
          <option value="with">With refs</option>
          <option value="without">Without refs</option>
        </select>
        <select
          aria-label="Filter by labels"
          value={labelsValue}
          onChange={(e) => onLabelsChange(e.target.value as CasePresenceFilter)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">All labels</option>
          <option value="with">With labels</option>
          <option value="without">Without labels</option>
        </select>
        <select
          aria-label="Filter by estimate"
          value={estimateValue}
          onChange={(e) => onEstimateChange(e.target.value as CasePresenceFilter)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">All estimates</option>
          <option value="with">With estimate</option>
          <option value="without">Without estimate</option>
        </select>
        <button
          type="button"
          disabled={activeFilterCount === 0}
          onClick={onClearFilters}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </button>
        <button
          type="button"
          onClick={onToggleSaveView}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Save view
        </button>
        <button
          type="button"
          onClick={onAddCase}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Add case
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          aria-label="Saved case views"
          value={matchedSavedViewId}
          onChange={(e) => onSavedViewSelect(e.target.value)}
          className="min-w-[220px] rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-400"
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
          disabled={!matchedSavedViewId}
          onClick={onDeleteSavedView}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Delete view
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
        <span className="font-medium text-slate-600">Columns</span>
        {columnOptions.map((option) => (
          <label key={option.value} className="flex items-center gap-1">
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

      {saveViewOpen ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
          <input
            aria-label="Saved view name"
            placeholder="View name"
            value={saveViewName}
            onChange={(e) => onSaveViewNameChange(e.target.value)}
            className="min-w-[220px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          />
          <button
            type="button"
            disabled={!saveViewName.trim()}
            onClick={onSaveView}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save current
          </button>
          <button
            type="button"
            onClick={onCancelSaveView}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}
