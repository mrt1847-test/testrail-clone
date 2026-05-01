import { useEffect, useState } from "react";

import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import type { CaseStep, CaseVersion, TestCase } from "../types";

type CaseCustomFieldDefinition = {
  systemName: string;
  name: string;
  fieldType: "text" | "number" | "select";
  options: string[];
  isRequired: boolean;
  isActive: boolean;
};

type ExpandableCaseDetailProps = {
  data: TestCase;
  versions: CaseVersion[];
  customFields?: CaseCustomFieldDefinition[];
  mode: "view" | "edit";
  onEdit: () => void;
  onClose: () => void;
  onSave: (patch: {
    title: string;
    preconditions: string;
    customValues: Record<string, string | number | boolean | null>;
  }) => Promise<void>;
  onDelete: () => Promise<void>;
  onRestoreVersion?: (versionId: number) => Promise<void>;
  isSaving?: boolean;
  isDeleting?: boolean;
  isRestoring?: boolean;
  onCreateStep?: (input: { content: string; expected: string }) => Promise<void>;
  onUpdateStep?: (
    stepId: number,
    patch: { content?: string; expectedResult?: string | null; stepOrder?: number }
  ) => Promise<void>;
  onDeleteStep?: (stepId: number) => Promise<void>;
  isStepsBusy?: boolean;
};

type LocalStep = { id?: number; description: string; expected: string };

function toLocalSteps(steps: CaseStep[]): LocalStep[] {
  return steps.map((s) => ({
    id: s.id,
    description: s.description,
    expected: s.expected === "-" ? "" : s.expected
  }));
}

