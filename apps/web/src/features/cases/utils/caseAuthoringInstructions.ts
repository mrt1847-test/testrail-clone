import type { CasePriority, CaseStep, CaseType } from "../types";

export type CaseInstructionKind = "text" | "steps" | "other";

export type CaseAuthoringDraftStep = {
  key: string;
  id?: number;
  description: string;
  expected: string;
};

export const CASE_TYPE_OPTIONS: CaseType[] = ["Functional", "Integration", "Regression"];
export const CASE_PRIORITY_OPTIONS: CasePriority[] = ["High", "Medium", "Low"];

export function apiCaseTypeValue(type: CaseType): "functional" | "integration" | "regression" {
  return type.toLowerCase() as "functional" | "integration" | "regression";
}

export function apiCasePriorityValue(priority: CasePriority): "high" | "medium" | "low" {
  return priority.toLowerCase() as "high" | "medium" | "low";
}

export function instructionKindFromTemplateFields(fields: string[] | undefined): CaseInstructionKind {
  const keys = (fields ?? []).map((field) => field.trim().toLowerCase());
  if (keys.includes("steps")) return "steps";
  if (keys.includes("expectedresult")) return "text";
  return "other";
}

export function newAuthoringStepKey(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyAuthoringDraftStep(): CaseAuthoringDraftStep {
  return { key: newAuthoringStepKey(), description: "", expected: "" };
}

export function draftStepsFromCaseSteps(steps: CaseStep[]): CaseAuthoringDraftStep[] {
  if (steps.length === 0) return [emptyAuthoringDraftStep()];
  return steps.map((step) => ({
    key: step.id != null ? `step-${step.id}` : newAuthoringStepKey(),
    id: step.id,
    description: step.description === "-" ? "" : step.description,
    expected: !step.expected || step.expected === "-" ? "" : step.expected
  }));
}

export function textStepsFromPersistedSteps(steps: CaseStep[]): string {
  if (steps.length === 0) return "";
  const meaningful = steps.filter((step) => {
    const action = step.description.trim();
    return action.length > 0 && action !== "-";
  });
  if (meaningful.length === 0) return "";
  return meaningful.map((step) => step.description.trim()).join("\n");
}

export function draftStepsForTextPersist(stepsText: string): CaseAuthoringDraftStep[] {
  const content = stepsText.trim();
  if (!content) return [];
  return [{ key: newAuthoringStepKey(), description: content, expected: "" }];
}

export function structuredStepsHaveContent(steps: CaseAuthoringDraftStep[]): boolean {
  return steps.some((step) => step.description.trim().length > 0 || step.expected.trim().length > 0);
}

export function convertInstructionDraft(input: {
  from: CaseInstructionKind;
  to: CaseInstructionKind;
  stepsText: string;
  draftSteps: CaseAuthoringDraftStep[];
  expectedResult: string;
}): {
  stepsText: string;
  draftSteps: CaseAuthoringDraftStep[];
  expectedResult: string;
  warning: string | null;
} {
  if (input.from === input.to) {
    return {
      stepsText: input.stepsText,
      draftSteps: input.draftSteps,
      expectedResult: input.expectedResult,
      warning: null
    };
  }

  if (input.from === "text" && input.to === "steps") {
    const action = input.stepsText.trim();
    return {
      stepsText: "",
      draftSteps: action
        ? [{ key: newAuthoringStepKey(), description: action, expected: "" }]
        : [emptyAuthoringDraftStep()],
      expectedResult: input.expectedResult,
      warning: action
        ? "The prose Steps become the first Action. Expected result stays as the common expected outcome."
        : null
    };
  }

  if (input.from === "steps" && input.to === "text") {
    const filled = input.draftSteps.filter((step) => step.description.trim() || step.expected.trim());
    const stepsText = filled.map((step) => step.description.trim()).filter(Boolean).join("\n");
    const droppedExpected = filled.some((step) => step.expected.trim().length > 0);
    return {
      stepsText,
      draftSteps: [emptyAuthoringDraftStep()],
      expectedResult: input.expectedResult,
      warning: droppedExpected
        ? "Per-step Expected values are not copied into the Text Steps field. Common Expected result is kept."
        : filled.length > 0
          ? "Step actions are kept as prose Steps. Common Expected result is kept."
          : null
    };
  }

  return {
    stepsText: input.from === "text" ? input.stepsText : "",
    draftSteps: input.to === "steps" ? input.draftSteps : [emptyAuthoringDraftStep()],
    expectedResult: input.expectedResult,
    warning:
      input.from !== "other" && input.to !== "other"
        ? null
        : "Template-specific instruction fields that do not exist on the next template stay in the draft until you save, then unused values are not shown."
  };
}
