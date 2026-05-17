import { describe, expect, it } from "vitest";

import { formatCaseIdList, parseCaseIdList } from "./planCaseSelection";

describe("planCaseSelection", () => {
  it("parses and formats comma-separated case ids", () => {
    expect(parseCaseIdList("1, 2\n3")).toEqual(["1", "2", "3"]);
    expect(formatCaseIdList(["9", "10"])).toBe("9, 10");
  });
});
