import { describe, expect, it } from "vitest";

import { buildCaseActivitySummary, categorizeCaseActivityEvent } from "./caseActivitySummary.js";

describe("caseActivitySummary", () => {
  it("categorizes case activity event types", () => {
    expect(categorizeCaseActivityEvent("case.created")).toBe("created");
    expect(categorizeCaseActivityEvent("case.updated")).toBe("updated");
    expect(categorizeCaseActivityEvent("case.deleted")).toBe("deleted");
  });

  it("aggregates events by day, category, and actor", () => {
    const summary = buildCaseActivitySummary([
      {
        id: "1",
        eventType: "case.created",
        entityId: "10",
        title: "Created",
        body: "Case A",
        actorUserId: "5",
        actorName: "Alex",
        createdAt: "2026-06-01T10:00:00.000Z"
      },
      {
        id: "2",
        eventType: "case.updated",
        entityId: "10",
        title: "Updated",
        body: "Case A",
        actorUserId: "5",
        actorName: "Alex",
        createdAt: "2026-06-01T12:00:00.000Z"
      },
      {
        id: "3",
        eventType: "case.deleted",
        entityId: "11",
        title: "Deleted",
        body: null,
        actorUserId: "6",
        actorName: "Blake",
        createdAt: "2026-06-02T09:00:00.000Z"
      }
    ]);

    expect(summary.totalEvents).toBe(3);
    expect(summary.uniqueCaseCount).toBe(2);
    expect(summary.byDay).toHaveLength(2);
    expect(summary.byCategory.find((row) => row.category === "created")?.count).toBe(1);
    expect(summary.byActor[0]?.count).toBe(2);
    expect(summary.recent[0]?.eventType).toBe("case.deleted");
  });
});
