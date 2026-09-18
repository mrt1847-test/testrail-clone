import { describe, expect, it } from "vitest";

import { serializeCaseAuthoringDraft } from "./caseAuthoringDraft";

const baseDraft = {
  title: "Login works",
  preconditions: "A registered user",
  estimate: "5m",
  references: "REQ-1",
  expectedResult: "Dashboard opens",
  templateId: "template-1",
  customValues: { priority: "high", automated: false }
};

describe("serializeCaseAuthoringDraft", () => {
  it("is stable when custom values have a different insertion order", () => {
    expect(serializeCaseAuthoringDraft(baseDraft)).toBe(
      serializeCaseAuthoringDraft({
        ...baseDraft,
        customValues: { automated: false, priority: "high" }
      })
    );
  });

  it("changes when an editable value changes", () => {
    expect(serializeCaseAuthoringDraft(baseDraft)).not.toBe(
      serializeCaseAuthoringDraft({ ...baseDraft, title: "Login fails" })
    );
  });
});
