import { describe, expect, it } from "vitest";

import {
  CASE_LIST_RETURN_PARAM,
  buildCaseListPathFromReturn,
  captureCaseListReturnQuery,
  isCaseLikelyHiddenByListReturn,
  parseCaseListReturnQuery,
  withCaseListReturnParam
} from "./caseListReturnContext";

describe("caseListReturnContext (CA-U04 / UI-072)", () => {
  it("captures allowlisted list context and drops panel/transient keys", () => {
    const list = new URLSearchParams(
      "suiteId=9&sectionId=4&q=login&priority=high&scope=subtree&groupBy=priority&columns=type%2Cpriority&panelCaseId=99&focusCaseId=99&panelMode=edit"
    );
    const captured = captureCaseListReturnQuery(list);
    expect(captured).toContain("suiteId=9");
    expect(captured).toContain("q=login");
    expect(captured).toContain("priority=high");
    expect(captured).toContain("groupBy=priority");
    expect(captured).not.toContain("panelCaseId");
    expect(captured).not.toContain("focusCaseId");
    expect(captured).not.toContain("panelMode");
  });

  it("rejects non-allowlisted keys from a forged return payload", () => {
    const parsed = parseCaseListReturnQuery(
      "suiteId=1&q=auth&redirect=https://evil.example/phish&panelCaseId=1"
    );
    expect(parsed.get("suiteId")).toBe("1");
    expect(parsed.get("q")).toBe("auth");
    expect(parsed.get("redirect")).toBeNull();
    expect(parsed.get("panelCaseId")).toBeNull();
  });

  it("restores list context instead of suite/section/case only", () => {
    const returnQuery = captureCaseListReturnQuery(
      new URLSearchParams("suiteId=2&sectionId=8&q=checkout&priority=low&display=compact")
    );
    // Broken goToList shape (suite/section/case only) would drop q/priority/display.
    const stripped = "/projects/p1/cases?suiteId=2&sectionId=8&panelCaseId=15&focusCaseId=15";
    expect(stripped).not.toContain("q=checkout");

    const restored = buildCaseListPathFromReturn({
      projectId: "p1",
      returnQuery,
      panelCaseId: 15
    });
    expect(restored).toContain("suiteId=2");
    expect(restored).toContain("sectionId=8");
    expect(restored).toContain("q=checkout");
    expect(restored).toContain("priority=low");
    expect(restored).toContain("display=compact");
    expect(restored).toContain("panelCaseId=15");
    expect(restored).toContain("focusCaseId=15");
  });

  it("falls back to suite/section when return context is missing", () => {
    expect(
      buildCaseListPathFromReturn({
        projectId: "p1",
        returnQuery: null,
        fallback: { suiteId: "3", sectionId: 7 }
      })
    ).toBe("/projects/p1/cases?suiteId=3&sectionId=7");
  });

  it("attaches return context to authoring entry params", () => {
    const authoring = withCaseListReturnParam(
      new URLSearchParams("suiteId=9&sectionId=4"),
      new URLSearchParams("suiteId=9&sectionId=4&q=login&priority=high")
    );
    expect(authoring.get(CASE_LIST_RETURN_PARAM)).toContain("q=login");
    expect(authoring.get("suiteId")).toBe("9");
  });

  it("preserves an existing return payload when leaving a detail/edit URL", () => {
    const authoring = withCaseListReturnParam(
      new URLSearchParams("suiteId=9&sectionId=4&from=page"),
      new URLSearchParams("sectionId=4&return=suiteId%3D9%26q%3Dlogin%26priority%3Dhigh")
    );
    expect(authoring.get(CASE_LIST_RETURN_PARAM)).toBe("suiteId=9&q=login&priority=high");
  });

  it("detects when saved case would stay outside active filters", () => {
    const returnQuery = "q=login&priority=high";
    expect(
      isCaseLikelyHiddenByListReturn({
        returnQuery,
        title: "Checkout total",
        priority: "Low",
        type: "Functional"
      })
    ).toBe(true);
    expect(
      isCaseLikelyHiddenByListReturn({
        returnQuery,
        title: "Valid login",
        priority: "High",
        type: "Functional"
      })
    ).toBe(false);
  });
});
