import { describe, expect, it } from "vitest";

import {
  attachmentRetryFailureMessage,
  canUndoResultSave,
  overlayInstanceStatus,
  pruneMatchedStatusOverrides,
  resultPartialAttachmentFailureMessage,
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

  it("maps storage-unavailable to a local recovery message", () => {
    expect(
      resultSaveErrorMessage(
        new Error('{"error":{"code":"STORAGE_UNAVAILABLE","message":"attachment storage is not available"}}')
      )
    ).toBe("Couldn't store the file. Attachment storage isn't available.");
  });

  it("falls back to a short local message", () => {
    expect(resultSaveErrorMessage("nope")).toBe("Couldn't save result");
  });
});

describe("resultPartialAttachmentFailureMessage", () => {
  it("names the saved result and the failed file", () => {
    expect(resultPartialAttachmentFailureMessage(["a.png"])).toBe("Result saved. Couldn't attach a.png.");
    expect(resultPartialAttachmentFailureMessage(["a.png", "b.log"])).toBe("Result saved. Couldn't attach 2 files.");
  });
});

describe("attachmentRetryFailureMessage", () => {
  it("keeps retry copy local to the failed files", () => {
    expect(attachmentRetryFailureMessage(["a.png"])).toBe("Couldn't attach a.png");
  });
});
