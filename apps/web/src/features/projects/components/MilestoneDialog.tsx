import { useEffect, useState } from "react";

import { Button, FormField, SaveFeedback, type SaveFeedbackStatus } from "../../../shared/ui";
import { Drawer } from "../../../shared/ui/Drawer";
import type { MilestoneRow } from "../api/planningApi";

export type MilestoneDialogMode = "create" | "edit" | "add-sub" | "start";

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
  milestone?: MilestoneRow | null;
  parentOptions: MilestoneRow[];
  saving?: boolean;
  saveStatus?: SaveFeedbackStatus;
  saveError?: string;
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

function dialogCopy(mode: MilestoneDialogMode) {
  if (mode === "create") {
    return { title: "Add Milestone", confirm: "Add milestone" };
  }
  if (mode === "add-sub") {
    return { title: "Add sub-milestone", confirm: "Add sub-milestone" };
  }
  if (mode === "start") {
    return { title: "Start Milestone", confirm: "Start milestone" };
  }
  return { title: "Edit Milestone", confirm: "Save changes" };
}

export function MilestoneDialog({
  open,
  mode,
  milestone,
  parentOptions,
  saving = false,
  saveStatus = "idle",
  saveError,
  onCancel,
  onSubmit
}: MilestoneDialogProps) {
  const [name, setName] = useState("");
  const [parentMilestoneId, setParentMilestoneId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      setName("");
      setParentMilestoneId("");
      setStartDate("");
      setDueDate("");
      return;
    }
    setName(mode === "add-sub" ? "" : milestone?.name ?? "");
    setParentMilestoneId(mode === "add-sub" ? milestone?.id ?? "" : (milestone?.parentMilestoneId ?? ""));
    setStartDate(mode === "start" ? new Date().toISOString().slice(0, 10) : dateInputValue(milestone?.startDate));
    setDueDate(dateInputValue(milestone?.dueDate));
  }, [milestone, mode, open]);

  const isCreate = mode === "create";
  const isAddSub = mode === "add-sub";
  const isStart = mode === "start";
  const copy = dialogCopy(mode);
  const submitDisabled = saving || (!isStart && !name.trim());
  const validParentOptions = parentOptions.filter((option) => option.id !== milestone?.id);
  const inputClass = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";

  const submit = () => {
    if (isCreate) {
      onSubmit({
        name: name.trim(),
        parentMilestoneId: parentMilestoneId ? parentMilestoneId : null,
        startDate: isoOrNull(startDate),
        dueDate: isoOrNull(dueDate)
      });
      return;
    }

    if (isAddSub) {
      onSubmit({
        name: name.trim(),
        parentMilestoneId: milestone?.id,
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
    <Drawer
      open={open}
      onClose={onCancel}
      title={copy.title}
      widthClassName="max-w-md"
      footer={
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          <SaveFeedback
            className="mr-auto"
            status={saveStatus === "idle" && saving ? "saving" : saveStatus}
            message={saveStatus === "failed" ? saveError ?? "Could not save milestone." : undefined}
          />
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={submitDisabled} loading={saving} onClick={submit}>
            {copy.confirm}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        {!isStart ? (
          <FormField label="Name" required>
            {(control) => (
              <input
                {...control}
                className={inputClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={isAddSub ? "Sub-milestone name" : "e.g. Sprint 12 / Release 2.1"}
              />
            )}
          </FormField>
        ) : (
          <p className="text-sm text-slate-600">
            Starting <span className="font-medium text-slate-900">{milestone?.name}</span> moves it into active
            milestone planning.
          </p>
        )}

        {!isAddSub && !isStart ? (
          <FormField label="Parent milestone">
            {(control) => (
              <select
                {...control}
                className={inputClass}
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
            )}
          </FormField>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Start date">
            {(control) => (
              <input
                {...control}
                type="date"
                className={inputClass}
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            )}
          </FormField>
          <FormField label="Due date">
            {(control) => (
              <input
                {...control}
                type="date"
                className={inputClass}
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            )}
          </FormField>
        </div>
      </div>
    </Drawer>
  );
}
