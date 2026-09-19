import { describe, expect, it } from "vitest";

import {
  CASE_DISPLAY_MODES,
  fetchSectionIdForQuery,
  parseCaseQueryScope,
  sectionScopeForQuery
} from "./caseRepositoryView";

describe("parseCaseQueryScope", () => {
  it("uses an explicit scope param over display", () => {
    expect(parseCaseQueryScope("direct", "subtree")).toBe("direct");
    expect(parseCaseQueryScope("all", "tree")).toBe("all");
    expect(parseCaseQueryScope("subtree", "compact")).toBe("subtree");
  });

  it("maps a legacy display=tree URL without scope to selected-section-only", () => {
    expect(parseCaseQueryScope(null, "tree")).toBe("direct");
  });

  it("maps a legacy display=subtree or compact URL without scope to all sections", () => {
    expect(parseCaseQueryScope(null, "subtree")).toBe("all");
    expect(parseCaseQueryScope(null, "compact")).toBe("all");
  });

  it("defaults a URL with neither scope nor display to include subsections", () => {
    expect(parseCaseQueryScope(null, null)).toBe("subtree");
  });
});

describe("query membership mapping", () => {
  it("sends the selected section for direct and subtree, and omits it for all sections", () => {
    expect(fetchSectionIdForQuery("direct", 4)).toBe(4);
    expect(fetchSectionIdForQuery("subtree", 4)).toBe(4);
    expect(fetchSectionIdForQuery("all", 4)).toBeNull();
  });

  it("does not let compact or density display change the API section scope", () => {
    expect(sectionScopeForQuery("direct")).toBe("direct");
    expect(sectionScopeForQuery("subtree")).toBe("subtree");
    expect(sectionScopeForQuery("all")).toBe("subtree");
  });
});

describe("legacy display modes", () => {
  it("keeps leftover display modes out of the View menu", () => {
    expect(CASE_DISPLAY_MODES.filter((mode) => mode.inMenu !== false)).toEqual([]);
  });
});
