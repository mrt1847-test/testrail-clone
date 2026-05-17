import type { MilestoneLifecycleStatus } from "./milestoneLifecycle.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type MilestoneForecastInput = {
  isCompleted: boolean;
  lifecycleStatus: MilestoneLifecycleStatus;
  startDate?: Date | string | null;
  dueDate?: Date | string | null;
  total: number;
  passed: number;
  failed: number;
  now?: Date;
};

export type BurndownPoint = {
  date: string;
  idealRemaining: number;
  actualRemaining: number | null;
};

export type MilestoneScheduleStatus =
  | "completed"
  | "no_schedule"
  | "not_started"
  | "on_track"
  | "at_risk"
  | "overdue";

export type MilestoneForecast = {
  scheduleStatus: MilestoneScheduleStatus;
  remainingTests: number;
  executedTests: number;
  daysElapsed: number | null;
  daysRemaining: number | null;
  daysTotal: number | null;
  velocityPerDay: number | null;
  projectedCompletionDate: string | null;
  projectedOnTime: boolean | null;
  hint: string;
  burndown: BurndownPoint[];
};

function parseDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysBetween(start: Date, end: Date) {
  return Math.max(0, Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / MS_PER_DAY));
}

function buildBurndownSeries(input: {
  start: Date;
  due: Date;
  now: Date;
  total: number;
  remainingToday: number;
}): BurndownPoint[] {
  const totalDays = Math.max(1, daysBetween(input.start, input.due));
  const todayIndex = Math.min(totalDays, daysBetween(input.start, input.now));
  const maxPoints = 31;
  const step = totalDays <= maxPoints ? 1 : Math.ceil(totalDays / maxPoints);

  const points: BurndownPoint[] = [];
  for (let day = 0; day <= totalDays; day += step) {
    const pointDate = new Date(input.start.getTime() + day * MS_PER_DAY);
    const idealRemaining = Math.max(0, Math.round(input.total * (1 - day / totalDays)));
    const actualRemaining = day === todayIndex ? input.remainingToday : day < todayIndex ? null : null;
    points.push({
      date: toDateKey(pointDate),
      idealRemaining,
      actualRemaining: day === todayIndex ? input.remainingToday : null
    });
  }
  if (points[points.length - 1]?.date !== toDateKey(input.due)) {
    points.push({
      date: toDateKey(input.due),
      idealRemaining: 0,
      actualRemaining: null
    });
  }
  return points;
}

export function buildMilestoneForecast(input: MilestoneForecastInput): MilestoneForecast {
  const now = input.now ?? new Date();
  const start = parseDate(input.startDate);
  const due = parseDate(input.dueDate);
  const remainingTests = Math.max(0, input.total - input.passed);
  const executedTests = input.passed + input.failed;

  if (input.isCompleted || input.lifecycleStatus === "completed") {
    return {
      scheduleStatus: "completed",
      remainingTests: 0,
      executedTests,
      daysElapsed: start && due ? daysBetween(start, due) : null,
      daysRemaining: 0,
      daysTotal: start && due ? daysBetween(start, due) : null,
      velocityPerDay: null,
      projectedCompletionDate: null,
      projectedOnTime: true,
      hint: "Milestone is completed.",
      burndown: []
    };
  }

  if (input.lifecycleStatus === "upcoming") {
    return {
      scheduleStatus: "not_started",
      remainingTests,
      executedTests,
      daysElapsed: null,
      daysRemaining: start && due ? daysBetween(now, due) : null,
      daysTotal: start && due ? daysBetween(start, due) : null,
      velocityPerDay: null,
      projectedCompletionDate: null,
      projectedOnTime: null,
      hint: "Milestone has not started yet. Forecast begins when the start date is reached.",
      burndown: start && due ? buildBurndownSeries({ start, due, now, total: input.total, remainingToday: remainingTests }) : []
    };
  }

  if (!start || !due) {
    return {
      scheduleStatus: "no_schedule",
      remainingTests,
      executedTests,
      daysElapsed: start ? daysBetween(start, now) : null,
      daysRemaining: due ? daysBetween(now, due) : null,
      daysTotal: start && due ? daysBetween(start, due) : null,
      velocityPerDay: null,
      projectedCompletionDate: null,
      projectedOnTime: null,
      hint: "Add start and due dates to enable schedule forecast and burndown hints.",
      burndown: []
    };
  }

  const daysTotal = daysBetween(start, due);
  const daysElapsed = daysBetween(start, now);
  const daysRemaining = daysBetween(now, due);
  const velocityPerDay =
    daysElapsed > 0 ? Math.round((input.passed / daysElapsed) * 100) / 100 : input.passed > 0 ? input.passed : null;

  let projectedCompletionDate: string | null = null;
  let projectedOnTime: boolean | null = null;
  if (velocityPerDay != null && velocityPerDay > 0 && remainingTests > 0) {
    const daysToFinish = Math.ceil(remainingTests / velocityPerDay);
    const projected = new Date(now.getTime() + daysToFinish * MS_PER_DAY);
    projectedCompletionDate = projected.toISOString();
    projectedOnTime = projected.getTime() <= due.getTime();
  } else if (remainingTests === 0) {
    projectedOnTime = true;
    projectedCompletionDate = now.toISOString();
  }

  const idealRemainingToday = Math.max(0, Math.round(input.total * (1 - daysElapsed / Math.max(1, daysTotal))));
  const behindSchedule = remainingTests > idealRemainingToday + Math.max(1, Math.round(input.total * 0.05));

  let scheduleStatus: MilestoneScheduleStatus = "on_track";
  if (now.getTime() > due.getTime() && remainingTests > 0) {
    scheduleStatus = "overdue";
  } else if (projectedOnTime === false || behindSchedule) {
    scheduleStatus = "at_risk";
  }

  let hint: string;
  if (scheduleStatus === "overdue") {
    hint = `Past due with ${remainingTests} test(s) still not passed.`;
  } else if (scheduleStatus === "at_risk") {
    hint =
      projectedCompletionDate && projectedOnTime === false
        ? `At risk: current pace projects completion after the due date (${toDateKey(due)}).`
        : `At risk: remaining work is ahead of the ideal burndown (${remainingTests} vs ~${idealRemainingToday} ideal).`;
  } else if (remainingTests === 0) {
    hint = "All tests passed for linked runs. Ready to complete the milestone.";
  } else if (velocityPerDay != null && projectedCompletionDate) {
    hint = `On track at ~${velocityPerDay} passed test(s)/day; projected completion ${toDateKey(new Date(projectedCompletionDate))}.`;
  } else {
    hint = `On track with ${daysRemaining} day(s) until due date.`;
  }

  return {
    scheduleStatus,
    remainingTests,
    executedTests,
    daysElapsed,
    daysRemaining,
    daysTotal,
    velocityPerDay,
    projectedCompletionDate,
    projectedOnTime,
    hint,
    burndown: buildBurndownSeries({
      start,
      due,
      now,
      total: input.total,
      remainingToday: remainingTests
    })
  };
}
