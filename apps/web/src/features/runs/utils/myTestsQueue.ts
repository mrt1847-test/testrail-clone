import type { AssignedTestRow } from "../api/runApi";

const attentionStatuses = new Set(["failed", "blocked", "retest"]);

export type MyTestsQueueGroup = {
  id: string;
  label: string;
  description: string;
  rows: AssignedTestRow[];
};

export type QueuedAssignedTest = AssignedTestRow & { queueId: string; queueLabel: string };

export function buildMyTestsQueueGroups(rows: AssignedTestRow[]): MyTestsQueueGroup[] {
  const assigned = new Set<string>();
  const take = (predicate: (row: AssignedTestRow) => boolean) => {
    const groupRows = rows.filter((row) => !assigned.has(row.testId) && predicate(row));
    for (const row of groupRows) assigned.add(row.testId);
    return groupRows;
  };

  return [
    {
      id: "overdue",
      label: "Overdue",
      description: "Runs past due date.",
      rows: take((row) => row.agingLevel === "overdue")
    },
    {
      id: "due-soon",
      label: "Due soon",
      description: "Runs due in the next few days.",
      rows: take((row) => row.agingLevel === "due_soon")
    },
    {
      id: "attention",
      label: "Failed, blocked, or retest",
      description: "Work that likely needs follow-up before completion.",
      rows: take((row) => attentionStatuses.has(row.status))
    },
    {
      id: "untested",
      label: "Untested",
      description: "Ready for first execution.",
      rows: take((row) => row.status === "untested")
    },
    {
      id: "other",
      label: "Other assignments",
      description: "Completed or lower-priority assigned work.",
      rows: take(() => true)
    }
  ].filter((group) => group.rows.length > 0);
}

export function flattenMyTestsQueue(rows: AssignedTestRow[]): QueuedAssignedTest[] {
  return buildMyTestsQueueGroups(rows).flatMap((group) =>
    group.rows.map((row) => ({ ...row, queueId: group.id, queueLabel: group.label }))
  );
}

export function myTestsResultPath(projectId: string, row: Pick<AssignedTestRow, "runId" | "testId">) {
  return `/projects/${projectId}/runs/${row.runId}?testId=${encodeURIComponent(row.testId)}`;
}
