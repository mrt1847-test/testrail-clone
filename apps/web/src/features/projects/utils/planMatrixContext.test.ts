import { describe, expect, it } from "vitest";

import { planMatrixSavePayload, resolvePlanMatrixOwner } from "./planMatrixContext";

const entries = [
  { id: "e1", name: "Chrome smoke" },
  { id: "e2", name: "Firefox smoke" }
];

describe("resolvePlanMatrixOwner", () => {
  it("hides configuration controls until exactly one existing entry is selected", () => {
    expect(resolvePlanMatrixOwner(entries, [])).toBeNull();
    expect(resolvePlanMatrixOwner(entries, ["e1", "e2"])).toBeNull();
    expect(resolvePlanMatrixOwner(entries, ["missing"])).toBeNull();
    expect(resolvePlanMatrixOwner(entries, ["e2"])).toEqual(entries[1]);
  });
});

describe("planMatrixSavePayload", () => {
  it("refuses to save while the loaded mapping belongs to a different entry", () => {
    expect(planMatrixSavePayload("e2", "e1", ["c1"])).toBeNull();
    expect(planMatrixSavePayload("e2", null, ["c1"])).toBeNull();
    expect(planMatrixSavePayload("e2", "e2", ["c1", "c2"])).toEqual({
      entryId: "e2",
      configurationIds: ["c1", "c2"]
    });
  });
});
