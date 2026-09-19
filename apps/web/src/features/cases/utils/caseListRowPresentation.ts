import type { CaseListColumn, TestCase } from "../types";

export type CaseListRowMetadataPart = { column: CaseListColumn; value: string };

export function caseListRowClassName(input: {
  readingSelected: boolean;
  keyboardFocused?: boolean;
  dragging?: boolean;
}): string {
  const reading = input.readingSelected
    ? "border-l-2 border-l-slate-900 bg-slate-100"
    : "border-l-2 border-l-transparent hover:bg-slate-50/90";
  const focus =
    !input.readingSelected && input.keyboardFocused ? "bg-amber-50/80" : "";
  const drag = input.dragging ? "opacity-50" : "";
  return ["case-list-row relative flex items-center gap-2 pl-3 transition-colors", reading, focus, drag]
    .filter(Boolean)
    .join(" ");
}

export function caseListRowTitleClassName(readingSelected: boolean): string {
  return readingSelected
    ? "case-list-row__title min-w-0 flex-1 whitespace-normal break-words font-semibold text-slate-950"
    : "case-list-row__title min-w-0 flex-1 whitespace-normal break-words font-medium text-slate-900";
}

export function caseListRowMetadataParts(
  item: Pick<TestCase, "type" | "priority" | "automationStatus" | "estimate">,
  visibleColumns: CaseListColumn[]
): CaseListRowMetadataPart[] {
  const visible = new Set(visibleColumns);
  const parts: CaseListRowMetadataPart[] = [];
  if (visible.has("type")) parts.push({ column: "type", value: item.type });
  if (visible.has("priority")) parts.push({ column: "priority", value: item.priority });
  if (visible.has("automation")) parts.push({ column: "automation", value: item.automationStatus });
  if (visible.has("estimate") && item.estimate !== "-") {
    parts.push({ column: "estimate", value: item.estimate });
  }
  return parts;
}

export function sectionBlockAddCaseLabel(path: string): string {
  return `Add Case to ${path}`;
}
