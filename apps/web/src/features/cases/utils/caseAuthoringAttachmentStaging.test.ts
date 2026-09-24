import { describe, expect, it } from "vitest";

import {
  CASE_AUTHORING_ATTACHMENT_MAX_FILES,
  attachmentUploadPlan,
  caseAuthoringAttachmentFailureMessage,
  pendingStagedCaseAttachments,
  shouldUploadStagedCaseAttachments,
  stageCaseAuthoringAttachments,
  validateCaseAuthoringAttachmentFile
} from "./caseAuthoringAttachmentStaging";

function imageFile(name: string, size = 12): File {
  return new File([new Uint8Array(size)], name, { type: "image/png" });
}

describe("caseAuthoringAttachmentStaging (CA-U03 / UI-071)", () => {
  it("rejects non-images and caps staged files at two before any server call", () => {
    expect(validateCaseAuthoringAttachmentFile(new File(["x"], "notes.txt", { type: "text/plain" }))).toMatch(
      /image/i
    );
    const first = stageCaseAuthoringAttachments([], [imageFile("a.png"), imageFile("b.png")]);
    expect(first.next).toHaveLength(CASE_AUTHORING_ATTACHMENT_MAX_FILES);
    const third = stageCaseAuthoringAttachments(first.next, [imageFile("c.png")]);
    expect(third.next).toHaveLength(2);
    expect(third.rejected[0]).toMatch(/up to 2/i);
  });

  it("uploads only after body+steps succeeded for a real caseId", () => {
    expect(
      shouldUploadStagedCaseAttachments({
        caseId: null,
        bodySaved: false,
        stepsComplete: false,
        pendingCount: 2
      })
    ).toBe(false);
    expect(
      shouldUploadStagedCaseAttachments({
        caseId: 9,
        bodySaved: true,
        stepsComplete: true,
        pendingCount: 2
      })
    ).toBe(true);
    expect(
      shouldUploadStagedCaseAttachments({
        caseId: 9,
        bodySaved: true,
        stepsComplete: false,
        pendingCount: 2
      })
    ).toBe(false);
  });

  it("retries only queued/failed files and keeps successful uploads", () => {
    const staged = [
      { id: "1", file: imageFile("ok.png"), status: "uploaded" as const },
      { id: "2", file: imageFile("bad.png"), status: "failed" as const, message: "network" }
    ];
    const plan = attachmentUploadPlan(staged);
    expect(plan.alreadyUploaded.map((row) => row.id)).toEqual(["1"]);
    expect(plan.toUpload.map((row) => row.id)).toEqual(["2"]);
    expect(pendingStagedCaseAttachments(staged)).toHaveLength(1);
    expect(caseAuthoringAttachmentFailureMessage({ caseCode: "C12", failedNames: ["bad.png"] })).toMatch(
      /C12 was saved.*bad\.png/i
    );
  });
});
