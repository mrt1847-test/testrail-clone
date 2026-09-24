import { describe, expect, it } from "vitest";

import {
  formatCaseQueryCountAnnouncement,
  formatCaseQueryCountLabel
} from "../components/CaseQueryScopeControl";

describe("case query count labels", () => {
  it("avoids announcing a zero placeholder while updating", () => {
    expect(formatCaseQueryCountLabel(null)).toBe("Updating…");
    expect(formatCaseQueryCountAnnouncement("Authentication", "subtree", null)).toBe(
      "Updating case count"
    );
  });

  it("announces settled scope membership", () => {
    expect(formatCaseQueryCountLabel(0)).toBe("0 cases");
    expect(formatCaseQueryCountLabel(1)).toBe("1 case");
    expect(formatCaseQueryCountAnnouncement("Authentication", "direct", 0)).toBe(
      "Authentication · Selected section only · 0 cases"
    );
    expect(formatCaseQueryCountAnnouncement("Authentication", "subtree", 1)).toBe(
      "Authentication · Include subsections · 1 case"
    );
    expect(formatCaseQueryCountAnnouncement("Authentication", "all", 3)).toBe(
      "All sections · 3 cases"
    );
  });
});
