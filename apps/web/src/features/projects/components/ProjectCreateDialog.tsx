import { useState } from "react";

import { PROJECT_TYPES, PROJECT_TYPE_LABELS, type ProjectType } from "../types/projectTypes";

type ProjectCreateDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: { name: string; projectType: ProjectType }) => void;
  isSubmitting?: boolean;
};

export function ProjectCreateDialog({ open, onClose, onSubmit, isSubmitting }: ProjectCreateDialogProps) {
  const [name, setName] = useState("");
  const [projectType, setProjectType] = useState<ProjectType>("single_repo");

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
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Project type
          <select
            value={projectType}
            onChange={(event) => setProjectType(event.target.value as ProjectType)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-400 focus:ring-2"
          >
            {PROJECT_TYPES.map((type) => (
              <option key={type} value={type}>
                {PROJECT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-xs text-slate-500">
          Single repository keeps one suite. Baselines add versioned suite branches. Multiple suites split cases by suite.
        </p>
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
            onClick={() => onSubmit({ name: name.trim(), projectType })}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {isSubmitting ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
