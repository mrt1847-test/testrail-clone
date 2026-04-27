import { useState } from "react";

type ProjectCreateDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
  isSubmitting?: boolean;
};

export function ProjectCreateDialog({ open, onClose, onSubmit, isSubmitting }: ProjectCreateDialogProps) {
  const [name, setName] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-slate-900">New project</h2>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-400 focus:ring-2"
            placeholder="e.g. Mobile Release 2.1"
          />
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim() || isSubmitting}
            onClick={() => onSubmit(name.trim())}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {isSubmitting ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
