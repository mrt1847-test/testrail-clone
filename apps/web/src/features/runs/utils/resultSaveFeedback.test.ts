import { describe, expect, it } from "vitest";

import {
  canUndoResultSave,
  overlayInstanceStatus,
  pruneMatchedStatusOverrides,
  resultSaveErrorMessage
} from "./resultSaveFeedback";

describe("canUndoResultSave", () => {
  it("is unsafe when the previous status is untested", () => {
    expect(canUndoResultSave("untested")).toBe(false);
  });

  it("is safe after a recorded non-untested status", () => {
    expect(canUndoResultSave("passed")).toBe(true);
    expect(canUndoResultSave("failed")).toBe(true);
  });
});

describe("overlayInstanceStatus", () => {
  it("applies an optimistic status without mutating other rows", () => {
    const rows = [
      { id: "1", status: "untested" },
      { id: "2", status: "blocked" }
    ];
    expect(overlayInstanceStatus(rows, { "1": "passed" })).toEqual([
      { id: "1", status: "passed" },
      { id: "2", status: "blocked" }
    ]);
    expect(rows[0]?.status).toBe("untested");
  });
});

describe("pruneMatchedStatusOverrides", () => {
  it("drops overrides that already match server status", () => {
    expect(pruneMatchedStatusOverrides({ "1": "passed", "2": "failed" }, [{ id: "1", status: "passed" }])).toEqual({
      "2": "failed"
    });
  });
});

describe("resultSaveErrorMessage", () => {
  it("reads a JSON API error body", () => {
    expect(resultSaveErrorMessage(new Error('{"message":"run is closed"}'))).toBe("run is closed");
  });

  it("maps untested-not-allowed to a recovery message", () => {
    expect(resultSaveErrorMessage(new Error('{"code":"UNTESTED_NOT_ALLOWED"}'))).toBe(
      "Untested cannot be set after a result exists for this test."
    );
  });

  it("falls back to a short local message", () => {
    expect(resultSaveErrorMessage("nope")).toBe("Couldn't save result");
  });
});
