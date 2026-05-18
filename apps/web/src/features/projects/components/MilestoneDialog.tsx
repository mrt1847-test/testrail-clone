import { useEffect, useState } from "react";

import type { MilestoneRow } from "../api/planningApi";

export type MilestoneDialogMode = "edit" | "add-sub" | "start";

export type MilestoneDialogValues = {
  name?: string;
  parentMilestoneId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  startNow?: boolean;
};

type MilestoneDialogProps = {
  open: boolean;
  mode: MilestoneDialogMode;
  milestone: MilestoneRow;
  parentOptions: MilestoneRow[];
  saving?: boolean;
  onCancel: () => void;
  onSubmit: (values: MilestoneDialogValues) => void;
};

function dateInputValue(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function isoOrNull(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function MilestoneDialog({
  open,
  mode,
  milestone,
  parentOptions,
  saving = false,
  onCancel,
  onSubmit
}: MilestoneDialogProps) {
  const [name, setName] = useState("");
  const [parentMilestoneId, setParentMilestoneId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(mode === "add-sub" ? "" : milestone.name);
    setParentMilestoneId(mode === "add-sub" ? milestone.id : (milestone.parentMilestoneId ?? ""));
    setStartDate(mode === "start" ? new Date().toISOString().slice(0, 10) : dateInputValue(milestone.startDate));
    setDueDate(dateInputValue(milestone.dueDate));
  }, [milestone, mode, open]);

  if (!open) return null;

  const isAddSub = mode === "add-sub";
  const isStart = mode === "start";
  const title = isAddSub ? "Add Sub-milestone" : isStart ? "Start Milestone" : "Edit Milestone";
  const confirmLabel = isAddSub ? "Add milestone" : isStart ? "Start milestone" : "Save changes";
  const submitDisabled = saving || (!isStart && !name.trim());
  const validParentOptions = parentOptions.filter((option) => option.id !== milestone.id);

  const submit = () => {
    if (isAddSub) {
      onSubmit({
        name: name.trim(),
        parentMilestoneId: milestone.id,
        startDate: isoOrNull(startDate),
        dueDate: isoOrNull(dueDate)
      });
      return;
    }

    if (isStart) {
      onSubmit({
        startDate: isoOrNull(startDate),
        dueDate: isoOrNull(dueDate),
        startNow: !startDate
      });
      return;
    }

    onSubmit({
      name: name.trim(),
      parentMilestoneId: parentMilestoneId ? parentMilestoneId : null,
      startDate: isoOrNull(startDate),
      dueDate: isoOrNull(dueDate)
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="milestone-dialog-title"
        className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-lg"
      >
        <h2 id="milestone-dialog-title" className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <div className="mt-4 grid gap-3">
          {!isStart ? (
            <label className="grid gap-1 text-sm text-slate-700">
              <span>Name</span>
              <input
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
            </label>
          ) : (
            <p className="text-sm text-slate-600">
              Starting <span className="font-medium text-slate-900">{milestone.name}</span> moves it into active
              milestone planning.
            </p>
          )}

          {!isAddSub && !isStart ? (
            <label className="grid gap-1 text-sm text-slate-700">
              <span>Parent milestone</span>
              <select
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
                value={parentMilestoneId}
                onChange={(event) => setParentMilestoneId(event.target.value)}
              >
                <option value="">None (top level)</option>
                {validParentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm text-slate-700">
              <span>Start date</span>
              <input
                type="date"
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm text-slate-700">
              <span>Due date</span>
              <input
                type="date"
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitDisabled}
            onClick={submit}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
