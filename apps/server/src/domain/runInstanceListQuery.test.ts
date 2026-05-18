import { describe, expect, it } from "vitest";

import { sortRunInstances } from "./runInstanceListQuery.js";
import type { TestInstance } from "../modules/runs/runs.types.js";

function inst(id: bigint, title: string): TestInstance {
  return {
    id,
    runId: 1n,
    caseId: id,
    status: "untested",
    assignedTo: null,
    titleSnapshot: title,
    prioritySnapshot: "medium",
    typeSnapshot: "functional",
    estimateSnapshot: null,
    automationKeySnapshot: null,
    externalIdSnapshot: null
  };
}

describe("sortRunInstances", () => {
  it("sorts by title ascending", () => {
    const sorted = sortRunInstances([inst(3n, "Zebra"), inst(1n, "Alpha")], "title", "asc");
    expect(sorted.map((row) => row.titleSnapshot)).toEqual(["Alpha", "Zebra"]);
  });
});
