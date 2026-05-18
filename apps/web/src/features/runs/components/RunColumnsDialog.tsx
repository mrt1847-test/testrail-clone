import type { RunListColumn } from "../utils/runInstanceColumns";
import { RUN_LIST_COLUMN_LABELS } from "../utils/runInstanceColumns";

const columnOptions: Array<{ value: RunListColumn; label: string }> = [
  { value: "priority", label: RUN_LIST_COLUMN_LABELS.priority },
  { value: "type", label: RUN_LIST_COLUMN_LABELS.type }
];

type Props = {
  open: boolean;
  columns: RunListColumn[];
  onColumnsChange: (columns: RunListColumn[]) => void;
  onClose: () => void;
};

export function RunColumnsDialog({ open, columns, onColumnsChange, onClose }: Props) {
  if (!open) return null;

  const toggleColumn = (column: RunListColumn, checked: boolean) => {
    const next = checked ? Array.from(new Set([...columns, column])) : columns.filter((item) => item !== column);
    onColumnsChange(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="runSelectColumnsTitle"
        className="w-full max-w-md rounded-md border border-slate-300 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 id="runSelectColumnsTitle" className="text-sm font-semibold text-slate-900">
            Select columns
          </h2>
          <p className="mt-1 text-xs text-slate-600">Optional columns for the test list in this run.</p>
        </div>
        <div className="grid gap-2 px-4 py-3">
          {columnOptions.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
            >
              <input
                type="checkbox"
                checked={columns.includes(option.value)}
                onChange={(event) => toggleColumn(option.value, event.target.checked)}
                className="h-4 w-4"
              />
              {option.label}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button type="button" className="rounded border border-slate-300 px-3 py-1.5 text-sm" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
