import { describe, expect, it } from "vitest";

import {
  parseStoredCaseIds,
  resolvePlanEntryRunComposition,
  serializeCaseIds
} from "./planEntrySemantics.js";

describe("planEntrySemantics", () => {
  it("resolves static include list composition", () => {
    expect(
      resolvePlanEntryRunComposition({
        includeAll: false,
        includeCaseIds: [1n, 2n],
        excludeCaseIds: [3n]
      })
    ).toEqual({
      includeAll: false,
      caseIds: [1n, 2n],
      excludedCaseIds: [3n]
    });
  });

  it("parses stored case ids from json arrays", () => {
    expect(parseStoredCaseIds(["1", "2", "2"])).toEqual([1n, 2n]);
    expect(serializeCaseIds([5n, 6n])).toEqual(["5", "6"]);
  });
});
