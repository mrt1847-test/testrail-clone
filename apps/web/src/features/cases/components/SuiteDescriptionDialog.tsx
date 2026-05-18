import { useEffect, useState } from "react";

type SuiteDescriptionDialogProps = {
  open: boolean;
  suiteName: string;
  description: string;
  isSaving?: boolean;
  error?: string | null;
  onSave: (description: string) => void;
  onClose: () => void;
};

export function SuiteDescriptionDialog(props: SuiteDescriptionDialogProps) {
  const { open, suiteName, description, isSaving = false, error, onSave, onClose } = props;
  const [draft, setDraft] = useState(description);

  useEffect(() => {
    if (open) setDraft(description);
  }, [description, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="editSuiteDescriptionTitle"
        className="w-full max-w-lg rounded-md border border-slate-300 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 id="editSuiteDescriptionTitle" className="text-sm font-semibold text-slate-900">
            Edit suite description
          </h2>
          <p className="mt-1 text-xs text-slate-600">{suiteName}</p>
        </div>
        <div className="px-4 py-3">
          <label className="block text-xs font-medium text-slate-700">
            Description
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={6}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-slate-500"
              placeholder="Describe this test suite…"
            />
          </label>
          {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-400 bg-white px-3 py-1 text-xs text-slate-800 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => onSave(draft)}
            className="rounded border border-blue-900 bg-blue-700 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
