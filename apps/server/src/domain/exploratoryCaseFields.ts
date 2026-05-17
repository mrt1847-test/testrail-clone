import type { CustomFieldValue } from "./customFieldTypes.js";

export function normalizeExploratoryCaseFields(input: {
  mission?: string | null;
  goals?: string | null;
  customValues?: Record<string, CustomFieldValue>;
}) {
  const customValues = { ...(input.customValues ?? {}) };
  let mission = input.mission?.trim() || null;
  let goals = input.goals?.trim() || null;

  const legacyMission = customValues.mission;
  const legacyGoals = customValues.goals;
  if (!mission && typeof legacyMission === "string" && legacyMission.trim()) {
    mission = legacyMission.trim();
  }
  if (!goals && typeof legacyGoals === "string" && legacyGoals.trim()) {
    goals = legacyGoals.trim();
  }
  delete customValues.mission;
  delete customValues.goals;

  return { mission, goals, customValues };
}

export function caseRowWithExploratoryFields<T extends {
  mission?: string | null;
  goals?: string | null;
  customValues?: Record<string, CustomFieldValue>;
}>(row: T) {
  const customValues = { ...(row.customValues ?? {}) };
  delete customValues.mission;
  delete customValues.goals;
  return {
    ...row,
    mission: row.mission ?? null,
    goals: row.goals ?? null,
    customValues
  };
}
