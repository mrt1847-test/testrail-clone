import type { AssignedTestRow } from "../api/runApi";
import { formatRunDueOn } from "../assignmentListFilters";

export const MY_TESTS_ASSIGNMENT_TITLE = "Assigned to me";

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

export function formatMyTestsRunContext(row: Pick<AssignedTestRow, "runId" | "runName">) {
  const name = row.runName.trim();
  const idLabel = `R${row.runId}`;
  if (!name) return idLabel;
  if (name === idLabel || name.startsWith(`${idLabel} `)) return name;
  return `${idLabel} ${name}`;
}

export function setMyTestsSelection(selectedTestId: string | null, testId: string, checked: boolean) {
  if (!checked) return selectedTestId === testId ? null : selectedTestId;
  return testId;
}

export function visibleMyTestsSelection(selectedTestId: string | null, visibleTestIds: readonly string[]) {
  if (!selectedTestId) return null;
  return visibleTestIds.includes(selectedTestId) ? selectedTestId : null;
}

export function formatMyTestsMatchCount(visibleCount: number, assignedCount: number) {
  if (visibleCount === assignedCount) {
    return assignedCount === 1 ? "1 assigned test" : `${assignedCount} assigned tests`;
  }
  return `${visibleCount} of ${assignedCount} assigned tests`;
}

export function myTestsFiltersStorageKey(projectId: string) {
  return `my-tests-filters:${projectId}`;
}

export function formatMyTestsDueContext(row: Pick<AssignedTestRow, "runDueOn" | "agingLevel">) {
  const due = formatRunDueOn(row.runDueOn);
  if (due === "—") return "";
  if (row.agingLevel === "overdue") return `Due ${due} · Overdue`;
  if (row.agingLevel === "due_soon") return `Due ${due} · Soon`;
  return `Due ${due}`;
}
