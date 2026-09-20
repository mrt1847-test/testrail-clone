import type { TestCase } from "../types";
import type { CustomFieldScalar } from "../../../shared/customFields/customFieldTypes";

export function authoringCustomValuesFromCase(
  data: Pick<TestCase, "customValues" | "mission" | "goals" | "aiInput" | "aiExpectedOutput">
): Record<string, CustomFieldScalar> {
  return {
    ...data.customValues,
    ...(data.mission.trim() ? { mission: data.mission } : {}),
    ...(data.goals.trim() ? { goals: data.goals } : {}),
    ...(data.aiInput.trim() ? { ai_input: data.aiInput } : {}),
    ...(data.aiExpectedOutput.trim() ? { ai_expected_output: data.aiExpectedOutput } : {})
  };
}
