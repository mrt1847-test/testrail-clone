import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import type {
  CaseFilterAutomation,
  CasePresenceFilter,
  CaseFilterPriority,
  CaseListColumn,
  CaseFilterState,
  CaseFilterType,
  CaseListFilters
} from "../types";

export const defaultCaseListColumns: CaseListColumn[] = ["type", "priority", "automation", "estimate"];
const allowedCaseListColumns = new Set<CaseListColumn>([
  "type",
  "priority",
  "automation",
  "estimate",
  "refs",
  "labels",
  "customValues"
]);

function parsePriority(value: string | null): CaseFilterPriority {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "";
}

function parseCaseType(value: string | null): CaseFilterType {
  if (value === "functional" || value === "integration" || value === "regression") return value;
  return "";
}

function parseAutomation(value: string | null): CaseFilterAutomation {
  if (value === "manual" || value === "automated") return value;
  return "";
}

function parseState(value: string | null): CaseFilterState {
  if (value === "archived") return "archived";
  return "active";
}

function parsePresence(value: string | null): CasePresenceFilter {
  if (value === "with" || value === "without") return value;
  return "";
}

function parseColumns(value: string | null): CaseListColumn[] {
  const columns =
    value
      ?.split(",")
      .map((item) => item.trim())
      .filter((item): item is CaseListColumn => allowedCaseListColumns.has(item as CaseListColumn)) ?? [];
  return columns.length > 0 ? Array.from(new Set(columns)) : defaultCaseListColumns;
}

function writeColumns(next: URLSearchParams, columns: CaseListColumn[]) {
  const normalized = Array.from(new Set(columns.filter((column) => allowedCaseListColumns.has(column))));
  const effective = normalized.length > 0 ? normalized : defaultCaseListColumns;
  if (effective.join(",") === defaultCaseListColumns.join(",")) {
    next.delete("columns");
    return;
  }
  next.set("columns", effective.join(","));
}

export function useExpandedCase() {
  const [searchParams, setSearchParams] = useSearchParams();

  const expandedCaseId = useMemo(() => {
    const raw = searchParams.get("caseId");
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  }, [searchParams]);

  const mode: "view" | "edit" = searchParams.get("mode") === "edit" ? "edit" : "view";

  const selectedSectionId = useMemo(() => {
    const raw = searchParams.get("sectionId");
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  }, [searchParams]);

  const caseFilters = useMemo<CaseListFilters>(
    () => ({
      q: searchParams.get("q") ?? "",
      priority: parsePriority(searchParams.get("priority")),
      caseType: parseCaseType(searchParams.get("caseType")),
      automation: parseAutomation(searchParams.get("automation")),
      refs: parsePresence(searchParams.get("refs")),
      labels: parsePresence(searchParams.get("labels")),
      estimate: parsePresence(searchParams.get("estimate")),
      state: parseState(searchParams.get("state"))
    }),
    [searchParams]
  );
  const caseColumns = useMemo(() => parseColumns(searchParams.get("columns")), [searchParams]);

  const setExpandedCase = useCallback((nextCaseId: number | null, nextMode: "view" | "edit" = "view") => {
    const next = new URLSearchParams(searchParams);

    if (nextCaseId === null) {
      next.delete("caseId");
      next.delete("mode");
    } else {
      next.set("caseId", String(nextCaseId));
      next.set("mode", nextMode);
    }

    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const setSelectedSection = useCallback((nextSectionId: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("sectionId", String(nextSectionId));
    next.delete("caseId");
    next.delete("mode");
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const setCaseFilters = useCallback((patch: Partial<CaseListFilters>) => {
    const next = new URLSearchParams(searchParams);
    const q = patch.q ?? caseFilters.q;
    const priority = patch.priority ?? caseFilters.priority;
    const caseType = patch.caseType ?? caseFilters.caseType;
    const automation = patch.automation ?? caseFilters.automation;
    const refs = patch.refs ?? caseFilters.refs;
    const labels = patch.labels ?? caseFilters.labels;
    const estimate = patch.estimate ?? caseFilters.estimate;
    const state = patch.state ?? caseFilters.state;

    if (q.trim().length > 0) next.set("q", q.trim());
    else next.delete("q");

    if (priority) next.set("priority", priority);
    else next.delete("priority");

    if (caseType) next.set("caseType", caseType);
    else next.delete("caseType");

    if (automation) next.set("automation", automation);
    else next.delete("automation");

    if (refs) next.set("refs", refs);
    else next.delete("refs");

    if (labels) next.set("labels", labels);
    else next.delete("labels");

    if (estimate) next.set("estimate", estimate);
    else next.delete("estimate");

    if (state === "archived") next.set("state", state);
    else next.delete("state");

    next.delete("caseId");
    next.delete("mode");
    setSearchParams(next);
  }, [caseFilters, searchParams, setSearchParams]);

  const clearCaseFilters = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("q");
    next.delete("priority");
    next.delete("caseType");
    next.delete("automation");
    next.delete("refs");
    next.delete("labels");
    next.delete("estimate");
    next.delete("state");
    next.delete("caseId");
    next.delete("mode");
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const setCaseColumns = useCallback((columns: CaseListColumn[]) => {
    const next = new URLSearchParams(searchParams);
    writeColumns(next, columns);
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const applySavedView = useCallback((view: { sectionId: number | null; filters: CaseListFilters; columns?: CaseListColumn[] }) => {
    const next = new URLSearchParams(searchParams);
    if (view.sectionId != null) next.set("sectionId", String(view.sectionId));
    else next.delete("sectionId");

    if (view.filters.q.trim().length > 0) next.set("q", view.filters.q.trim());
    else next.delete("q");

    if (view.filters.priority) next.set("priority", view.filters.priority);
    else next.delete("priority");

    if (view.filters.caseType) next.set("caseType", view.filters.caseType);
    else next.delete("caseType");

    if (view.filters.automation) next.set("automation", view.filters.automation);
    else next.delete("automation");

    if (view.filters.refs) next.set("refs", view.filters.refs);
    else next.delete("refs");

    if (view.filters.labels) next.set("labels", view.filters.labels);
    else next.delete("labels");

    if (view.filters.estimate) next.set("estimate", view.filters.estimate);
    else next.delete("estimate");

    if (view.filters.state === "archived") next.set("state", view.filters.state);
    else next.delete("state");

    writeColumns(next, view.columns ?? defaultCaseListColumns);
    next.delete("caseId");
    next.delete("mode");
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  return {
    expandedCaseId,
    mode,
    selectedSectionId,
    caseFilters,
    caseColumns,
    setExpandedCase,
    setSelectedSection,
    setCaseFilters,
    setCaseColumns,
    clearCaseFilters,
    applySavedView
  };
}
