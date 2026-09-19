import { describe, expect, it } from "vitest";

import {
  applyCaseActualResult,
  applyStagedComposerUploadPatch,
  canRemoveStagedComposerFile,
  classifyResultAttachmentError,
  createdResultId,
  isAttachmentStorageUnavailable,
  isResultAttachmentPresignUnavailable,
  mergeStagedComposerFiles,
  pendingStagedComposerFiles,
  stagedAttachmentsFromPayload,
  stagedComposerStatusLabel,
  type StagedComposerFile
} from "./resultComposerModel";

describe("applyCaseActualResult", () => {
  it("writes the case-level actual result onto an empty first step", () => {
    expect(
      applyCaseActualResult(
        [
          { stepOrder: 1, status: "failed", actualResult: "", comment: "step note" },
          { stepOrder: 2, status: "passed" }
        ],
        "  saw a 500  "
      )
    ).toEqual([
      { stepOrder: 1, status: "failed", actualResult: "saw a 500", comment: "step note" },
      { stepOrder: 2, status: "passed" }
    ]);
  });

  it("does not overwrite a step that already has an actual result", () => {
    const steps = [{ stepOrder: 1, status: "failed" as const, actualResult: "from step" }];
    expect(applyCaseActualResult(steps, "from composer")).toEqual(steps);
  });

  it("creates a first step when none exist", () => {
    expect(applyCaseActualResult([], "timeout")).toEqual([
      { stepOrder: 1, status: "passed", actualResult: "timeout" }
    ]);
  });

  it("ignores blank actual result", () => {
    const steps = [{ stepOrder: 1, status: "failed" as const }];
    expect(applyCaseActualResult(steps, "  ")).toEqual(steps);
  });
});

describe("createdResultId", () => {
  it("reads id from a created result payload", () => {
    expect(createdResultId({ id: 12n as unknown as number })).toBe("12");
    expect(createdResultId({ id: "44" })).toBe("44");
    expect(createdResultId({ data: { id: "9" } })).toBe("9");
  });

  it("returns null when id is missing", () => {
    expect(createdResultId(null)).toBeNull();
    expect(createdResultId({})).toBeNull();
    expect(createdResultId({ data: {} })).toBeNull();
  });
});

describe("classifyResultAttachmentError", () => {
  it("treats memory-mode STORAGE_UNAVAILABLE as unsupported storage, not a missing result", () => {
    const storage = new Error('{"error":{"code":"STORAGE_UNAVAILABLE","message":"attachment storage is not available"}}');
    expect(classifyResultAttachmentError(storage)).toBe("storage-unavailable");
    expect(isAttachmentStorageUnavailable(storage)).toBe(true);
    expect(isResultAttachmentPresignUnavailable(storage)).toBe(true);
  });

  it("does not convert result-not-found 404 into a metadata-only success path", () => {
    const missing = new Error('{"error":{"code":"NOT_FOUND","message":"result not found"}}');
    expect(classifyResultAttachmentError(missing)).toBe("result-not-found");
    expect(isAttachmentStorageUnavailable(missing)).toBe(false);
    expect(isResultAttachmentPresignUnavailable(missing)).toBe(false);
  });

  it("keeps upload and association failures distinct from storage-unavailable", () => {
    expect(classifyResultAttachmentError(new Error("attachment upload failed"))).toBe("upload-failed");
    expect(classifyResultAttachmentError(new Error("register attachment failed"))).toBe("association-failed");
    expect(isResultAttachmentPresignUnavailable(new Error("Not Found"))).toBe(false);
  });
});

describe("mergeStagedComposerFiles", () => {
  it("appends unique files and skips exact duplicates", () => {
    const first = new File(["a"], "fail.png", { type: "image/png", lastModified: 1 });
    const same = new File(["a"], "fail.png", { type: "image/png", lastModified: 1 });
    const second = new File(["b"], "log.txt", { type: "text/plain", lastModified: 2 });
    const merged = mergeStagedComposerFiles([{ id: "1", file: first, status: "queued" }], [same, second]);
    expect(merged).toHaveLength(2);
    expect(merged.map((row) => row.file.name)).toEqual(["fail.png", "log.txt"]);
    expect(merged[1]?.status).toBe("queued");
  });
});

describe("staged composer upload state", () => {
  it("keeps queued and failed files pending and blocks remove while uploading", () => {
    const file = new File(["a"], "shot.png", { type: "image/png" });
    const queued: StagedComposerFile = { id: "1", file, status: "queued" };
    const failed = applyStagedComposerUploadPatch([queued], "1", { status: "failed", message: "network" });
    expect(pendingStagedComposerFiles(failed)).toHaveLength(1);
    expect(canRemoveStagedComposerFile("queued")).toBe(true);
    expect(canRemoveStagedComposerFile("failed")).toBe(true);
    expect(canRemoveStagedComposerFile("uploading")).toBe(false);
    expect(canRemoveStagedComposerFile("uploaded")).toBe(false);
  });

  it("labels queued, uploading, attached, and failed states", () => {
    expect(stagedComposerStatusLabel("queued")).toBe("Queued");
    expect(stagedComposerStatusLabel("uploading")).toBe("Uploading…");
    expect(stagedComposerStatusLabel("uploading", 40)).toBe("Uploading 40%");
    expect(stagedComposerStatusLabel("uploaded")).toBe("Attached");
    expect(stagedComposerStatusLabel("failed")).toBe("Failed");
  });

  it("prefers staged attachment ids over anonymous files", () => {
    const file = new File(["a"], "shot.png", { type: "image/png" });
    expect(stagedAttachmentsFromPayload({ stagedAttachments: [{ id: "abc", file }], attachments: [file] })).toEqual([
      { id: "abc", file }
    ]);
    expect(stagedAttachmentsFromPayload({ attachments: [file] })[0]?.file).toBe(file);
  });
});
