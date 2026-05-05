import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import type {
  CaseFilterAutomation,
  CaseFilterPriority,
  CaseFilterState,
  CaseFilterType,
  CaseListFilters
} from "../types";

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
      state: parseState(searchParams.get("state"))
    }),
    [searchParams]
  );

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
    const state = patch.state ?? caseFilters.state;

    if (q.trim().length > 0) next.set("q", q.trim());
    else next.delete("q");

    if (priority) next.set("priority", priority);
    else next.delete("priority");

    if (caseType) next.set("caseType", caseType);
    else next.delete("caseType");

    if (automation) next.set("automation", automation);
    else next.delete("automation");

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
    next.delete("state");
    next.delete("caseId");
    next.delete("mode");
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const applySavedView = useCallback((view: { sectionId: number | null; filters: CaseListFilters }) => {
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

    if (view.filters.state === "archived") next.set("state", view.filters.state);
    else next.delete("state");

    next.delete("caseId");
    next.delete("mode");
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  return {
    expandedCaseId,
    mode,
    selectedSectionId,
    caseFilters,
    setExpandedCase,
    setSelectedSection,
    setCaseFilters,
    clearCaseFilters,
    applySavedView
  };
}
