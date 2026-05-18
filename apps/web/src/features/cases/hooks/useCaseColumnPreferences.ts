import { useCallback, useMemo } from "react";

import { defaultCaseListColumns } from "./useExpandedCase";
import type { CaseListColumn } from "../types";

const STORAGE_PREFIX = "case-column-prefs";

const allowedColumns = new Set<CaseListColumn>([
  "type",
  "priority",
  "automation",
  "estimate",
  "refs",
  "labels",
  "customValues"
]);

function storageKey(projectId: string, suiteId: string) {
  return `${STORAGE_PREFIX}:${projectId}:${suiteId}`;
}

function readColumns(projectId: string, suiteId: string): CaseListColumn[] | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey(projectId, suiteId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const columns = parsed.filter((item): item is CaseListColumn => allowedColumns.has(item as CaseListColumn));
    return columns.length > 0 ? columns : null;
  } catch {
    return null;
  }
}

export function useCaseColumnPreferences(projectId: string, suiteId: string, urlColumns: CaseListColumn[]) {
  const stored = useMemo(() => readColumns(projectId, suiteId), [projectId, suiteId]);

  const effectiveColumns = stored ?? urlColumns;

  const persistColumns = useCallback(
    (columns: CaseListColumn[]) => {
      const normalized = Array.from(new Set(columns.filter((column) => allowedColumns.has(column))));
      const next = normalized.length > 0 ? normalized : defaultCaseListColumns;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey(projectId, suiteId), JSON.stringify(next));
      }
      return next;
    },
    [projectId, suiteId]
  );

  return { effectiveColumns, persistColumns, hasStoredPreference: stored != null };
}
