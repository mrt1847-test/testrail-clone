export const activeAssignmentStatuses = ["untested", "failed", "blocked", "retest"] as const;

export type AssignmentAgingLevel = "none" | "due_soon" | "overdue" | "stale";

export type AssignmentAgingInput = {
  status: string;
  runDueOn: Date | string | null | undefined;
  updatedAt: Date | string;
  now?: Date;
};

/** Days before run due date to show "due soon". */
export const ASSIGNMENT_DUE_SOON_DAYS = 3;

/** Days without activity on an active assignment to show "stale". */
export const ASSIGNMENT_STALE_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isActiveAssignmentStatus(status: string) {
  return (activeAssignmentStatuses as readonly string[]).includes(status);
}

export function computeAssignmentAging(input: AssignmentAgingInput): AssignmentAgingLevel {
  if (!isActiveAssignmentStatus(input.status)) return "none";

  const now = input.now ?? new Date();
  const due = parseDate(input.runDueOn);
  if (due) {
    if (due.getTime() < now.getTime()) return "overdue";
    const daysUntilDue = (due.getTime() - now.getTime()) / MS_PER_DAY;
    if (daysUntilDue <= ASSIGNMENT_DUE_SOON_DAYS) return "due_soon";
  }

  const updated = parseDate(input.updatedAt);
  if (updated) {
    const daysSinceUpdate = (now.getTime() - updated.getTime()) / MS_PER_DAY;
    if (daysSinceUpdate >= ASSIGNMENT_STALE_DAYS) return "stale";
  }

  return "none";
}

export function assignmentAgingLabel(level: AssignmentAgingLevel): string {
  switch (level) {
    case "overdue":
      return "Overdue";
    case "due_soon":
      return "Due soon";
    case "stale":
      return "Stale";
    default:
      return "";
  }
}

export function summarizeAssignmentAging(levels: AssignmentAgingLevel[]) {
  return {
    overdue: levels.filter((level) => level === "overdue").length,
    dueSoon: levels.filter((level) => level === "due_soon").length,
    stale: levels.filter((level) => level === "stale").length
  };
}
