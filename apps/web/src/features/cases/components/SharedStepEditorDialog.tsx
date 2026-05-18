import { useEffect, useState } from "react";

import type { SharedStepEntry, SharedStepSummary } from "../api/sharedStepsApi";

type SharedStepEditorDialogProps = {
  open: boolean;
  initial?: SharedStepSummary | null;
  busy?: boolean;
  error?: string | null;
  onSave: (input: { title: string; entries: SharedStepEntry[] }) => void;
  onCancel: () => void;
};

function emptyEntry(): SharedStepEntry {
  return { content: "", expectedResult: "" };
}

export function SharedStepEditorDialog({
  open,
  initial = null,
  busy = false,
  error = null,
  onSave,
  onCancel
}: SharedStepEditorDialogProps) {
  const [title, setTitle] = useState("");
  const [entries, setEntries] = useState<SharedStepEntry[]>([emptyEntry()]);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title ?? "");
    setEntries(initial?.entries.length ? initial.entries.map((row) => ({ ...row })) : [emptyEntry()]);
  }, [open, initial]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sharedStepEditorTitle"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border border-slate-300 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 id="sharedStepEditorTitle" className="text-sm font-semibold text-slate-900">
            {initial ? "Edit shared steps" : "Add shared steps"}
          </h2>
        </div>
        <div className="overflow-y-auto px-4 py-3">
          <label className="block text-xs font-medium text-slate-700">
            Title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="e.g. Login flow"
            />
          </label>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-700">Steps</p>
              <button
                type="button"
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50"
                onClick={() => setEntries((current) => [...current, emptyEntry()])}
              >
                Add step
              </button>
            </div>
            {entries.map((entry, index) => (
              <div key={`entry-${index}`} className="rounded border border-slate-200 p-2">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600">Step {index + 1}</span>
                  {entries.length > 1 ? (
                    <button
                      type="button"
                      className="text-xs text-red-700 hover:underline"
                      onClick={() => setEntries((current) => current.filter((_, i) => i !== index))}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <textarea
                  value={entry.content}
                  onChange={(event) =>
                    setEntries((current) =>
                      current.map((row, i) => (i === index ? { ...row, content: event.target.value } : row))
                    )
                  }
                  rows={2}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  placeholder="Step action"
                />
                <textarea
                  value={entry.expectedResult ?? ""}
                  onChange={(event) =>
                    setEntries((current) =>
                      current.map((row, i) => (i === index ? { ...row, expectedResult: event.target.value } : row))
                    )
                  }
                  rows={2}
                  className="mt-2 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  placeholder="Expected result (optional)"
                />
              </div>
            ))}
          </div>
          {error ? <p className="mt-3 text-xs text-red-700">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded border border-slate-400 bg-white px-3 py-1 text-xs disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !title.trim()}
            className="rounded border border-blue-900 bg-blue-700 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
            onClick={() =>
              onSave({
                title: title.trim(),
                entries: entries.filter((row) => row.content.trim().length > 0)
              })
            }
          >
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
