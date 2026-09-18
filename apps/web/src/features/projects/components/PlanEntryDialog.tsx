import { useEffect, useState } from "react";

import { Button, FormField, SaveFeedback, type SaveFeedbackStatus } from "../../../shared/ui";
import { Drawer } from "../../../shared/ui/Drawer";
import type { PlanEntryRow } from "../api/planningApi";
import { formatCaseIdList } from "../utils/planCaseSelection";

export type PlanEntryDialogValues = {
  name: string;
  environment: string;
  assignedTo: string;
  refs: string;
  startDate: string;
  dueOn: string;
  includeAll: boolean;
  includeCaseIds: string;
  excludeCaseIds: string;
  isIncluded: boolean;
};

type MemberOption = { userId: string; name?: string | null; email?: string | null };

type PlanEntryDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  entry?: PlanEntryRow | null;
  members: MemberOption[];
  saving?: boolean;
  saveStatus?: SaveFeedbackStatus;
  saveError?: string;
  onCancel: () => void;
  onSubmit: (values: PlanEntryDialogValues) => void;
};

const inputClass = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";

function emptyValues(): PlanEntryDialogValues {
  return {
    name: "",
    environment: "",
    assignedTo: "",
    refs: "",
    startDate: "",
    dueOn: "",
    includeAll: true,
    includeCaseIds: "",
    excludeCaseIds: "",
    isIncluded: true
  };
}

function valuesFromEntry(entry: PlanEntryRow): PlanEntryDialogValues {
  return {
    name: entry.name,
    environment: entry.environment ?? "",
    assignedTo: entry.assignedTo ?? "",
    refs: entry.refs ?? "",
    startDate: entry.startDate ? entry.startDate.slice(0, 10) : "",
    dueOn: entry.dueOn ? entry.dueOn.slice(0, 10) : "",
    includeAll: entry.includeAll,
    includeCaseIds: formatCaseIdList(entry.includeCaseIds),
    excludeCaseIds: formatCaseIdList(entry.excludeCaseIds),
    isIncluded: entry.isIncluded
  };
}

export function PlanEntryDialog({
  open,
  mode,
  entry,
  members,
  saving = false,
  saveStatus = "idle",
  saveError,
  onCancel,
  onSubmit
}: PlanEntryDialogProps) {
  const [values, setValues] = useState<PlanEntryDialogValues>(emptyValues);

  useEffect(() => {
    if (!open) return;
    setValues(mode === "edit" && entry ? valuesFromEntry(entry) : emptyValues());
  }, [entry, mode, open]);

  const patch = (next: Partial<PlanEntryDialogValues>) => setValues((current) => ({ ...current, ...next }));
  const title = mode === "create" ? "Add entry" : "Edit entry";
  const confirm = mode === "create" ? "Add entry" : "Save entry";

  return (
    <Drawer
      open={open}
      onClose={onCancel}
      title={title}
      subtitle={mode === "create" ? "Entries define the runs this plan will generate." : undefined}
      widthClassName="max-w-lg"
      footer={
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          <SaveFeedback
            className="mr-auto"
            status={saveStatus === "idle" && saving ? "saving" : saveStatus}
            message={saveStatus === "failed" ? saveError ?? "Could not save entry." : undefined}
          />
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving || !values.name.trim()}
            loading={saving}
            onClick={() => onSubmit(values)}
          >
            {confirm}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4">
        <FormField label="Name" required>
          {(control) => (
            <input
              {...control}
              className={inputClass}
              value={values.name}
              placeholder="Entry name"
              onChange={(event) => patch({ name: event.target.value })}
            />
          )}
        </FormField>
        <FormField label="Environment">
          {(control) => (
            <input
              {...control}
              className={inputClass}
              value={values.environment}
              placeholder="Optional"
              onChange={(event) => patch({ environment: event.target.value })}
            />
          )}
        </FormField>
        {mode === "edit" ? (
          <>
            <FormField label="Assignee">
              {(control) => (
                <select
                  {...control}
                  className={inputClass}
                  value={values.assignedTo}
                  onChange={(event) => patch({ assignedTo: event.target.value })}
                >
                  <option value="">Inherit plan</option>
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
                  value={values.refs}
                  placeholder="REQ-1, JIRA-42"
                  onChange={(event) => patch({ refs: event.target.value })}
                />
              )}
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Start date">
                {(control) => (
                  <input
                    {...control}
                    type="date"
                    className={inputClass}
                    value={values.startDate}
                    onChange={(event) => patch({ startDate: event.target.value })}
                  />
                )}
              </FormField>
              <FormField label="Due date">
                {(control) => (
                  <input
                    {...control}
                    type="date"
                    className={inputClass}
                    value={values.dueOn}
                    onChange={(event) => patch({ dueOn: event.target.value })}
                  />
                )}
              </FormField>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={values.isIncluded}
                onChange={(event) => patch({ isIncluded: event.target.checked })}
              />
              Include entry in run generation
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={values.includeAll}
                onChange={(event) => patch({ includeAll: event.target.checked })}
              />
              Include all suite cases
            </label>
            {!values.includeAll ? (
              <FormField label="Include case IDs">
                {(control) => (
                  <textarea
                    {...control}
                    className={inputClass}
                    rows={2}
                    placeholder="Comma-separated case IDs"
                    value={values.includeCaseIds}
                    onChange={(event) => patch({ includeCaseIds: event.target.value })}
                  />
                )}
              </FormField>
            ) : null}
            <FormField label="Exclude case IDs">
              {(control) => (
                <textarea
                  {...control}
                  className={inputClass}
                  rows={2}
                  placeholder="Comma-separated case IDs"
                  value={values.excludeCaseIds}
                  onChange={(event) => patch({ excludeCaseIds: event.target.value })}
                />
              )}
            </FormField>
          </>
        ) : null}
      </div>
    </Drawer>
  );
}
