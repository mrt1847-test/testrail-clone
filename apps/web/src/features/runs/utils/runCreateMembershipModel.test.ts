import { describe, expect, it } from "vitest";

import {
  buildRunCreateMembershipFields,
  buildRunCreateTargetSummary,
  captureChooserSnapshot,
  compositionFromMembership,
  defaultFreshMembershipKind,
  emptyMembershipSelection,
  filterChooserVisibleCaseIds,
  isRunCreateSubmitDisabled,
  membershipKindFromComposition,
  runMembershipOptions,
  selectAllCurrentCaseIds
} from "./runCreateMembershipModel";

describe("runMembershipOptions", () => {
  it("exposes All, Selected, and Dynamic without internal mode names", () => {
    const labels = runMembershipOptions().map((option) => `${option.label} · ${option.description}`);
    expect(labels).toEqual([
      "All cases · Automatically includes new cases",
      "Selected cases · Fixed membership",
      "Dynamic filter · Membership follows criteria"
    ]);
    expect(labels.join(" ")).not.toMatch(/static|includeAll|include all \(live/i);
  });
});

describe("membership mapping", () => {
  it("defaults a fresh create to live all-cases when that contract exists", () => {
    expect(defaultFreshMembershipKind()).toBe("all");
    expect(compositionFromMembership("all")).toEqual({
      compositionMode: "include_all_live",
      includeAll: true
    });
  });

  it("does not relabel static include-all as live All cases", () => {
    expect(membershipKindFromComposition("static", true)).toBe("selected");
    expect(compositionFromMembership("selected")).toEqual({
      compositionMode: "static",
      includeAll: false
    });
  });

  it("maps dynamic to the live filter contract", () => {
    expect(compositionFromMembership("dynamic")).toEqual({
      compositionMode: "dynamic_filter",
      includeAll: false
    });
    expect(membershipKindFromComposition("dynamic_filter", false)).toBe("dynamic");
  });
});

describe("buildRunCreateMembershipFields", () => {
  it("submits live all-cases without a case id list", () => {
    expect(
      buildRunCreateMembershipFields({
        kind: "all",
        selectedCaseIds: ["9"],
        excludedCaseIds: ["3"],
        includedSectionIds: ["1"],
        excludedSectionIds: ["2"],
        filterPriority: "high",
        filterState: "active"
      })
    ).toEqual({
      includeAll: true,
      compositionMode: "include_all_live",
      caseIds: undefined,
      excludedCaseIds: ["3"],
      includedSectionIds: ["1"],
      excludedSectionIds: ["2"],
      filterDefinition: undefined
    });
  });

  it("submits selected cases as a fixed static membership", () => {
    expect(
      buildRunCreateMembershipFields({
        kind: "selected",
        selectedCaseIds: ["101", "102"],
        excludedCaseIds: ["3"],
        includedSectionIds: [],
        excludedSectionIds: ["2"],
        filterPriority: "high",
        filterState: "active"
      })
    ).toEqual({
      includeAll: false,
      compositionMode: "static",
      caseIds: ["101", "102"],
      excludedCaseIds: undefined,
      includedSectionIds: undefined,
      excludedSectionIds: undefined,
      filterDefinition: undefined
    });
  });

  it("keeps Select all current cases as a fixed id list", () => {
    const ids = selectAllCurrentCaseIds(["1", "2", "3"]);
    const payload = buildRunCreateMembershipFields({
      kind: "selected",
      selectedCaseIds: ids,
      excludedCaseIds: [],
      includedSectionIds: [],
      excludedSectionIds: [],
      filterPriority: "",
      filterState: "active"
    });
    expect(payload.compositionMode).toBe("static");
    expect(payload.includeAll).toBe(false);
    expect(payload.caseIds).toEqual(["1", "2", "3"]);
  });

  it("submits dynamic criteria without case ids", () => {
    expect(
      buildRunCreateMembershipFields({
        kind: "dynamic",
        selectedCaseIds: ["101"],
        excludedCaseIds: ["3"],
        includedSectionIds: ["8"],
        excludedSectionIds: ["2"],
        filterPriority: "high",
        filterState: "active"
      })
    ).toEqual({
      includeAll: false,
      compositionMode: "dynamic_filter",
      caseIds: undefined,
      excludedCaseIds: undefined,
      includedSectionIds: undefined,
      excludedSectionIds: undefined,
      filterDefinition: { priority: "high", state: "active", includedSectionIds: ["8"] }
    });
  });
});

describe("chooser snapshot", () => {
  it("keeps a copy so cancel can restore the captured selection", () => {
    const live = {
      selectedCaseIds: ["1"],
      excludedCaseIds: ["2"],
      includedSectionIds: ["3"],
      excludedSectionIds: ["4"],
      selectedSectionId: 5
    };
    const snapshot = captureChooserSnapshot(live);
    live.selectedCaseIds.push("99");
    expect(snapshot.selectedCaseIds).toEqual(["1"]);
    expect(snapshot).toEqual({
      selectedCaseIds: ["1"],
      excludedCaseIds: ["2"],
      includedSectionIds: ["3"],
      excludedSectionIds: ["4"],
      selectedSectionId: 5
    });
  });

  it("clears membership when the suite changes", () => {
    expect(emptyMembershipSelection()).toEqual({
      selectedCaseIds: [],
      excludedCaseIds: [],
      includedSectionIds: [],
      excludedSectionIds: [],
      selectedSectionId: null
    });
  });
});

describe("chooser query and summary", () => {
  it("filters visible cases by title without changing membership", () => {
    const visible = filterChooserVisibleCaseIds(
      [
        { id: "1", title: "Add product to cart" },
        { id: "2", title: "Checkout returns 200" }
      ],
      new Set(["1", "2"]),
      "checkout"
    );
    expect([...visible]).toEqual(["2"]);
  });

  it("explains live all, fixed selected, and dynamic membership", () => {
    expect(
      buildRunCreateTargetSummary({
        kind: "all",
        suiteName: "Master",
        caseCount: 12,
        selectedCount: 0,
        excludedCount: 1,
        includedSectionCount: 0,
        matchingCount: 12,
        filterPriority: "",
        filterState: "active"
      })
    ).toBe("All cases in Master · 12 tests · 1 excluded. New cases in this suite are included automatically.");

    expect(
      buildRunCreateTargetSummary({
        kind: "selected",
        suiteName: "Master",
        caseCount: 12,
        selectedCount: 3,
        excludedCount: 0,
        includedSectionCount: 0,
        matchingCount: 0,
        filterPriority: "",
        filterState: "active"
      })
    ).toBe("Selected cases · 3 tests. Membership stays fixed.");

    expect(
      buildRunCreateTargetSummary({
        kind: "dynamic",
        suiteName: "Master",
        caseCount: 12,
        selectedCount: 0,
        excludedCount: 0,
        includedSectionCount: 1,
        matchingCount: 4,
        filterPriority: "high",
        filterState: "active"
      })
    ).toBe("Dynamic filter · high · active · 4 matching. Membership follows these criteria.");
  });

  it("blocks create until a selected run has at least one case", () => {
    expect(
      isRunCreateSubmitDisabled({
        name: "Nightly",
        suiteId: "1",
        kind: "selected",
        selectedCaseIds: [],
        isPending: false
      })
    ).toBe(true);
    expect(
      isRunCreateSubmitDisabled({
        name: "Nightly",
        suiteId: "1",
        kind: "all",
        selectedCaseIds: [],
        isPending: false
      })
    ).toBe(false);
  });
});
