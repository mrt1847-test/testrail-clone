import type { UiDensity } from "../../../shared/ui/density/uiDensity";

export function shouldExpandRunSchedulePanel(input: {
  startedAt?: string | null;
  dueOn?: string | null;
  closedAt?: string | null;
  warningCount?: number;
}): boolean {
  return Boolean(input.startedAt || input.dueOn || input.closedAt || (input.warningCount ?? 0) > 0);
}

export function showInlineAssigneeActions(density: UiDensity): boolean {
  return density !== "compact";
}

export function runTestRowClassName(selected: boolean): string {
  return selected
    ? "cursor-pointer border-l-2 border-l-slate-900 bg-slate-100"
    : "cursor-pointer border-l-2 border-l-transparent hover:bg-slate-50/90";
}

export function runTestTitleClassName(selected: boolean): string {
  return selected
    ? "max-w-[24rem] truncate font-semibold text-slate-950"
    : "max-w-[24rem] truncate font-normal text-slate-800";
}
