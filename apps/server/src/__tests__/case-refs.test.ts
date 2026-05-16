import { describe, expect, it } from "vitest";

import {
  caseRefsFromCsvCell,
  formatCaseRefsForCsv,
  normalizeCaseRefsInput,
  parseCaseRefs
} from "../domain/caseRefs.js";

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

  it("formats CSV refs cells and parses import cells", () => {
    expect(formatCaseRefsForCsv(null)).toBe("");
    expect(formatCaseRefsForCsv("  REQ-1  ")).toBe("REQ-1");
    expect(caseRefsFromCsvCell("")).toBeNull();
    expect(caseRefsFromCsvCell(undefined)).toBeUndefined();
    expect(caseRefsFromCsvCell("REQ-2")).toBe("REQ-2");
  });
});
