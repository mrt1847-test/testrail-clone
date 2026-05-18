import type { CaseSectionScope } from "./types";

export type CaseDisplayMode = "subtree" | "tree" | "compact";

export const CASE_DISPLAY_MODES: Array<{ id: CaseDisplayMode; label: string; hint: string }> = [
  {
    id: "subtree",
    label: "Subsections",
    hint: "All cases in the suite (grouped by section); tree selection scrolls to a section"
  },
  {
    id: "tree",
    label: "Section only",
    hint: "Cases assigned directly to the selected section"
  },
  {
    id: "compact",
    label: "Compact",
    hint: "Subtree cases in one continuous list without section headers"
  }
];

export function parseCaseDisplayMode(value: string | null): CaseDisplayMode {
  if (value === "tree" || value === "compact" || value === "subtree") return value;
  return "subtree";
}

export function sectionScopeForDisplay(mode: CaseDisplayMode): CaseSectionScope {
  return mode === "tree" ? "direct" : "subtree";
}
