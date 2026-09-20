import { describe, expect, it } from "vitest";

import {
  CLEAR_SELECTED_TEST_PENDING,
  isEvidenceRequiringStatus,
  nextVisibleTestId,
  nextUnwrappedVisibleTestId,
  resolveSelectedRunTest,
  resolveVisibleSelectedRunTest
} from "./runSelectedTestState";
import type { TestInstanceRow } from "../types";

function row(id: string): TestInstanceRow {
  return {
    id,
    caseId: id,
    caseCode: `C${id}`,
    title: `Case ${id}`,
    status: "untested",
    assignedTo: null
  };
}

describe("runSelectedTestState", () => {
  it("treats failed, blocked, and retest as evidence-requiring", () => {
    expect(isEvidenceRequiringStatus("failed")).toBe(true);
    expect(isEvidenceRequiringStatus("blocked")).toBe(true);
    expect(isEvidenceRequiringStatus("retest")).toBe(true);
    expect(isEvidenceRequiringStatus("passed")).toBe(false);
    expect(isEvidenceRequiringStatus("untested")).toBe(false);
  });

  it("advances Pass & Next through five consecutive tests without wrapping", () => {
    const ids = ["1", "2", "3", "4", "5"];
    const instances = ids.map(row);
    const path = [ids[0]];
    let current = ids[0]!;
    for (let i = 0; i < 4; i += 1) {
      current = nextUnwrappedVisibleTestId(current, instances)!;
      path.push(current);
    }
    expect(path).toEqual(["1", "2", "3", "4", "5"]);
    expect(nextUnwrappedVisibleTestId("5", instances)).toBeNull();
  });

  it("does not wrap Save & Next past the last visible test", () => {
    const instances = ["1", "2"].map(row);
    expect(nextUnwrappedVisibleTestId("1", instances)).toBe("2");
    expect(nextUnwrappedVisibleTestId("2", instances)).toBeNull();
  });

  it("keeps wrapping helper available for Prev/Next navigation only", () => {
    const instances = ["1", "2"].map(row);
    expect(nextVisibleTestId("2", instances)).toBe("1");
  });

  it("uses the URL test id as the selected test", () => {
    const instances = ["1", "2", "3"].map(row);
    expect(resolveSelectedRunTest("2", instances)).toEqual({
      selected: instances[1],
      seedUrlTestId: null
    });
  });

  it("seeds the first visible test when the URL has no test id", () => {
    const instances = ["1", "2"].map(row);
    expect(resolveSelectedRunTest(null, instances)).toEqual({
      selected: instances[0],
      seedUrlTestId: "1"
    });
  });

  it("keeps the mobile list empty when URL has no test id and seeding is disabled", () => {
    const instances = ["4", "1", "3"].map(row);
    expect(resolveSelectedRunTest(null, instances, { seedWhenMissing: false })).toEqual({
      selected: null,
      seedUrlTestId: null
    });
  });

  it("still opens an explicit testId when mobile seeding is disabled", () => {
    const instances = ["4", "1", "3"].map(row);
    expect(resolveSelectedRunTest("4", instances, { seedWhenMissing: false })).toEqual({
      selected: instances[0],
      seedUrlTestId: null
    });
  });

  it("does not bounce Back to tests back onto a stale URL selection", () => {
    const instances = ["4", "1", "3"].map(row);
    // URL has not dropped testId yet after clearSelectedTest.
    expect(
      resolveVisibleSelectedRunTest({
        urlTestId: "4",
        instances,
        pendingTestId: CLEAR_SELECTED_TEST_PENDING,
        current: null,
        seedWhenMissing: false
      })
    ).toEqual({ selected: null, seedUrlTestId: null });

    // After URL catches up, still no auto-seed on stacked mobile.
    expect(
      resolveVisibleSelectedRunTest({
        urlTestId: null,
        instances,
        pendingTestId: null,
        current: null,
        seedWhenMissing: false
      })
    ).toEqual({ selected: null, seedUrlTestId: null });
  });

  it("keeps a pending selection while the URL still has the previous test", () => {
    const instances = ["1", "2", "3"].map(row);
    expect(
      resolveVisibleSelectedRunTest({
        urlTestId: "1",
        instances,
        pendingTestId: "2",
        current: instances[1]
      })
    ).toEqual({
      selected: instances[1],
      seedUrlTestId: null
    });
  });

  it("follows browser navigation once no write is pending", () => {
    const instances = ["1", "2", "3"].map(row);
    expect(
      resolveVisibleSelectedRunTest({
        urlTestId: "1",
        instances,
        pendingTestId: null,
        current: instances[1]
      })
    ).toEqual({
      selected: instances[0],
      seedUrlTestId: null
    });
  });
});
