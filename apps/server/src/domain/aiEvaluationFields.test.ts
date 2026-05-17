import { describe, expect, it } from "vitest";

import {
  caseRowWithAiCaseFields,
  normalizeAiCaseFields,
  normalizeAiResultFields,
  parseAiQualityRating
} from "./aiEvaluationFields.js";

describe("aiEvaluationFields", () => {
  it("lifts legacy AI case keys from customValues", () => {
    const normalized = normalizeAiCaseFields({
      customValues: {
        ai_input: " prompt ",
        ai_expected_output: "expected text",
        ai_quality_rating: 4
      }
    });
    expect(normalized.aiInput).toBe("prompt");
    expect(normalized.aiExpectedOutput).toBe("expected text");
    expect(normalized.customValues).toEqual({});
  });

  it("strips AI keys from read models", () => {
    const row = caseRowWithAiCaseFields({
      aiInput: "in",
      aiExpectedOutput: "out",
      customValues: { ai_input: "legacy", env: "prod" }
    });
    expect(row.customValues).toEqual({ env: "prod" });
  });

  it("validates quality rating range", () => {
    expect(parseAiQualityRating(3)).toBe(3);
    expect(() => parseAiQualityRating(6)).toThrow(/1 to 5/);
  });

  it("normalizes AI result metrics from legacy customValues", () => {
    const normalized = normalizeAiResultFields({
      customValues: {
        ai_actual_output: " model reply ",
        ai_quality_rating: "4",
        ai_latency_ms: "120",
        ai_traces: "trace log"
      }
    });
    expect(normalized.aiActualOutput).toBe("model reply");
    expect(normalized.aiQualityRating).toBe(4);
    expect(normalized.aiLatencyMs).toBe(120);
    expect(normalized.aiTraces).toBe("trace log");
    expect(normalized.customValues).toEqual({});
  });
});
