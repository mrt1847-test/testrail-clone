import { describe, expect, it } from "vitest";

import {
  assertCaseRefsValid,
  caseRefsFromCsvCell,
  formatCaseRefsForCsv,
  normalizeCaseRefsInput,
  parseCaseRefs,
  prepareCaseRefsInput
} from "../domain/caseRefs.js";
import { resolveReferenceUrl } from "../domain/referenceUrls.js";

describe("caseRefs", () => {
  it("parses comma, semicolon, and newline separated refs", () => {
    expect(parseCaseRefs("REQ-1, REQ-2;REQ-3\nREQ-4")).toEqual(["REQ-1", "REQ-2", "REQ-3", "REQ-4"]);
  });

  it("dedupes tokens and ignores blanks", () => {
    expect(parseCaseRefs("REQ-1, REQ-1 ,  ,REQ-2")).toEqual(["REQ-1", "REQ-2"]);
  });

  it("normalizes empty refs to null", () => {
    expect(normalizeCaseRefsInput("   ")).toBeNull();
    expect(normalizeCaseRefsInput("REQ-1")).toBe("REQ-1");
  });

  it("normalizes refs to deduped comma-separated tokens", () => {
    expect(normalizeCaseRefsInput("REQ-2, REQ-1;REQ-2")).toBe("REQ-2, REQ-1");
    expect(prepareCaseRefsInput("REQ-1")).toBe("REQ-1");
  });

  it("resolves external reference URLs from integration template", () => {
    const url = resolveReferenceUrl("QA-9", {
      isEnabled: true,
      issueUrlTemplate: "https://jira.example/browse/{key}",
      defaultProjectKey: "QA"
    });
    expect(url).toBe("https://jira.example/browse/QA-9");
    expect(
      resolveReferenceUrl("QA-9", {
        isEnabled: false,
        issueUrlTemplate: "https://jira.example/browse/{key}",
        defaultProjectKey: null
      })
    ).toBeNull();
  });

  it("validates refs length and token count", () => {
    expect(() => assertCaseRefsValid("x".repeat(5000))).toThrow("CASE_REFS_TOO_LONG");
  });

  it("formats CSV refs cells and parses import cells", () => {
    expect(formatCaseRefsForCsv(null)).toBe("");
    expect(formatCaseRefsForCsv("  REQ-1  ")).toBe("REQ-1");
    expect(caseRefsFromCsvCell("")).toBeNull();
    expect(caseRefsFromCsvCell(undefined)).toBeUndefined();
    expect(caseRefsFromCsvCell("REQ-2")).toBe("REQ-2");
  });
});
