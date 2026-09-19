export type RunInstructionStep = {
  order: number;
  action: string;
  expected: string | null;
};

export type RunCaseInstructionModel = {
  preconditions: string | null;
  commonExpected: string | null;
  steps: RunInstructionStep[];
  textInstructions: string | null;
  mission: string | null;
  goals: string | null;
  aiInput: string | null;
  aiExpectedOutput: string | null;
  scenarios: Array<{ id?: string | number; name: string; content: string }>;
  isEmpty: boolean;
};

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed === "-") return null;
  return trimmed;
}

export function buildRunCaseInstructionModel(
  input: {
    preconditions?: string | null;
    expectedResult?: string | null;
    steps?: Array<{ description?: string | null; expected?: string | null; stepOrder?: number | null }>;
    mission?: string | null;
    goals?: string | null;
    aiInput?: string | null;
    aiExpectedOutput?: string | null;
    scenarios?: Array<{ id?: string | number; name: string; content: string }>;
  },
  options?: { usesStructuredSteps?: boolean }
): RunCaseInstructionModel {
  const steps = [...(input.steps ?? [])]
    .sort((a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))
    .map((step, index) => ({
      order: step.stepOrder ?? index + 1,
      action: step.description?.trim() ?? "",
      expected: trimOrNull(step.expected)
    }))
    .filter((step) => step.action || step.expected);

  const preconditions = trimOrNull(input.preconditions);
  const persistedExpected = trimOrNull(input.expectedResult);
  const inferredStructured =
    options?.usesStructuredSteps ?? (steps.length > 1 || steps.some((step) => Boolean(step.expected)));
  const structuredSteps = inferredStructured ? steps : [];
  const textInstructions = inferredStructured
    ? null
    : steps.length > 0
      ? steps.map((step) => step.action).filter(Boolean).join("\n") || null
      : persistedExpected;
  const commonExpected = inferredStructured || steps.length > 0 ? persistedExpected : null;
  const mission = trimOrNull(input.mission);
  const goals = trimOrNull(input.goals);
  const aiInput = trimOrNull(input.aiInput);
  const aiExpectedOutput = trimOrNull(input.aiExpectedOutput);
  const scenarios = (input.scenarios ?? []).filter((row) => row.content.trim() || row.name.trim());

  return {
    preconditions,
    commonExpected,
    steps: structuredSteps,
    textInstructions,
    mission,
    goals,
    aiInput,
    aiExpectedOutput,
    scenarios,
    isEmpty:
      !preconditions &&
      !commonExpected &&
      structuredSteps.length === 0 &&
      !textInstructions &&
      !mission &&
      !goals &&
      !aiInput &&
      !aiExpectedOutput &&
      scenarios.length === 0
  };
}
