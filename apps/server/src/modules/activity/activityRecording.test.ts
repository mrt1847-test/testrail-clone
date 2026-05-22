import { describe, expect, it } from "vitest";

import {
  assignmentActivityPayload,
  bulkResultIds
} from "./activityRecording.js";
import type { BulkResultResponse } from "../results/results.types.js";

describe("activityRecording", () => {
  it("builds assignment payload with notify target", () => {
    expect(assignmentActivityPayload(42n, { runId: "9" })).toEqual({
      assignedTo: "42",
      assignedToUserId: "42",
      notifyUserId: "42",
      runId: "9"
    });
    expect(assignmentActivityPayload(null)).toEqual({
      assignedTo: null,
      assignedToUserId: null
    });
  });

  it("collects saved result ids from bulk responses", () => {
    const res: BulkResultResponse = {
      runId: 1n,
      atomic: false,
      total: 2,
      saved: 1,
      failed: 1,
      items: [
        { index: 0, caseId: 10n, status: "saved", testId: 100n, resultId: 401n },
        { index: 1, caseId: 11n, status: "failed", errorCode: "X", message: "bad" }
      ]
    };
    expect(bulkResultIds(res)).toEqual(["401"]);
  });
});
