import { CommentComposer } from "../../comments/CommentComposer";
import type { CaseStepContext, ResultStatus, StepResultDraft } from "./resultEntryTypes";
import { createStepDraft, createStepDraftsFromCaseSteps } from "./resultEntryUtils";

type StepResultEditorProps = {
  projectId?: string;
  caseSteps: CaseStepContext[];
  isCaseStepsLoading: boolean;
  stepResults: StepResultDraft[];
  onChange: (stepResults: StepResultDraft[]) => void;
};

export function StepResultEditor({
  projectId,
  caseSteps,
  isCaseStepsLoading,
  stepResults,
  onChange
}: StepResultEditorProps) {
  function updateStepResult(id: string, patch: Partial<Omit<StepResultDraft, "id">>) {
    onChange(stepResults.map((step) => (step.id === id ? { ...step, ...patch } : step)));
  }

  function addStepResult() {
    onChange([...stepResults, createStepDraft(Math.max(...stepResults.map((step) => step.stepOrder), 0) + 1)]);
  }

  function removeStepResult(id: string) {
    const next = stepResults.filter((step) => step.id !== id);
    onChange(next.length > 0 ? next : createStepDraftsFromCaseSteps(caseSteps));
  }

  return (
    <details className="group border-t border-slate-100 pt-2">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium text-slate-700">
        <span>
          Step results ({stepResults.length})
          {isCaseStepsLoading ? <span className="ml-1 font-normal text-slate-500">loading...</span> : null}
        </span>
        <span className="text-slate-400 group-open:hidden">Show</span>
        <span className="hidden text-slate-400 group-open:inline">Hide</span>
      </summary>
      <div className="mt-3 space-y-2">
        <button type="button" className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs font-medium text-slate-700" onClick={addStepResult}>
          Add step result
        </button>
        {stepResults.map((step, index) => {
          const context = caseSteps.find((item, itemIndex) => (item.stepOrder ?? itemIndex + 1) === step.stepOrder);
          return (
            <div key={step.id} className="rounded border border-slate-200 bg-slate-50 p-2">
              {context ? (
                <div className="mb-2 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
                  <p className="font-medium text-slate-700">Step {step.stepOrder}</p>
                  <p>{context.description}</p>
                  {context.expected ? <p className="mt-1 text-slate-500">Expected: {context.expected}</p> : null}
                </div>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  className="w-full rounded border border-slate-300 px-2 py-1 text-xs sm:w-16"
                  min={1}
                  type="number"
                  value={step.stepOrder}
                  aria-label={`Step ${index + 1} order`}
                  onChange={(e) =>
                    updateStepResult(step.id, {
                      stepOrder: Math.max(1, Number(e.target.value) || index + 1)
                    })
                  }
                />
                <select
                  className="rounded border border-slate-300 px-2 py-1 text-xs"
                  value={step.status}
                  onChange={(e) => updateStepResult(step.id, { status: e.target.value as ResultStatus })}
                >
                  <option value="passed">passed</option>
                  <option value="failed">failed</option>
                  <option value="blocked">blocked</option>
                  <option value="retest">retest</option>
                  <option value="untested">untested</option>
                </select>
                <input
                  className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                  placeholder="actual result"
                  value={step.actualResult}
                  onChange={(e) => updateStepResult(step.id, { actualResult: e.target.value })}
                />
                <button
                  type="button"
                  className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
                  disabled={stepResults.length === 1}
                  onClick={() => removeStepResult(step.id)}
                >
                  Remove
                </button>
              </div>
              {projectId ? (
                <div className="mt-2">
                  <CommentComposer
                    projectId={projectId}
                    value={step.comment}
                    onChange={(comment) => updateStepResult(step.id, { comment })}
                    rows={2}
                    showTemplates={false}
                    showPreview={false}
                    placeholder="step comment"
                    textareaClassName="min-h-16 w-full resize-y rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                </div>
              ) : (
                <textarea
                  className="mt-2 min-h-16 w-full resize-y rounded border border-slate-300 px-2 py-1 text-xs"
                  placeholder="step comment"
                  value={step.comment}
                  onChange={(e) => updateStepResult(step.id, { comment: e.target.value })}
                />
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}
