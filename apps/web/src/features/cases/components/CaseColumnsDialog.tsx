import type { CaseColumnWidths, CaseListColumn } from "../types";
import { defaultCaseColumnWidths } from "../hooks/useCaseColumnPreferences";

type CaseColumnsDialogProps = {
  open: boolean;
  columns: CaseListColumn[];
  columnWidths: Record<CaseListColumn, number>;
  onColumnsChange: (columns: CaseListColumn[]) => void;
  onColumnWidthsChange: (widths: CaseColumnWidths) => void;
  onClose: () => void;
  saveViewOpen: boolean;
  saveViewName: string;
  onSaveViewNameChange: (value: string) => void;
  onToggleSaveView: () => void;
  onSaveView: () => void;
  onCancelSaveView: () => void;
  canDeleteSavedView: boolean;
  onDeleteSavedView: () => void;
};

const columnOptions: Array<{ value: CaseListColumn; label: string }> = [
  { value: "type", label: "Type" },
  { value: "priority", label: "Priority" },
  { value: "automation", label: "Automation" },
  { value: "estimate", label: "Estimate" },
  { value: "refs", label: "Refs" },
  { value: "labels", label: "Labels" },
  { value: "customValues", label: "Custom values" }
];

export function CaseColumnsDialog(props: CaseColumnsDialogProps) {
  const {
    open,
    columns,
    columnWidths,
    onColumnsChange,
    onColumnWidthsChange,
    onClose,
    saveViewOpen,
    saveViewName,
    onSaveViewNameChange,
    onToggleSaveView,
    onSaveView,
    onCancelSaveView,
    canDeleteSavedView,
    onDeleteSavedView
  } = props;

  if (!open) return null;

  const toggleColumn = (column: CaseListColumn, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...columns, column]))
      : columns.filter((item) => item !== column);
    onColumnsChange(next.length > 0 ? next : ["type", "priority", "automation", "estimate"]);
  };

  const updateWidth = (column: CaseListColumn, rawValue: string) => {
    const parsed = Number(rawValue);
    const fallback = defaultCaseColumnWidths[column];
    const width = Number.isFinite(parsed) ? Math.max(72, Math.min(360, Math.round(parsed))) : fallback;
    onColumnWidthsChange({ ...columnWidths, [column]: width });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="selectColumnsDialogTitle"
        className="w-full max-w-lg rounded-md border border-slate-300 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 id="selectColumnsDialogTitle" className="text-sm font-semibold text-slate-900">
            Select columns
          </h2>
          <p className="mt-1 text-xs text-slate-600">Choose which columns appear in the case repository table and tune their width.</p>
        </div>
        <div className="px-4 py-3">
          <div className="grid gap-2">
            {columnOptions.map((option) => (
              <label
                key={option.value}
                className="grid gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 sm:grid-cols-[minmax(0,1fr)_7rem]"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={columns.includes(option.value)}
                    onChange={(event) => toggleColumn(option.value, event.target.checked)}
                    className="h-4 w-4"
                  />
                  {option.label}
                </span>
                <span className="flex items-center gap-1">
                  <input
                    type="number"
                    min={72}
                    max={360}
                    step={8}
                    value={columnWidths[option.value] ?? defaultCaseColumnWidths[option.value]}
                    disabled={!columns.includes(option.value)}
                    aria-label={`${option.label} column width`}
                    onChange={(event) => updateWidth(option.value, event.target.value)}
                    className="w-20 rounded border border-slate-300 bg-white px-2 py-1 text-xs disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  <span className="text-xs text-slate-500">px</span>
                </span>
              </label>
            ))}
          </div>
          <button type="button" className="mt-3 text-xs text-blue-700 hover:underline" onClick={onToggleSaveView}>
            {saveViewOpen ? "Close save view" : "Save as column view"}
          </button>
          {saveViewOpen ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                aria-label="Saved view name"
                placeholder="View name"
                value={saveViewName}
                onChange={(e) => onSaveViewNameChange(e.target.value)}
                className="min-w-[200px] flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
              />
              <button
                type="button"
                disabled={!saveViewName.trim()}
                onClick={onSaveView}
                className="rounded border border-slate-400 bg-white px-2.5 py-1 text-xs hover:bg-slate-50"
              >
                Save
              </button>
              <button type="button" onClick={onCancelSaveView} className="rounded border border-slate-400 bg-white px-2.5 py-1 text-xs">
                Cancel
              </button>
              {canDeleteSavedView ? (
                <button type="button" onClick={onDeleteSavedView} className="text-xs text-red-700 hover:underline">
                  Delete view
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-400 bg-gradient-to-b from-white to-slate-100 px-3 py-1 text-xs font-medium text-slate-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
