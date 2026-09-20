import { beforeEach, describe, expect, it } from "vitest";

import {
  clearParkedPartialRecovery,
  parkedRecoveryToFeedback,
  readAllParkedPartialRecoveries,
  resolveResultDialogClosePrompt,
  resultAttachmentReselectMessage,
  serializeParkedPartialRecovery,
  shouldDiscardResultRecovery,
  writeParkedPartialRecovery
} from "./resultPartialRecoveryModel";
import type { ResultSaveFeedback } from "./resultSaveFeedback";

function feedback(partial: Partial<ResultSaveFeedback> & Pick<ResultSaveFeedback, "testId">): ResultSaveFeedback {
  return {
    status: "failed",
    message: "Result saved. Couldn't attach a.png.",
    previousStatus: "untested",
    canUndo: false,
    retryPayload: {
      status: "failed",
      comment: "empty cart",
      stagedAttachments: [{ id: "f1", file: new File(["x"], "a.png", { type: "image/png" }) }]
    },
    createdResultId: "result-9",
    operationId: "op-1",
    kind: "attach-only",
    ...partial
  };
}

const memory = new Map<string, string>();

beforeEach(() => {
  memory.clear();
  (globalThis as { window?: unknown }).window = {
    sessionStorage: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
      clear: () => memory.clear()
    }
  };
});

describe("resolveResultDialogClosePrompt", () => {
  it("parks partial success instead of forcing a silent discard", () => {
    expect(
      resolveResultDialogClosePrompt({ saving: false, dirty: true, partialSuccess: true })
    ).toBe("partial-success-leave");
  });

  it("confirms discard only for unsaved drafts", () => {
    expect(
      resolveResultDialogClosePrompt({ saving: false, dirty: true, partialSuccess: false })
    ).toBe("discard-unsaved-draft");
    expect(
      resolveResultDialogClosePrompt({ saving: false, dirty: false, partialSuccess: false })
    ).toBe("none");
  });
});

describe("shouldDiscardResultRecovery", () => {
  it("discards only on explicit discard", () => {
    expect(shouldDiscardResultRecovery("leave-with-recovery")).toBe(false);
    expect(shouldDiscardResultRecovery("discard")).toBe(true);
    expect(shouldDiscardResultRecovery("keep-editing")).toBe(false);
  });
});

describe("parked partial recovery session", () => {
  it("stores metadata without file bytes and restores a reselect prompt", () => {
    writeParkedPartialRecovery("run-1", feedback({ testId: "1" }));
    const parked = readAllParkedPartialRecoveries("run-1");
    expect(parked).toHaveLength(1);
    expect(parked[0]?.missingFileNames).toEqual(["a.png"]);
    expect(parked[0]?.retryPayload).not.toHaveProperty("stagedAttachments");
    const restored = parkedRecoveryToFeedback(parked[0]!);
    expect(restored.status).toBe("failed");
    expect(restored.createdResultId).toBe("result-9");
    expect(restored.awaitingFileReselect).toBe(true);
    expect(restored.message).toBe(resultAttachmentReselectMessage(["a.png"]));
    expect(restored.retryPayload.stagedAttachments).toEqual([]);
  });

  it("keeps A and B recoveries independent and clears only the discarded test", () => {
    writeParkedPartialRecovery("run-1", feedback({ testId: "A", createdResultId: "rA" }));
    writeParkedPartialRecovery("run-1", feedback({ testId: "B", createdResultId: "rB" }));
    expect(readAllParkedPartialRecoveries("run-1").map((row) => row.testId).sort()).toEqual(["A", "B"]);
    clearParkedPartialRecovery("run-1", "A");
    expect(readAllParkedPartialRecoveries("run-1").map((row) => row.testId)).toEqual(["B"]);
  });

  it("keeps missing file names when re-persisting a restored parked row", () => {
    writeParkedPartialRecovery("run-1", feedback({ testId: "1" }));
    const first = readAllParkedPartialRecoveries("run-1")[0]!;
    const restored = parkedRecoveryToFeedback(first);
    writeParkedPartialRecovery("run-1", restored);
    const second = readAllParkedPartialRecoveries("run-1")[0]!;
    expect(second.missingFileNames).toEqual(["a.png"]);
    expect(second.awaitingFileReselect).toBe(true);
  });

  it("serializeParkedPartialRecovery ignores non-failed or result-less rows", () => {
    expect(
      serializeParkedPartialRecovery(feedback({ testId: "1", status: "saved", createdResultId: "r1" }))
    ).toBeNull();
    expect(serializeParkedPartialRecovery(feedback({ testId: "1", createdResultId: null }))).toBeNull();
  });
});
