import { describe, expect, it } from "vitest";

import { buildBulkCaseFeedback } from "./bulkCaseFeedback";

describe("buildBulkCaseFeedback", () => {
  it("returns partial feedback with per-case failures", () => {
    const feedback = buildBulkCaseFeedback({
      successCount: 1,
      failedCount: 1,
      successLabel: "Updated",
      failureLabel: "Could not update",
      items: [
        { caseId: "10", success: true, error: null },
        { caseId: "11", success: false, error: "CONFLICT" }
      ],
      caseLabelById: new Map([[10, "C10 Login"], [11, "C11 Checkout"]])
    });

    expect(feedback?.tone).toBe("partial");
    expect(feedback?.failures).toEqual([
      { caseId: "11", label: "C11 Checkout", error: "CONFLICT" }
    ]);
  });
});
