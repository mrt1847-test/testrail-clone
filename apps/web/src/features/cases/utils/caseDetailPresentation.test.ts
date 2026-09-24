import { describe, expect, it } from "vitest";

import {
  CASE_READ_PRIMARY_ORDER,
  caseAttachmentPlacement,
  caseEditFieldBands,
  countLabelOccurrences,
  hasDuplicateCaseReadLabels,
  shouldStackAuthoringFields
} from "./caseDetailPresentation";

describe("caseDetailPresentation (CA-U02 / UI-070)", () => {
  it("rejects duplicate Type/Priority/Template/Preconditions in the read panel", () => {
    const duplicated = [
      "Type",
      "Priority",
      "Template",
      "Preconditions",
      "Type",
      "Priority",
      "Template",
      "Preconditions",
      "Steps"
    ];
    expect(hasDuplicateCaseReadLabels(duplicated)).toBe(true);
    expect(countLabelOccurrences(duplicated, "Preconditions")).toBe(2);

    const once = ["Type", "Priority", "Template", "Preconditions", "Steps", "Expected"];
    expect(hasDuplicateCaseReadLabels(once)).toBe(false);
  });

  it("puts quiet meta before instructions, with attachments after the body", () => {
    expect([...CASE_READ_PRIMARY_ORDER]).toEqual([
      "heading",
      "meta",
      "instructions",
      "attachments",
      "versions",
      "actions"
    ]);
    expect(caseAttachmentPlacement()).toBe("after-instructions");
  });

  it("stacks panel fields and keeps instructions ahead of optional meta", () => {
    expect(shouldStackAuthoringFields("embedded")).toBe(true);
    expect(shouldStackAuthoringFields("page")).toBe(false);
    expect(caseEditFieldBands({ stackFields: true })).toEqual([
      "title",
      "destination",
      "instructions",
      "optional-meta"
    ]);
    expect(caseEditFieldBands({ stackFields: false })).toEqual([
      "title",
      "destination",
      "optional-meta",
      "instructions"
    ]);
  });
});
