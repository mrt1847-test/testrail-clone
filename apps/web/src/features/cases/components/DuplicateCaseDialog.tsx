import { useEffect, useState } from "react";

export type DuplicateCaseOptionsInput = {
  includeSteps: boolean;
  includeFields: boolean;
  includeAttachments: boolean;
};

type Props = {
  open: boolean;
  caseTitle: string;
  isPending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (options: DuplicateCaseOptionsInput) => void;
};

export function DuplicateCaseDialog({ open, caseTitle, isPending, error, onCancel, onConfirm }: Props) {
  const [includeSteps, setIncludeSteps] = useState(true);
  const [includeFields, setIncludeFields] = useState(true);
  const [includeAttachments, setIncludeAttachments] = useState(true);

  useEffect(() => {
    if (!open) return;
    setIncludeSteps(true);
    setIncludeFields(true);
    setIncludeAttachments(true);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="duplicate-case-title"
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-lg"
      >
        <h2 id="duplicate-case-title" className="text-lg font-semibold text-slate-900">
          Duplicate test case
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Create a copy of <span className="font-medium text-slate-800">{caseTitle}</span> in the same section. Choose
          what to include.
        </p>
        <div className="mt-4 space-y-2 text-sm text-slate-800">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeSteps}
              disabled={isPending}
              onChange={(event) => setIncludeSteps(event.target.checked)}
            />
            Steps and BDD scenarios
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeFields}
              disabled={isPending}
              onChange={(event) => setIncludeFields(event.target.checked)}
            />
            Fields (preconditions, custom fields, refs, and related case fields)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeAttachments}
              disabled={isPending}
              onChange={(event) => setIncludeAttachments(event.target.checked)}
            />
            Attachments (case and step files)
          </label>
        </div>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={isPending}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            onClick={() => onConfirm({ includeSteps, includeFields, includeAttachments })}
          >
            {isPending ? "Duplicating…" : "Duplicate"}
          </button>
        </div>
      </div>
    </div>
  );
}
