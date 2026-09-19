import type { CaseSectionScope } from "./types";

export type CaseDisplayMode = "subtree" | "tree" | "compact";
export type CaseQueryScope = "direct" | "subtree" | "all";

export const CASE_QUERY_SCOPES: Array<{ id: CaseQueryScope; label: string }> = [
  { id: "direct", label: "Selected section only" },
  { id: "subtree", label: "Include subsections" },
  { id: "all", label: "All sections" }
];

export const CASE_DISPLAY_MODES: Array<{ id: CaseDisplayMode; label: string; hint: string; inMenu?: boolean }> = [
  {
    id: "subtree",
    label: "Section headers",
    hint: "Group the current scope by section",
    inMenu: false
  },
  {
    id: "tree",
    label: "Section headers",
    hint: "Group the current scope by section",
    inMenu: false
  },
  {
    id: "compact",
    label: "Compact list",
    hint: "Tighter rows; keep owning-section path headers",
    inMenu: false
  }
];

export function parseCaseDisplayMode(value: string | null): CaseDisplayMode {
  if (value === "tree" || value === "compact" || value === "subtree") return value;
  return "subtree";
}

export function parseCaseQueryScope(scopeValue: string | null, displayValue: string | null = null): CaseQueryScope {
  if (scopeValue === "direct" || scopeValue === "subtree" || scopeValue === "all") return scopeValue;
  if (displayValue === "tree") return "direct";
  if (displayValue === "subtree" || displayValue === "compact") return "all";
  return "subtree";
}

export function writeCaseQueryScope(params: URLSearchParams, scope: CaseQueryScope) {
  params.set("scope", scope);
}

export function sectionScopeForQuery(scope: CaseQueryScope): CaseSectionScope {
  return scope === "direct" ? "direct" : "subtree";
}

export function fetchSectionIdForQuery(scope: CaseQueryScope, selectedSectionId: number | null): number | null {
  return scope === "all" ? null : selectedSectionId;
}

export function caseQueryScopeEmptyTitle(scope: CaseQueryScope, archived: boolean): string {
  const noun = archived ? "archived test cases" : "test cases";
  if (scope === "direct") return `No ${noun} in this section`;
  if (scope === "subtree") return `No ${noun} in this section or its subsections`;
  return `No ${noun} in this suite`;
}

export function caseQueryScopeLabel(scope: CaseQueryScope): string {
  return CASE_QUERY_SCOPES.find((item) => item.id === scope)?.label ?? "Include subsections";
}
