import { describe, expect, it } from "vitest";

import {
  RESULT_CORRECTION_POLICY,
  rejectResultRowMutation
} from "./resultCorrectionPolicy.js";

describe("resultCorrectionPolicy", () => {
  it("documents append-only correction via new results", () => {
    expect(RESULT_CORRECTION_POLICY.mode).toBe("append_only");
    expect(RESULT_CORRECTION_POLICY.allowEditHistoricalResult).toBe(false);
    expect(RESULT_CORRECTION_POLICY.correctionMethod).toBe("add_result");
    expect(RESULT_CORRECTION_POLICY.allowedPostSubmitActions).toContain("attachment");
  });

  it("rejects in-place result mutations", () => {
    expect(() => rejectResultRowMutation("PATCH")).toThrowError(/cannot be edited/i);
    try {
      rejectResultRowMutation("DELETE");
    } catch (error) {
      const err = error as { code?: string; statusCode?: number; details?: Record<string, unknown> };
      expect(err.code).toBe("RESULT_IMMUTABLE");
      expect(err.statusCode).toBe(405);
      expect(err.details?.correctionMethod).toBe("add_result");
    }
  });
});
