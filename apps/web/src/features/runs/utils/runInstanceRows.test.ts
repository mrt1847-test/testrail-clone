import { describe, expect, it } from "vitest";

import { mapApiInstancesToRows, mergeInstanceLookup } from "./runInstanceRows";

describe("runInstanceRows", () => {
  it("maps API instances to table rows", () => {
    expect(
      mapApiInstancesToRows([
        {
          id: "10",
          caseId: "5",
          titleSnapshot: "Login",
          status: "passed",
          assignedTo: "2"
        }
      ])
    ).toEqual([
      {
        id: "10",
        caseId: "5",
        caseCode: "C5",
        title: "Login",
        status: "passed",
        assignedTo: "2",
        caseChanged: undefined,
        changedFields: undefined
      }
    ]);
  });

  it("merges rows into a lookup map", () => {
    const row = {
      id: "1",
      caseId: "1",
      caseCode: "C1",
      title: "A",
      status: "untested",
      assignedTo: null
    };
    const merged = mergeInstanceLookup(new Map(), [row]);
    expect(merged.get("1")).toEqual(row);
  });
});
