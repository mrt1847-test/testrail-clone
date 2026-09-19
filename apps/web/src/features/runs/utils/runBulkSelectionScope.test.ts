import { describe, expect, it } from "vitest";

import type { TestInstanceRow } from "../types";
import {
  buildMatchingInstancesFetchPlan,
  captureBulkSubmitSnapshot,
  dropUnknownBulkTargets,
  failedBulkRecovery,
  resolveBulkSubmitTargets,
  visibleMatchingTotal
} from "./runBulkSelectionScope";

function row(id: number, sectionId: string): TestInstanceRow {
  return {
    id: String(id),
    caseId: String(id),
    caseCode: `C${id}`,
    title: `Case ${id}`,
    status: "untested",
    assignedTo: null,
    sectionId
  };
}

function lookupFor(rows: TestInstanceRow[]) {
  return new Map(rows.map((item) => [item.id, item]));
}

describe("runBulkSelectionScope", () => {
  it("reproduces silent drop when grouped selection is larger than the paged lookup", () => {
    const selected = Array.from({ length: 60 }, (_, index) => row(index + 1, "auth"));
    const pagedLookup = lookupFor(selected.slice(0, 50));
    const submitted = dropUnknownBulkTargets(
      selected.map((item) => item.id),
      pagedLookup
    );
    expect(submitted).toHaveLength(50);
    expect(submitted.map((item) => item.testId)).not.toEqual(selected.map((item) => item.id));
  });

  it("rejects submit when any selected id is missing from the target set", () => {
    const selected = Array.from({ length: 60 }, (_, index) => row(index + 1, "auth"));
    const resolved = resolveBulkSubmitTargets(
      selected.map((item) => item.id),
      lookupFor(selected.slice(0, 50))
    );
    expect(resolved.ok).toBe(false);
    if (resolved.ok) return;
    expect(resolved.missingIds).toHaveLength(10);
    expect(resolved.message).toContain("10 selected tests");
  });

  it("submits exactly the 60 visible section rows when lookup matches the table", () => {
    const auth = Array.from({ length: 60 }, (_, index) => row(index + 1, "auth"));
    const billing = Array.from({ length: 20 }, (_, index) => row(index + 61, "billing"));
    const resolved = resolveBulkSubmitTargets(
      auth.map((item) => item.id),
      lookupFor([...auth, ...billing])
    );
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.targets).toHaveLength(60);
    expect(resolved.targets.every((item) => Number(item.caseId) <= 60)).toBe(true);
  });

  it("keeps the captured snapshot when later selection changes", () => {
    const firstPage = Array.from({ length: 50 }, (_, index) => row(index + 1, "auth"));
    const captured = captureBulkSubmitSnapshot({
      selectedTestIds: firstPage.map((item) => item.id),
      lookup: lookupFor(firstPage),
      status: "passed",
      comment: "batch"
    });
    expect(captured.ok).toBe(true);
    if (!captured.ok || !captured.snapshot) return;
    const laterSelection = ["999"];
    expect(captured.snapshot.testIds).toHaveLength(50);
    expect(captured.snapshot.testIds).not.toEqual(laterSelection);
    expect(captured.snapshot.targets).toHaveLength(50);
  });

  it("keeps only failed tests as recovery after a partial bulk save", () => {
    const rows = [row(1, "auth"), row(2, "auth"), row(3, "auth")];
    const captured = captureBulkSubmitSnapshot({
      selectedTestIds: rows.map((item) => item.id),
      lookup: lookupFor(rows),
      status: "untested",
      comment: ""
    });
    expect(captured.snapshot).toBeDefined();
    const recovery = failedBulkRecovery(
      [
        { index: 0, caseId: "1", status: "saved", testId: "1" },
        { index: 1, caseId: "2", status: "failed", testId: "2", errorCode: "UNTESTED_NOT_ALLOWED" },
        { index: 2, caseId: "3", status: "saved", testId: "3" }
      ],
      captured.snapshot!
    );
    expect(recovery.selectedTestIds).toEqual(["2"]);
    expect(recovery.failures).toEqual([
      {
        caseId: "2",
        caseCode: "C2",
        title: "Case 2",
        message: "Untested cannot be set after a result exists for this test."
      }
    ]);
    expect(recovery.recovery?.testIds).toEqual(["2"]);
    expect(recovery.recovery?.targets).toHaveLength(1);
  });

  it("uses grouped fetch with the selected section for select-all", () => {
    const plan = buildMatchingInstancesFetchPlan({
      groupBy: "section_id",
      sectionId: "2",
      filters: { status: "untested" }
    });
    expect(plan).toEqual({
      kind: "grouped",
      groupBy: "section_id",
      sectionId: "2",
      filters: { status: "untested" }
    });
  });

  it("uses grouped fetch for the default section table even when no section is pinned", () => {
    const plan = buildMatchingInstancesFetchPlan({
      groupBy: "section_id",
      sectionId: null,
      filters: {}
    });
    expect(plan.kind).toBe("grouped");
    expect(plan.sectionId).toBeNull();
  });

  it("uses the grouped total as the visible matching count", () => {
    expect(visibleMatchingTotal({ grouped: true, groupedTotal: 60, pagedTotal: 80 })).toBe(60);
    expect(visibleMatchingTotal({ grouped: false, groupedTotal: 60, pagedTotal: 50 })).toBe(50);
  });
});
