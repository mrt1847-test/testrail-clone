import { describe, expect, it } from "vitest";

import {
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

  it("advances Pass & Next through five consecutive tests", () => {
    const ids = ["1", "2", "3", "4", "5"];
    const instances = ids.map(row);
    const path = [ids[0]];
    let current = ids[0]!;
    for (let i = 0; i < 4; i += 1) {
      current = nextVisibleTestId(current, instances)!;
      path.push(current);
    }
    expect(path).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("does not wrap Save & Next past the last visible test", () => {
    const instances = ["1", "2"].map(row);
    expect(nextUnwrappedVisibleTestId("1", instances)).toBe("2");
    expect(nextUnwrappedVisibleTestId("2", instances)).toBeNull();
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
