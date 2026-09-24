import { describe, expect, it } from "vitest";

import {
  applyCasePreviewSearchParams,
  buildAddCasePath,
  buildCaseListPath,
  buildCaseRepositoryPath,
  buildEditCasePath
} from "./caseRoute";
import { CASE_LIST_RETURN_PARAM, captureCaseListReturnQuery } from "./utils/caseListReturnContext";

describe("buildCaseListPath", () => {
  it("builds list path with section and case", () => {
    expect(buildCaseListPath("p1", { sectionId: 3, panelCaseId: 12, panelMode: "edit" })).toBe(
      "/projects/p1/cases?sectionId=3&panelCaseId=12&panelMode=edit"
    );
  });

  it("supports legacy section-only argument", () => {
    expect(buildCaseListPath("p1", 7)).toBe("/projects/p1/cases?sectionId=7");
  });
});

describe("buildCaseRepositoryPath", () => {
  it("serializes full repository query state", () => {
    const params = new URLSearchParams("q=login&focusCaseId=5&panelCaseId=5");
    expect(buildCaseRepositoryPath("p1", params)).toBe("/projects/p1/cases?q=login&focusCaseId=5&panelCaseId=5");
  });
});

describe("buildAddCasePath", () => {
  it("builds the dedicated add-case page with suite and section", () => {
    expect(buildAddCasePath("p1", { suiteId: "9", sectionId: 4 })).toBe(
      "/projects/p1/cases/new?suiteId=9&sectionId=4"
    );
  });

  it("carries allowlisted list context so save/cancel can restore filters", () => {
    const href = buildAddCasePath("p1", {
      suiteId: "9",
      sectionId: 4,
      listParams: new URLSearchParams("suiteId=9&sectionId=4&q=login&priority=high&scope=subtree")
    });
    expect(href.startsWith("/projects/p1/cases/new?")).toBe(true);
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("suiteId")).toBe("9");
    expect(params.get("sectionId")).toBe("4");
    const returned = captureCaseListReturnQuery(
      new URLSearchParams(params.get(CASE_LIST_RETURN_PARAM) ?? "")
    );
    expect(returned).toContain("q=login");
    expect(returned).toContain("priority=high");
    expect(returned).toContain("scope=subtree");
  });
});

describe("buildEditCasePath", () => {
  it("builds the dedicated edit-case page with suite and section", () => {
    expect(buildEditCasePath("p1", 12, { suiteId: "9", sectionId: 4 })).toBe(
      "/projects/p1/cases/12/edit?suiteId=9&sectionId=4"
    );
  });

  it("keeps a return-to-page hint when editing from the full case page", () => {
    expect(buildEditCasePath("p1", 12, { from: "page" })).toBe("/projects/p1/cases/12/edit?from=page");
  });
});

describe("applyCasePreviewSearchParams", () => {
  it("opens the side preview without dropping the section or clearing other list params", () => {
    const params = applyCasePreviewSearchParams(
      new URLSearchParams("sectionId=1&suiteId=1&q=login"),
      44,
      { sectionId: 1 }
    );
    expect(params.get("panelCaseId")).toBe("44");
    expect(params.get("focusCaseId")).toBe("44");
    expect(params.get("sectionId")).toBe("1");
    expect(params.get("q")).toBe("login");
    expect(params.get("panelMode")).toBeNull();
  });
});
