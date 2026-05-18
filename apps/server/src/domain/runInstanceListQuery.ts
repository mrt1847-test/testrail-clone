import type { Prisma } from "@prisma/client";

import type { TestInstance } from "../modules/runs/runs.types.js";

export type RunInstancePriorityFilter = "low" | "medium" | "high";
export type RunInstanceTypeFilter = "functional" | "integration" | "regression";
export type RunInstanceSortBy = "case_id" | "title" | "status" | "priority" | "type" | "assignee";
export type RunInstanceSortDir = "asc" | "desc";

export type RunInstanceListQuery = {
  status?: TestInstance["status"];
  assignedTo?: bigint | null;
  q?: string;
  priority?: RunInstancePriorityFilter;
  caseType?: RunInstanceTypeFilter;
  caseChanged?: boolean;
  sortBy?: RunInstanceSortBy;
  sortDir?: RunInstanceSortDir;
};

function prioritySnapshotMatch(priority: RunInstancePriorityFilter): Prisma.TestInstanceWhereInput {
  const normalized = priority.toLowerCase();
  return {
    prioritySnapshot: { equals: normalized, mode: "insensitive" }
  };
}

function typeSnapshotMatch(caseType: RunInstanceTypeFilter): Prisma.TestInstanceWhereInput {
  const normalized = caseType.toLowerCase();
  return {
    typeSnapshot: { equals: normalized, mode: "insensitive" }
  };
}

export function buildRunInstanceWhere(
  runId: bigint,
  query: Omit<RunInstanceListQuery, "caseChanged" | "sortBy" | "sortDir">
): Prisma.TestInstanceWhereInput {
  return {
    runId,
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.assignedTo !== undefined ? { assignedTo: query.assignedTo } : {}),
    ...(query.priority ? prioritySnapshotMatch(query.priority) : {}),
    ...(query.caseType ? typeSnapshotMatch(query.caseType) : {}),
    ...(query.q
      ? {
          OR: [
            { titleSnapshot: { contains: query.q, mode: "insensitive" } },
            {
              caseId: {
                equals: /^\d+$/.test(query.q.replace(/^c/i, "")) ? BigInt(query.q.replace(/^c/i, "")) : -1n
              }
            }
          ]
        }
      : {})
  };
}

export function filterInstancesByCaseChanged(instances: TestInstance[], caseChanged?: boolean) {
  if (caseChanged !== true) return instances;
  return instances.filter((row) => row.caseChanged === true);
}

function compareStrings(left: string | null | undefined, right: string | null | undefined, dir: RunInstanceSortDir) {
  const a = (left ?? "").toLowerCase();
  const b = (right ?? "").toLowerCase();
  if (a === b) return 0;
  return dir === "asc" ? (a < b ? -1 : 1) : a > b ? -1 : 1;
}

export function sortRunInstances(
  instances: TestInstance[],
  sortBy: RunInstanceSortBy = "case_id",
  sortDir: RunInstanceSortDir = "asc"
) {
  const dir = sortDir;
  const rows = [...instances];
  rows.sort((left, right) => {
    let result = 0;
    switch (sortBy) {
      case "title":
        result = compareStrings(left.titleSnapshot, right.titleSnapshot, dir);
        break;
      case "status":
        result = compareStrings(left.status, right.status, dir);
        break;
      case "priority":
        result = compareStrings(left.prioritySnapshot ?? left.casePriority, right.prioritySnapshot ?? right.casePriority, dir);
        break;
      case "type":
        result = compareStrings(left.typeSnapshot ?? left.caseType, right.typeSnapshot ?? right.caseType, dir);
        break;
      case "assignee": {
        const leftKey = left.assignedTo == null ? "" : left.assignedTo.toString();
        const rightKey = right.assignedTo == null ? "" : right.assignedTo.toString();
        if (leftKey === rightKey) result = 0;
        else if (left.assignedTo == null) result = 1;
        else if (right.assignedTo == null) result = -1;
        else result = dir === "asc" ? (leftKey < rightKey ? -1 : 1) : leftKey > rightKey ? -1 : 1;
        break;
      }
      case "case_id":
      default:
        result = left.caseId === right.caseId ? 0 : left.caseId < right.caseId ? -1 : 1;
        if (dir === "desc") result *= -1;
        return result;
    }
    if (result === 0) {
      result = left.caseId === right.caseId ? 0 : left.caseId < right.caseId ? -1 : 1;
    }
    return dir === "desc" ? -result : result;
  });
  return rows;
}

export function applyRunInstanceListPostProcess(instances: TestInstance[], query: RunInstanceListQuery) {
  const filtered = filterInstancesByCaseChanged(instances, query.caseChanged);
  return sortRunInstances(filtered, query.sortBy ?? "case_id", query.sortDir ?? "asc");
}
