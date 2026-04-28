import { useEffect, useState } from "react";

import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import type { CaseStep, TestCase } from "../types";

type ExpandableCaseDetailProps = {
  data: TestCase;
  mode: "view" | "edit";
  onEdit: () => void;
  onClose: () => void;
  onSave: (patch: { title: string; preconditions: string }) => Promise<void>;
  onDelete: () => Promise<void>;
  isSaving?: boolean;
  isDeleting?: boolean;
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
    expected: s.expected === "—" ? "" : s.expected
  }));
}

export function ExpandableCaseDetail({
  data,
  mode,
  onEdit,
  onClose,
  onSave,
  onDelete,
  isSaving = false,
  isDeleting = false,
  onCreateStep,
  onUpdateStep,
  onDeleteStep,
  isStepsBusy = false
}: ExpandableCaseDetailProps) {
  const [title, setTitle] = useState(data.title);
  const [preconditions, setPreconditions] = useState(data.preconditions);
  const [localSteps, setLocalSteps] = useState<LocalStep[]>(() => toLocalSteps(data.steps));
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [stepDeleteId, setStepDeleteId] = useState<number | null>(null);

  useEffect(() => {
    setTitle(data.title);
    setPreconditions(data.preconditions);
  }, [data.id, data.title, data.preconditions]);

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
    const targetOrder = swap + 1;
    void onUpdateStep?.(stepId, { stepOrder: targetOrder });
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
                onClick={() =>
                  void onCreateStep?.({ content: "New step", expected: "" })
                }
              >
                {isStepsBusy ? "…" : "Add step"}
              </button>
            </div>
            {localSteps.length === 0 ? (
              <p className="text-xs text-slate-500">스텝이 없습니다. Add step으로 추가하세요.</p>
            ) : (
              <ol className="list-decimal space-y-3 pl-5 text-sm">
                {localSteps.map((step, index) => (
                  <li key={step.id ?? `draft-${index}`} className="grid gap-2 rounded-md border border-slate-200 bg-white p-2">
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
                          const v = e.target.value;
                          setLocalSteps((prev) => prev.map((s, i) => (i === index ? { ...s, description: v } : s)));
                        }}
                        onBlur={() => {
                          if (step.id == null || !onUpdateStep) return;
                          const orig = data.steps.find((s) => s.id === step.id);
                          if (!orig) return;
                          const trimmed = step.description.trim();
                          const expTrim = step.expected.trim();
                          const origExp = orig.expected === "—" ? "" : orig.expected;
                          if (orig.description !== trimmed || origExp !== expTrim) {
                            void onUpdateStep(step.id, {
                              content: trimmed,
                              expectedResult: expTrim.length ? expTrim : null
                            });
                          }
                        }}
                        className="min-h-[56px] rounded border border-slate-200 px-2 py-1 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-slate-400"
                      />
                    </label>
                    <label className="grid gap-0.5 text-xs text-slate-600">
                      Expected
                      <textarea
                        value={step.expected}
                        disabled={isStepsBusy}
                        onChange={(e) => {
                          const v = e.target.value;
                          setLocalSteps((prev) => prev.map((s, i) => (i === index ? { ...s, expected: v } : s)));
                        }}
                        onBlur={() => {
                          if (step.id == null || !onUpdateStep) return;
                          const orig = data.steps.find((s) => s.id === step.id);
                          if (!orig) return;
                          const trimmed = step.description.trim();
                          const expTrim = step.expected.trim();
                          const origExp = orig.expected === "—" ? "" : orig.expected;
                          if (orig.description !== trimmed || origExp !== expTrim) {
                            void onUpdateStep(step.id, {
                              content: trimmed,
                              expectedResult: expTrim.length ? expTrim : null
                            });
                          }
                        }}
                        className="min-h-[44px] rounded border border-slate-200 px-2 py-1 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-slate-400"
                      />
                    </label>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={isSaving || !title.trim()}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
              onClick={() => void onSave({ title: title.trim(), preconditions: preconditions.trim() })}
            >
              {isSaving ? "Saving…" : "Save"}
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
            <span className="font-medium">Preconditions:</span> {data.preconditions || "—"}
          </p>
          {data.steps.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">등록된 스텝이 없습니다.</p>
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
        description="이 작업은 되돌릴 수 없습니다."
        confirmLabel={isDeleting ? "Deleting…" : "Delete"}
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
        description="스텝이 삭제되고 순서가 다시 매겨집니다."
        confirmLabel={isStepsBusy ? "…" : "Remove"}
        confirmDisabled={isStepsBusy}
        variant="danger"
        onCancel={() => setStepDeleteId(null)}
        onConfirm={() => {
          const id = stepDeleteId;
          setStepDeleteId(null);
          if (id != null) void onDeleteStep?.(id);
        }}
      />
    </div>
  );
}
