import { useEffect, useState } from "react";

import { Button, FormField, SaveFeedback, type SaveFeedbackStatus } from "../../../shared/ui";
import { Drawer } from "../../../shared/ui/Drawer";
import type { PlanRow } from "../api/planningApi";

export type PlanDefaultsValues = {
  assignedTo: string;
  refs: string;
  startDate: string;
  dueOn: string;
};

type MemberOption = { userId: string; name?: string | null; email?: string | null };

type PlanDefaultsDialogProps = {
  open: boolean;
  plan?: PlanRow | null;
  members: MemberOption[];
  saving?: boolean;
  saveStatus?: SaveFeedbackStatus;
  saveError?: string;
  onCancel: () => void;
  onSubmit: (values: PlanDefaultsValues) => void;
};

const inputClass = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";

export function PlanDefaultsDialog({
  open,
  plan,
  members,
  saving = false,
  saveStatus = "idle",
  saveError,
  onCancel,
  onSubmit
}: PlanDefaultsDialogProps) {
  const [assignedTo, setAssignedTo] = useState("");
  const [refs, setRefs] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueOn, setDueOn] = useState("");

  useEffect(() => {
    if (!open || !plan) return;
    setAssignedTo(plan.assignedTo ?? "");
    setRefs(plan.refs ?? "");
    setStartDate(plan.startDate ? plan.startDate.slice(0, 10) : "");
    setDueOn(plan.dueOn ? plan.dueOn.slice(0, 10) : "");
  }, [open, plan]);

  return (
    <Drawer
      open={open}
      onClose={onCancel}
      title="Plan defaults"
      subtitle="Inherited by new entries unless an entry overrides them."
      widthClassName="max-w-md"
      footer={
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          <SaveFeedback
            className="mr-auto"
            status={saveStatus === "idle" && saving ? "saving" : saveStatus}
            message={saveStatus === "failed" ? saveError ?? "Could not save plan defaults." : undefined}
          />
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" loading={saving} onClick={() => onSubmit({ assignedTo, refs, startDate, dueOn })}>
            Save defaults
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        <FormField label="Assignee">
          {(control) => (
            <select
              {...control}
              className={inputClass}
              value={assignedTo}
              onChange={(event) => setAssignedTo(event.target.value)}
            >
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name || member.email}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <FormField label="References">
          {(control) => (
            <input
              {...control}
              className={inputClass}
              placeholder="REQ-1, JIRA-42"
              value={refs}
              onChange={(event) => setRefs(event.target.value)}
            />
          )}
        </FormField>
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
              value={dueOn}
              onChange={(event) => setDueOn(event.target.value)}
            />
          )}
        </FormField>
      </div>
    </Drawer>
  );
}
