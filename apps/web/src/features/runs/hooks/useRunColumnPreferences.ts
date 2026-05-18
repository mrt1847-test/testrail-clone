import { useCallback, useMemo } from "react";

import { defaultRunListColumns, type RunListColumn } from "../utils/runInstanceColumns";

const STORAGE_PREFIX = "run-column-prefs";

const allowedColumns = new Set<RunListColumn>(["priority", "type"]);

function storageKey(projectId: string, runId: string) {
  return `${STORAGE_PREFIX}:${projectId}:${runId}`;
}

function readColumns(projectId: string, runId: string): RunListColumn[] | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey(projectId, runId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const columns = parsed.filter((item): item is RunListColumn => allowedColumns.has(item as RunListColumn));
    return columns;
  } catch {
    return null;
  }
}

export function useRunColumnPreferences(projectId: string, runId: string) {
  const stored = useMemo(() => readColumns(projectId, runId), [projectId, runId]);
  const effectiveColumns = stored ?? defaultRunListColumns;

  const persistColumns = useCallback(
    (columns: RunListColumn[]) => {
      const normalized = Array.from(new Set(columns.filter((column) => allowedColumns.has(column))));
      const next = normalized;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey(projectId, runId), JSON.stringify(next));
      }
      return next;
    },
    [projectId, runId]
  );

  return { effectiveColumns, persistColumns, hasStoredPreference: stored != null };
}
