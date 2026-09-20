import { describe, expect, it } from "vitest";

import { mergeCaseRefs, parseCaseRefs } from "./caseRefs";

describe("caseRefs", () => {
  it("parses comma/semicolon/newline separated refs", () => {
    expect(parseCaseRefs("JIRA-UI021, REQ-2;REQ-2\nREQ-3")).toEqual(["JIRA-UI021", "REQ-2", "REQ-3"]);
    expect(parseCaseRefs("  ")).toEqual([]);
  });

  it("merges committed tokens with still-typed draft text", () => {
    expect(mergeCaseRefs("", "JIRA-UI021")).toBe("JIRA-UI021");
    expect(mergeCaseRefs("REQ-1", "JIRA-UI021")).toBe("REQ-1, JIRA-UI021");
    expect(mergeCaseRefs("JIRA-UI021", "JIRA-UI021")).toBe("JIRA-UI021");
    expect(mergeCaseRefs("REQ-1", "  ")).toBe("REQ-1");
  });
});
