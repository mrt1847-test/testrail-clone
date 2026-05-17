import type { CustomFieldValue } from "./customFieldTypes.js";

export const AI_CASE_FIELD_KEYS = ["ai_input", "ai_expected_output"] as const;
export const AI_RESULT_FIELD_KEYS = [
  "ai_actual_output",
  "ai_quality_rating",
  "ai_latency_ms",
  "ai_traces"
] as const;

const AI_CASE_LEGACY_KEYS: Record<(typeof AI_CASE_FIELD_KEYS)[number], string> = {
  ai_input: "aiInput",
  ai_expected_output: "aiExpectedOutput"
};

function readLegacyString(
  customValues: Record<string, CustomFieldValue>,
  key: (typeof AI_CASE_FIELD_KEYS)[number]
) {
  const legacy = customValues[key];
  if (typeof legacy === "string" && legacy.trim()) return legacy.trim();
  return null;
}

export function normalizeAiCaseFields(input: {
  aiInput?: string | null;
  aiExpectedOutput?: string | null;
  customValues?: Record<string, CustomFieldValue>;
}) {
  const customValues = { ...(input.customValues ?? {}) };
  let aiInput = input.aiInput?.trim() || null;
  let aiExpectedOutput = input.aiExpectedOutput?.trim() || null;

  if (!aiInput) aiInput = readLegacyString(customValues, "ai_input");
  if (!aiExpectedOutput) aiExpectedOutput = readLegacyString(customValues, "ai_expected_output");

  for (const key of AI_CASE_FIELD_KEYS) {
    delete customValues[key];
    delete customValues[AI_CASE_LEGACY_KEYS[key]];
  }
  delete customValues.ai_quality_rating;
  delete customValues.ai_latency_ms;
  delete customValues.ai_traces;

  return { aiInput, aiExpectedOutput, customValues };
}

export function caseRowWithAiCaseFields<T extends {
  aiInput?: string | null;
  aiExpectedOutput?: string | null;
  customValues?: Record<string, CustomFieldValue>;
}>(row: T) {
  const customValues = { ...(row.customValues ?? {}) };
  for (const key of AI_CASE_FIELD_KEYS) {
    delete customValues[key];
    delete customValues[AI_CASE_LEGACY_KEYS[key]];
  }
  delete customValues.ai_quality_rating;
  delete customValues.ai_latency_ms;
  delete customValues.ai_traces;
  return {
    ...row,
    aiInput: row.aiInput ?? null,
    aiExpectedOutput: row.aiExpectedOutput ?? null,
    customValues
  };
}

export function parseAiQualityRating(value: unknown): number | null {
  if (value == null || value === "") return null;
  const rating = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("ai_quality_rating must be an integer from 1 to 5");
  }
  return rating;
}

export function parseAiLatencyMs(value: unknown): number | null {
  if (value == null || value === "") return null;
  const latency = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(latency) || latency < 0) {
    throw new Error("ai_latency_ms must be a non-negative integer");
  }
  return latency;
}

export function normalizeAiResultFields(input: {
  aiActualOutput?: string | null;
  aiQualityRating?: number | null;
  aiLatencyMs?: number | null;
  aiTraces?: string | null;
  customValues?: Record<string, CustomFieldValue>;
}) {
  const customValues = { ...(input.customValues ?? {}) };
  let aiActualOutput = input.aiActualOutput?.trim() || null;
  let aiTraces = input.aiTraces?.trim() || null;

  if (!aiActualOutput && typeof customValues.ai_actual_output === "string") {
    aiActualOutput = customValues.ai_actual_output.trim() || null;
  }
  if (!aiTraces && typeof customValues.ai_traces === "string") {
    aiTraces = customValues.ai_traces.trim() || null;
  }

  const aiQualityRating =
    input.aiQualityRating !== undefined
      ? input.aiQualityRating
      : customValues.ai_quality_rating != null
        ? parseAiQualityRating(customValues.ai_quality_rating)
        : null;
  const aiLatencyMs =
    input.aiLatencyMs !== undefined
      ? input.aiLatencyMs
      : customValues.ai_latency_ms != null
        ? parseAiLatencyMs(customValues.ai_latency_ms)
        : null;

  delete customValues.ai_actual_output;
  delete customValues.ai_quality_rating;
  delete customValues.ai_latency_ms;
  delete customValues.ai_traces;

  return { aiActualOutput, aiQualityRating, aiLatencyMs, aiTraces, customValues };
}

export function resultRowWithAiFields<T extends {
  aiActualOutput?: string | null;
  aiQualityRating?: number | null;
  aiLatencyMs?: number | null;
  aiTraces?: string | null;
  customValues?: Record<string, CustomFieldValue>;
}>(row: T) {
  const customValues = { ...(row.customValues ?? {}) };
  delete customValues.ai_actual_output;
  delete customValues.ai_quality_rating;
  delete customValues.ai_latency_ms;
  delete customValues.ai_traces;
  return {
    ...row,
    aiActualOutput: row.aiActualOutput ?? null,
    aiQualityRating: row.aiQualityRating ?? null,
    aiLatencyMs: row.aiLatencyMs ?? null,
    aiTraces: row.aiTraces ?? null,
    customValues
  };
}
