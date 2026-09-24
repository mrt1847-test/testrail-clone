import { describe, expect, it } from "vitest";

import { caseAuthoringValueKey } from "./caseAuthoringValueKey";

describe("caseAuthoringValueKey", () => {
  it("keeps add identity stable across section destination changes", () => {
    expect(caseAuthoringValueKey({ mode: "add", formKey: 0 })).toBe("add:0");
    expect(caseAuthoringValueKey({ mode: "add", formKey: 0 })).toBe(
      caseAuthoringValueKey({ mode: "add", formKey: 0 })
    );
  });

  it("resets add drafts only when formKey advances after Add & Next", () => {
    expect(caseAuthoringValueKey({ mode: "add", formKey: 0 })).not.toBe(
      caseAuthoringValueKey({ mode: "add", formKey: 1 })
    );
  });

  it("keys edit drafts by case identity and lock version, not section", () => {
    expect(caseAuthoringValueKey({ mode: "edit", formKey: 0, caseId: 12, lockVersion: 3 })).toBe(
      "edit:12:3"
    );
  });
});
