import type { CreateRunInput } from "../api/runApi";
import type { RunCompositionMode } from "../types";

export type RunMembershipKind = "all" | "selected" | "dynamic";

export type RunMembershipOption = {
  kind: RunMembershipKind;
  label: string;
  description: string;
};

export type RunCreateChooserSnapshot = {
  selectedCaseIds: string[];
  excludedCaseIds: string[];
  includedSectionIds: string[];
  excludedSectionIds: string[];
  selectedSectionId: number | null;
};

const MEMBERSHIP_OPTIONS: RunMembershipOption[] = [
  {
    kind: "all",
    label: "All cases",
    description: "Automatically includes new cases"
  },
  {
    kind: "selected",
    label: "Selected cases",
    description: "Fixed membership"
  },
  {
    kind: "dynamic",
    label: "Dynamic filter",
    description: "Membership follows criteria"
  }
];

export function runMembershipOptions(): RunMembershipOption[] {
  return MEMBERSHIP_OPTIONS.map((option) => ({ ...option }));
}

export function defaultFreshMembershipKind(): RunMembershipKind {
  return "all";
}

export function membershipKindFromComposition(
  mode: RunCompositionMode,
  _includeAll: boolean
): RunMembershipKind {
  if (mode === "include_all_live") return "all";
  if (mode === "dynamic_filter") return "dynamic";
  return "selected";
}

export function compositionFromMembership(kind: RunMembershipKind): {
  compositionMode: RunCompositionMode;
  includeAll: boolean;
} {
  if (kind === "all") return { compositionMode: "include_all_live", includeAll: true };
  if (kind === "dynamic") return { compositionMode: "dynamic_filter", includeAll: false };
  return { compositionMode: "static", includeAll: false };
}

export function captureChooserSnapshot(input: RunCreateChooserSnapshot): RunCreateChooserSnapshot {
  return {
    selectedCaseIds: [...input.selectedCaseIds],
    excludedCaseIds: [...input.excludedCaseIds],
    includedSectionIds: [...input.includedSectionIds],
    excludedSectionIds: [...input.excludedSectionIds],
    selectedSectionId: input.selectedSectionId
  };
}

export function emptyMembershipSelection(): Omit<RunCreateChooserSnapshot, "selectedSectionId"> & {
  selectedSectionId: number | null;
} {
  return {
    selectedCaseIds: [],
    excludedCaseIds: [],
    includedSectionIds: [],
    excludedSectionIds: [],
    selectedSectionId: null
  };
}

export function selectAllCurrentCaseIds(caseIds: readonly string[]): string[] {
  return [...caseIds];
}

export function filterChooserVisibleCaseIds(
  cases: Array<{ id: string; title: string }>,
  visibleCaseIds: ReadonlySet<string>,
  query: string
): Set<string> {
  const needle = query.trim().toLowerCase();
  const out = new Set<string>();
  for (const row of cases) {
    if (!visibleCaseIds.has(row.id)) continue;
    if (needle && !row.title.toLowerCase().includes(needle) && !row.id.toLowerCase().includes(needle)) {
      continue;
    }
    out.add(row.id);
  }
  return out;
}

export function buildRunCreateTargetSummary(input: {
  kind: RunMembershipKind;
  suiteName: string;
  caseCount: number;
  selectedCount: number;
  excludedCount: number;
  includedSectionCount: number;
  matchingCount: number;
  filterPriority: "" | "low" | "medium" | "high";
  filterState: "active" | "archived";
}): string {
  const suite = input.suiteName.trim() || "this suite";
  if (input.kind === "all") {
    const parts = [`All cases in ${suite}`, `${input.caseCount} test${input.caseCount === 1 ? "" : "s"}`];
    if (input.includedSectionCount > 0) {
      parts.push(`${input.includedSectionCount} section${input.includedSectionCount === 1 ? "" : "s"}`);
    }
    if (input.excludedCount > 0) {
      parts.push(`${input.excludedCount} excluded`);
    }
    return `${parts.join(" · ")}. New cases in this suite are included automatically.`;
  }
  if (input.kind === "selected") {
    if (input.selectedCount === 0) return "Selected cases · none yet. Membership stays fixed.";
    return `Selected cases · ${input.selectedCount} test${input.selectedCount === 1 ? "" : "s"}. Membership stays fixed.`;
  }
  const priority = input.filterPriority || "any priority";
  return `Dynamic filter · ${priority} · ${input.filterState} · ${input.matchingCount} matching. Membership follows these criteria.`;
}

export function isRunCreateSubmitDisabled(input: {
  name: string;
  suiteId: string;
  kind: RunMembershipKind;
  selectedCaseIds: readonly string[];
  isPending: boolean;
}): boolean {
  if (input.isPending || !input.name.trim() || !input.suiteId) return true;
  if (input.kind === "selected" && input.selectedCaseIds.length === 0) return true;
  return false;
}

export function buildRunCreateMembershipFields(input: {
  kind: RunMembershipKind;
  selectedCaseIds: string[];
  excludedCaseIds: string[];
  includedSectionIds: string[];
  excludedSectionIds: string[];
  filterPriority: "" | "low" | "medium" | "high";
  filterState: "active" | "archived";
}): Pick<
  CreateRunInput,
  | "includeAll"
  | "compositionMode"
  | "caseIds"
  | "excludedCaseIds"
  | "includedSectionIds"
  | "excludedSectionIds"
  | "filterDefinition"
> {
  const { compositionMode, includeAll } = compositionFromMembership(input.kind);
  if (input.kind === "all") {
    return {
      includeAll: true,
      compositionMode,
      caseIds: undefined,
      excludedCaseIds: input.excludedCaseIds.length > 0 ? input.excludedCaseIds : undefined,
      includedSectionIds: input.includedSectionIds.length > 0 ? input.includedSectionIds : undefined,
      excludedSectionIds: input.excludedSectionIds.length > 0 ? input.excludedSectionIds : undefined,
      filterDefinition: undefined
    };
  }
  if (input.kind === "selected") {
    return {
      includeAll: false,
      compositionMode,
      caseIds: input.selectedCaseIds,
      excludedCaseIds: undefined,
      includedSectionIds: input.includedSectionIds.length > 0 ? input.includedSectionIds : undefined,
      excludedSectionIds: undefined,
      filterDefinition: undefined
    };
  }
  return {
    includeAll: false,
    compositionMode,
    caseIds: undefined,
    excludedCaseIds: undefined,
    includedSectionIds: undefined,
    excludedSectionIds: undefined,
    filterDefinition: {
      ...(input.filterPriority ? { priority: input.filterPriority } : {}),
      state: input.filterState,
      ...(input.includedSectionIds.length > 0 ? { includedSectionIds: input.includedSectionIds } : {})
    }
  };
}
