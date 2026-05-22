import { useEffect, useMemo, useRef } from "react";

import { parseCaseDisplayMode } from "../caseRepositoryView";
import type { CaseRepositoryViewState } from "./useExpandedCase";
import { defaultCaseListColumns } from "./useExpandedCase";
import { parseCaseGroupBy } from "../utils/caseRepositoryGrouping";
import type { CaseListColumn, CaseListFilters } from "../types";

const allowedColumns = new Set<CaseListColumn>([
  "type",
  "priority",
  "automation",
  "estimate",
  "refs",
  "labels",
  "customValues"
]);

function storageKey(projectId: string, suiteId: string, userId: string | null | undefined) {
  return `testrail.lastView.cases.${userId ?? "anonymous"}.${projectId}.${suiteId}`;
}

function isPriority(value: unknown): value is CaseListFilters["priority"] {
  return value === "" || value === "low" || value === "medium" || value === "high";
}

function isCaseType(value: unknown): value is CaseListFilters["caseType"] {
  return value === "" || value === "functional" || value === "integration" || value === "regression";
}

function isAutomation(value: unknown): value is CaseListFilters["automation"] {
  return value === "" || value === "manual" || value === "automated";
}

function isPresence(value: unknown): value is CaseListFilters["refs"] {
  return value === "" || value === "with" || value === "without";
}

function isState(value: unknown): value is CaseListFilters["state"] {
  return value === "active" || value === "archived";
}

function normalizeColumns(value: unknown): CaseListColumn[] {
  if (!Array.isArray(value)) return defaultCaseListColumns;
  const columns = value.filter((item): item is CaseListColumn => allowedColumns.has(item as CaseListColumn));
  return columns.length > 0 ? Array.from(new Set(columns)) : defaultCaseListColumns;
}

function normalizeLastView(value: unknown, validSectionIds: ReadonlySet<number>): CaseRepositoryViewState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const filterRow = row.filters;
  if (!filterRow || typeof filterRow !== "object" || Array.isArray(filterRow)) return null;
  const filters = filterRow as Record<string, unknown>;
  const sectionId = typeof row.sectionId === "number" && validSectionIds.has(row.sectionId) ? row.sectionId : null;

  return {
    sectionId,
    display: parseCaseDisplayMode(typeof row.display === "string" ? row.display : null),
    groupBy: parseCaseGroupBy(typeof row.groupBy === "string" ? row.groupBy : null),
    columns: normalizeColumns(row.columns),
    filters: {
      q: typeof filters.q === "string" ? filters.q : "",
      priority: isPriority(filters.priority) ? filters.priority : "",
      caseType: isCaseType(filters.caseType) ? filters.caseType : "",
      automation: isAutomation(filters.automation) ? filters.automation : "",
      refs: isPresence(filters.refs) ? filters.refs : "",
      labels: isPresence(filters.labels) ? filters.labels : "",
      estimate: isPresence(filters.estimate) ? filters.estimate : "",
      state: isState(filters.state) ? filters.state : "active"
    }
  };
}

function readLastView(key: string, validSectionIds: ReadonlySet<number>): CaseRepositoryViewState | null {
  if (typeof window === "undefined") return null;
  try {
    return normalizeLastView(JSON.parse(window.localStorage.getItem(key) ?? "null"), validSectionIds);
  } catch {
    return null;
  }
}

type UseCaseLastViewStateInput = {
  projectId: string;
  suiteId: string;
  userId: string | null | undefined;
  currentView: CaseRepositoryViewState;
  validSectionIds: ReadonlySet<number>;
  hasExplicitUrlState: boolean;
  onRestore: (view: CaseRepositoryViewState) => void;
};

export function useCaseLastViewState({
  projectId,
  suiteId,
  userId,
  currentView,
  validSectionIds,
  hasExplicitUrlState,
  onRestore
}: UseCaseLastViewStateInput) {
  const key = useMemo(() => storageKey(projectId, suiteId, userId), [projectId, suiteId, userId]);
  const restoredKeyRef = useRef<string | null>(null);
  const skipPersistKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!projectId || !suiteId || validSectionIds.size === 0 || restoredKeyRef.current === key) return;
    restoredKeyRef.current = key;
    if (hasExplicitUrlState) return;
    const stored = readLastView(key, validSectionIds);
    if (!stored) return;
    skipPersistKeyRef.current = key;
    onRestore(stored);
  }, [hasExplicitUrlState, key, onRestore, projectId, suiteId, validSectionIds]);

  useEffect(() => {
    if (typeof window === "undefined" || restoredKeyRef.current !== key) return;
    if (skipPersistKeyRef.current === key) {
      skipPersistKeyRef.current = null;
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(currentView));
  }, [currentView, key]);
}