export function ExpandableCaseDetail({
  data,
  versions,
  customFields = [],
  mode,
  onEdit,
  onClose,
  onSave,
  onDelete,
  onRestoreVersion,
  isSaving = false,
  isDeleting = false,
  isRestoring = false,
  onCreateStep,
  onUpdateStep,
  onDeleteStep,
  isStepsBusy = false
}: ExpandableCaseDetailProps) {
  const [title, setTitle] = useState(data.title);
  const [preconditions, setPreconditions] = useState(data.preconditions);
  const [customValues, setCustomValues] = useState<Record<string, string | number | boolean | null>>(
    () => data.customValues ?? {}
  );
  const [localSteps, setLocalSteps] = useState<LocalStep[]>(() => toLocalSteps(data.steps));
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [stepDeleteId, setStepDeleteId] = useState<number | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [restoreVersionId, setRestoreVersionId] = useState<number | null>(null);
  const selectedVersion = versions.find((version) => version.id === selectedVersionId) ?? null;

  useEffect(() => {
    setTitle(data.title);
    setPreconditions(data.preconditions);
    setCustomValues(data.customValues ?? {});
  }, [data.id, data.title, data.preconditions, data.customValues]);

  useEffect(() => {
    if (mode === "edit") {
      setLocalSteps(toLocalSteps(data.steps));
    }
  }, [mode, data.id, data.steps]);

  function moveStep(stepId: number, direction: "up" | "down") {
    const idx = localSteps.findIndex((s) => s.id === stepId);
    if (idx < 0) return;
    const swap = direction === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= localSteps.length) return;
    if (localSteps[swap]?.id == null) return;
    void onUpdateStep?.(stepId, { stepOrder: swap + 1 });
  }

  function persistStepIfChanged(step: LocalStep, index: number) {
    if (step.id == null || !onUpdateStep) return;
    const original = data.steps.find((s) => s.id === step.id);
    if (!original) return;

    const content = step.description.trim();
    const expected = step.expected.trim();
    const originalExpected = original.expected === "-" ? "" : original.expected;
    if (original.description !== content || originalExpected !== expected) {
      void onUpdateStep(step.id, {
        content,
        expectedResult: expected.length ? expected : null,
        stepOrder: index + 1
      });
    }
  }

  function setCustomValue(systemName: string, value: string | number | boolean | null) {
    setCustomValues((prev) => ({ ...prev, [systemName]: value }));
  }

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
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
            />
          </label>

          <label className="grid gap-1 text-sm text-slate-700">
            Preconditions
            <textarea
              value={preconditions}
              onChange={(e) => setPreconditions(e.target.value)}
              className="min-h-[84px] rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
            />
          </label>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-800">Steps</span>
              <button
                type="button"
                disabled={isStepsBusy || !onCreateStep}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                onClick={() => void onCreateStep?.({ content: "New step", expected: "" })}
              >
                {isStepsBusy ? "Saving..." : "Add step"}
              </button>
            </div>

            {localSteps.length === 0 ? (
              <p className="text-xs text-slate-500">No steps yet.</p>
            ) : (
              <ol className="list-decimal space-y-3 pl-5 text-sm">
                {localSteps.map((step, index) => (
                  <li key={step.id ?? `local-${index}`} className="grid gap-2 rounded-md border border-slate-200 bg-white p-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        disabled={isStepsBusy || step.id == null || index === 0}
                        className="rounded border border-slate-200 px-1.5 py-0.5 text-xs disabled:opacity-40"
                        onClick={() => step.id != null && moveStep(step.id, "up")}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        disabled={isStepsBusy || step.id == null || index === localSteps.length - 1}
                        className="rounded border border-slate-200 px-1.5 py-0.5 text-xs disabled:opacity-40"
                        onClick={() => step.id != null && moveStep(step.id, "down")}
                      >
                        Down
                      </button>
                      {step.id != null ? (
                        <button
                          type="button"
                          disabled={isStepsBusy}
                          className="ml-auto rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-xs text-red-800"
                          onClick={() => setStepDeleteId(step.id!)}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>

                    <label className="grid gap-0.5 text-xs text-slate-600">
                      Action
                      <textarea
                        value={step.description}
                        disabled={isStepsBusy}
                        onChange={(e) => {
                          const value = e.target.value;
                          setLocalSteps((prev) =>
                            prev.map((s, i) => (i === index ? { ...s, description: value } : s))
                          );
                        }}
                        onBlur={() => persistStepIfChanged(step, index)}
                        className="min-h-[56px] rounded border border-slate-200 px-2 py-1 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-slate-400"
                      />
                    </label>

                    <label className="grid gap-0.5 text-xs text-slate-600">
                      Expected
                      <textarea
                        value={step.expected}
                        disabled={isStepsBusy}
                        onChange={(e) => {
                          const value = e.target.value;
                          setLocalSteps((prev) => prev.map((s, i) => (i === index ? { ...s, expected: value } : s)));
                        }}
                        onBlur={() => persistStepIfChanged(step, index)}
                        className="min-h-[44px] rounded border border-slate-200 px-2 py-1 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-slate-400"
                      />
                    </label>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {customFields.filter((field) => field.isActive).length > 0 ? (
            <div className="grid gap-2 rounded-md border border-slate-200 bg-white p-3">
              <p className="text-sm font-medium text-slate-800">Custom fields</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {customFields
                  .filter((field) => field.isActive)
                  .map((field) => {
                    const value = customValues[field.systemName];
                    if (field.fieldType === "select") {
                      return (
                        <label key={field.systemName} className="grid gap-1 text-xs text-slate-600">
                          {field.name}
                          <select
                            className="rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-slate-400"
                            value={typeof value === "string" ? value : ""}
                            onChange={(e) => setCustomValue(field.systemName, e.target.value || null)}
                          >
                            <option value="">-</option>
                            {field.options.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    }
                    return (
                      <label key={field.systemName} className="grid gap-1 text-xs text-slate-600">
                        {field.name}
                        <input
                          type={field.fieldType === "number" ? "number" : "text"}
                          className="rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-slate-400"
                          value={value == null ? "" : String(value)}
                          onChange={(e) =>
                            setCustomValue(
                              field.systemName,
                              field.fieldType === "number" && e.target.value !== "" ? Number(e.target.value) : e.target.value || null
                            )
                          }
                        />
                      </label>
                    );
                  })}
              </div>
            </div>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={isSaving || !title.trim()}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
              onClick={() =>
                void onSave({
                  title: title.trim(),
                  preconditions: preconditions.trim(),
                  customValues
                })
              }
            >
              {isSaving ? "Saving..." : "Save"}
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
            <span className="font-medium">Type:</span> {data.type} / <span className="font-medium">Priority:</span>{" "}
            {data.priority} / <span className="font-medium">Estimate:</span> {data.estimate}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium">References:</span> {data.references || "-"} /{" "}
            <span className="font-medium">Automation key:</span> {data.automationKey || "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium">Preconditions:</span> {data.preconditions || "-"}
          </p>

          <div className="mt-2 rounded border border-slate-200 bg-white p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-700">Version history</p>
              {selectedVersion ? (
                <button
                  type="button"
                  className="text-xs font-medium text-slate-600 underline"
                  onClick={() => setSelectedVersionId(null)}
                >
                  Clear
                </button>
              ) : null}
            </div>
            {versions.length === 0 ? (
              <p className="mt-1 text-xs text-slate-500">No versions yet.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-xs text-slate-600">
                {versions.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={
                        selectedVersionId === v.id
                          ? "font-medium text-slate-900 underline"
                          : "font-medium text-slate-700 underline"
                      }
                      onClick={() => setSelectedVersionId(v.id)}
                    >
                      v{v.versionNo}
                    </button>
                    <span>{v.changeReason ?? "updated"}</span>
                    <span>{new Date(v.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selectedVersion ? (
            <div className="mt-2 rounded border border-slate-200 bg-white p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-slate-700">Compare with v{selectedVersion.versionNo}</p>
                {onRestoreVersion ? (
                  <button
                    type="button"
                    disabled={isRestoring}
                    className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-50"
                    onClick={() => setRestoreVersionId(selectedVersion.id)}
                  >
                    {isRestoring ? "Restoring..." : "Restore"}
                  </button>
                ) : null}
              </div>
              <dl className="mt-2 grid gap-2 text-xs text-slate-600">
                {[
                  ["Title", data.title, selectedVersion.title],
                  ["Priority", data.priority, selectedVersion.priority ?? "-"],
                  ["Type", data.type, selectedVersion.caseType ?? "-"],
                  ["Preconditions", data.preconditions || "-", selectedVersion.preconditions || "-"]
                ].map(([label, current, snapshot]) => (
                  <div key={label} className="grid gap-1 rounded border border-slate-100 p-2 sm:grid-cols-[120px_1fr_1fr]">
                    <dt className="font-medium text-slate-700">{label}</dt>
                    <dd className={current !== snapshot ? "text-red-700" : ""}>Current: {current}</dd>
                    <dd className={current !== snapshot ? "text-emerald-700" : ""}>Version: {snapshot}</dd>
                  </div>
                ))}
              </dl>
              {customFields.filter((field) => field.isActive).length > 0 ? (
                <div className="mt-2 grid gap-1 text-xs text-slate-600">
                  {customFields
                    .filter((field) => field.isActive)
                    .map((field) => {
                      const current = data.customValues[field.systemName] ?? null;
                      const snapshot = selectedVersion.customValuesSnapshot?.[field.systemName] ?? null;
                      return (
                        <div key={field.systemName} className="grid gap-1 rounded border border-slate-100 p-2 sm:grid-cols-[120px_1fr_1fr]">
                          <span className="font-medium text-slate-700">{field.name}</span>
                          <span className={current !== snapshot ? "text-red-700" : ""}>
                            Current: {current == null ? "-" : String(current)}
                          </span>
                          <span className={current !== snapshot ? "text-emerald-700" : ""}>
                            Version: {snapshot == null ? "-" : String(snapshot)}
                          </span>
                        </div>
                      );
                    })}
                </div>
              ) : null}
              <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                <div className="rounded border border-slate-100 p-2">
                  <p className="font-medium text-slate-700">Current steps</p>
                  <ol className="mt-1 list-decimal space-y-1 pl-4">
                    {data.steps.map((step, index) => (
                      <li key={step.id ?? index}>
                        {step.description} <span className="text-slate-500">({step.expected})</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="rounded border border-slate-100 p-2">
                  <p className="font-medium text-slate-700">Version steps</p>
                  <ol className="mt-1 list-decimal space-y-1 pl-4">
                    {(selectedVersion.stepsSnapshot ?? []).map((step) => (
                      <li key={step.stepOrder}>
                        {step.content} <span className="text-slate-500">({step.expectedResult ?? "-"})</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          ) : null}

          {customFields.filter((field) => field.isActive).length > 0 ? (
            <div className="mt-2 rounded border border-slate-200 bg-white p-2">
              <p className="text-xs font-medium text-slate-700">Custom fields</p>
              <dl className="mt-1 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                {customFields
                  .filter((field) => field.isActive)
                  .map((field) => (
                    <div key={field.systemName} className="flex gap-1">
                      <dt className="font-medium">{field.name}:</dt>
                      <dd>{data.customValues[field.systemName] == null ? "-" : String(data.customValues[field.systemName])}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          ) : null}

          {data.steps.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No steps registered.</p>
          ) : (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
              {data.steps.map((step, index) => (
                <li key={step.id ?? `${data.id}-s-${index}`}>
                  {step.description} <span className="text-slate-500">(Expected: {step.expected})</span>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Edit
            </button>
            <button
              type="button"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-800 hover:bg-red-100"
              onClick={() => setConfirmDeleteOpen(true)}
            >
              Delete
            </button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete this test case?"
        description="This action cannot be undone."
        confirmLabel={isDeleting ? "Deleting..." : "Delete"}
        confirmDisabled={isDeleting}
        variant="danger"
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          void onDelete();
        }}
      />

      <ConfirmDialog
        open={stepDeleteId != null}
        title="Remove this step?"
        description="The remaining steps will be renumbered."
        confirmLabel={isStepsBusy ? "Removing..." : "Remove"}
        confirmDisabled={isStepsBusy}
        variant="danger"
        onCancel={() => setStepDeleteId(null)}
        onConfirm={() => {
          const id = stepDeleteId;
          setStepDeleteId(null);
          if (id != null) void onDeleteStep?.(id);
        }}
      />

      <ConfirmDialog
        open={restoreVersionId != null}
        title="Restore this version?"
        description="The selected snapshot will become the current case and a new version will be created."
        confirmLabel={isRestoring ? "Restoring..." : "Restore"}
        confirmDisabled={isRestoring}
        onCancel={() => setRestoreVersionId(null)}
        onConfirm={() => {
          const id = restoreVersionId;
          setRestoreVersionId(null);
          if (id != null) void onRestoreVersion?.(id);
        }}
      />
    </div>
  );
}
