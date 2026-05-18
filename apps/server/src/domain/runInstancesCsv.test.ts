import { describe, expect, it } from "vitest";

import { buildRunInstancesCsv } from "./runInstancesCsv.js";

describe("buildRunInstancesCsv", () => {
  it("escapes titles with commas", () => {
    const csv = buildRunInstancesCsv([
      {
        id: 1n,
        runId: 2n,
        caseId: 3n,
        status: "failed",
        titleSnapshot: 'Say "hello", world',
        prioritySnapshot: "high",
        typeSnapshot: "functional",
        assignedTo: null,
        caseChanged: true
      } as import("../modules/runs/runs.types.js").TestInstance
    ]);
    expect(csv).toContain('"Say ""hello"", world"');
    expect(csv.split("\n")).toHaveLength(2);
  });
});
