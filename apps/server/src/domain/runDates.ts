export type MilestoneSchedule = {
  startDate: Date | null;
  dueDate: Date | null;
};

export function inheritRunDatesFromMilestone(
  input: { startedAt?: Date | null; dueOn?: Date | null },
  milestone: MilestoneSchedule | null
): { startedAt: Date | null; dueOn: Date | null } {
  return {
    startedAt: input.startedAt !== undefined ? input.startedAt : (milestone?.startDate ?? null),
    dueOn: input.dueOn !== undefined ? input.dueOn : (milestone?.dueDate ?? null)
  };
}

function sameCalendarDay(left: Date, right: Date) {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  );
}

export function buildRunDateWarnings(input: {
  status: "open" | "closed";
  startedAt: Date | null;
  dueOn: Date | null;
  closedAt: Date | null;
  milestone: MilestoneSchedule | null;
  planName?: string | null;
}): string[] {
  const warnings: string[] = [];
  const { status, startedAt, dueOn, closedAt, milestone, planName } = input;

  if (milestone?.startDate && startedAt && sameCalendarDay(startedAt, milestone.startDate)) {
    warnings.push("Start date matches the linked milestone schedule.");
  }
  if (milestone?.dueDate && dueOn && sameCalendarDay(dueOn, milestone.dueDate)) {
    warnings.push("End date matches the linked milestone schedule.");
  }
  if (planName) {
    warnings.push(`Run is linked to plan “${planName}”. Align dates with the plan/milestone schedule if needed.`);
  }
  if (startedAt && dueOn && dueOn < startedAt) {
    warnings.push("End date is before the start date.");
  }
  if (status === "open" && dueOn && dueOn.getTime() < Date.now()) {
    warnings.push("End date has passed. Close the run manually when testing is complete (runs never auto-close on date).");
  }
  if (status === "closed" && dueOn && closedAt && closedAt > dueOn) {
    warnings.push("Run was closed after the planned end date.");
  }
  return warnings;
}
