import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CaseListFilters, SavedCaseView } from "../types";

type CurrentCaseView = {
  sectionId: number | null;
  filters: CaseListFilters;
};

function isPriority(value: unknown): value is CaseListFilters["priority"] {
  return value === "" || value === "low" || value === "medium" || value === "high";
}

function isCaseType(value: unknown): value is CaseListFilters["caseType"] {
  return value === "" || value === "functional" || value === "integration" || value === "regression";
}

function isAutomation(value: unknown): value is CaseListFilters["automation"] {
  return value === "" || value === "manual" || value === "automated";
}

function isState(value: unknown): value is CaseListFilters["state"] {
  return value === "active" || value === "archived";
}

function normalizeSavedView(value: unknown): SavedCaseView | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const filters = row.filters;
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) return null;
  const filterRow = filters as Record<string, unknown>;
  return {
    id: typeof row.id === "string" ? row.id : "",
    name: typeof row.name === "string" ? row.name : "",
    sectionId: typeof row.sectionId === "number" ? row.sectionId : null,
    filters: {
      q: typeof filterRow.q === "string" ? filterRow.q : "",
      priority: isPriority(filterRow.priority) ? filterRow.priority : "",
      caseType: isCaseType(filterRow.caseType) ? filterRow.caseType : "",
      automation: isAutomation(filterRow.automation) ? filterRow.automation : "",
      state: isState(filterRow.state) ? filterRow.state : "active"
    }
  };
}

function sameView(left: CurrentCaseView, right: CurrentCaseView) {
  return (
    left.sectionId === right.sectionId &&
    left.filters.q === right.filters.q &&
    left.filters.priority === right.filters.priority &&
    left.filters.caseType === right.filters.caseType &&
    left.filters.automation === right.filters.automation &&
    left.filters.state === right.filters.state
  );
}

function nextViewId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `view-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useCaseSavedViews(projectId: string, userId: string | null | undefined, currentView: CurrentCaseView) {
  const storageKey = useMemo(
    () => `testrail.caseViews.${userId ?? "anonymous"}.${projectId}`,
    [projectId, userId]
  );
  const [savedViews, setSavedViews] = useState<SavedCaseView[]>([]);
  const hydratedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setSavedViews([]);
        hydratedKeyRef.current = storageKey;
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        setSavedViews([]);
        hydratedKeyRef.current = storageKey;
        return;
      }
      setSavedViews(parsed.map(normalizeSavedView).filter((view): view is SavedCaseView => view != null && view.id !== ""));
      hydratedKeyRef.current = storageKey;
    } catch {
      setSavedViews([]);
      hydratedKeyRef.current = storageKey;
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || hydratedKeyRef.current !== storageKey) return;
    window.localStorage.setItem(storageKey, JSON.stringify(savedViews));
  }, [savedViews, storageKey]);

  const matchedSavedView = useMemo(
    () =>
      savedViews.find((view) =>
        sameView(
          currentView,
          {
            sectionId: view.sectionId,
            filters: view.filters
          }
        )
      ) ?? null,
    [currentView, savedViews]
  );

  const saveView = useCallback(
    (name: string) => {
      const normalizedName = name.trim();
      if (!normalizedName) return null;
      const existing = savedViews.find((view) => view.name.toLowerCase() === normalizedName.toLowerCase()) ?? null;
      const nextView: SavedCaseView = {
        id: existing?.id ?? nextViewId(),
        name: normalizedName,
        sectionId: currentView.sectionId,
        filters: currentView.filters
      };
      setSavedViews((current) => {
        const others = current.filter((view) => view.id !== nextView.id);
        return [nextView, ...others];
      });
      return nextView;
    },
    [currentView, savedViews]
  );

  const deleteView = useCallback((viewId: string) => {
    setSavedViews((current) => current.filter((view) => view.id !== viewId));
  }, []);

  return {
    savedViews,
    matchedSavedView,
    saveView,
    deleteView
  };
}
