import type { TestCase } from "../types";

type ExpandableCaseDetailProps = {
  data: TestCase;
  mode: "view" | "edit";
  onEdit: () => void;
  onClose: () => void;
};

export function ExpandableCaseDetail({ data, mode, onEdit, onClose }: ExpandableCaseDetailProps) {
  return (
    <div className="border-t border-slate-100 bg-slate-50 px-4 py-4">
      <h4 className="text-sm font-semibold text-slate-900">
        {data.caseCode} {data.title}
      </h4>

      {mode === "edit" ? (
        <div className="mt-3 grid gap-3">
          <label className="grid gap-1 text-sm text-slate-700">
            Title
            <input
              defaultValue={data.title}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
            />
          </label>
          <label className="grid gap-1 text-sm text-slate-700">
            Preconditions
            <textarea
              defaultValue={data.preconditions}
              className="min-h-[84px] rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
            />
          </label>
          <div className="flex gap-2">
            <button type="button" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm">
              Save
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-medium">Type:</span> {data.type} · <span className="font-medium">Priority:</span>{" "}
            {data.priority} · <span className="font-medium">Estimate:</span> {data.estimate}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium">References:</span> {data.references || "—"} ·{" "}
            <span className="font-medium">Automation key:</span> {data.automationKey || "—"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium">Preconditions:</span> {data.preconditions}
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
            {data.steps.map((step, index) => (
              <li key={`${data.id}-${index}`}>
                {step.description} <span className="text-slate-500">(Expected: {step.expected})</span>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Edit
            </button>
            <button type="button" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600">
              Duplicate
            </button>
            <button
              type="button"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-800 hover:bg-red-100"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
