import { Button } from "../../../shared/ui/Button";
import { FormField } from "../../../shared/ui/FormField";
import type { CaseAuthoringDraftStep } from "../utils/caseAuthoringInstructions";
import { emptyAuthoringDraftStep } from "../utils/caseAuthoringInstructions";

type Props = {
  steps: CaseAuthoringDraftStep[];
  disabled?: boolean;
  onChange: (steps: CaseAuthoringDraftStep[]) => void;
};

export function CaseStepsEditor({ steps, disabled = false, onChange }: Props) {
  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= steps.length) return;
    const next = [...steps];
    const [row] = next.splice(index, 1);
    next.splice(nextIndex, 0, row!);
    onChange(next);
  };

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">Steps</p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={disabled}
          onClick={() => onChange([...steps, emptyAuthoringDraftStep()])}
        >
          Add step
        </Button>
      </div>
      <ol className="grid gap-3">
        {steps.map((step, index) => (
          <li key={step.key} className="grid gap-2 border-t border-slate-200 pt-3 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-xs font-semibold text-slate-500">{index + 1}.</span>
              {steps.length > 1 ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={disabled || index === 0}
                    aria-label={`Move step ${index + 1} up`}
                    onClick={() => move(index, -1)}
                  >
                    Up
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={disabled || index === steps.length - 1}
                    aria-label={`Move step ${index + 1} down`}
                    onClick={() => move(index, 1)}
                  >
                    Down
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={disabled}
                    className="ml-auto text-red-800"
                    aria-label={`Remove step ${index + 1}`}
                    onClick={() => onChange(steps.filter((row) => row.key !== step.key))}
                  >
                    Remove
                  </Button>
                </>
              ) : null}
            </div>
            <FormField label="Action" controlId={`case-step-action-${step.key}`}>
              {(controlProps) => (
                <textarea
                  {...controlProps}
                  value={step.description}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange(
                      steps.map((row) =>
                        row.key === step.key ? { ...row, description: event.target.value } : row
                      )
                    )
                  }
                  className="min-h-[56px] rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                />
              )}
            </FormField>
            <FormField label="Expected" controlId={`case-step-expected-${step.key}`}>
              {(controlProps) => (
                <textarea
                  {...controlProps}
                  value={step.expected}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange(
                      steps.map((row) => (row.key === step.key ? { ...row, expected: event.target.value } : row))
                    )
                  }
                  className="min-h-[44px] rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                />
              )}
            </FormField>
          </li>
        ))}
      </ol>
    </div>
  );
}
