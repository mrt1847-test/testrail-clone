import { useCallback, useEffect, useState } from "react";

import { defaultCaseListColumns } from "./useExpandedCase";
import type { CaseColumnWidths, CaseListColumn } from "../types";

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

export const defaultCaseColumnWidths: Record<CaseListColumn, number> = {
  type: 88,
  priority: 88,
  automation: 120,
  estimate: 88,
  refs: 220,
  labels: 180,
  customValues: 220
};

const MIN_COLUMN_WIDTH = 72;
const MAX_COLUMN_WIDTH = 360;

function storageKey(projectId: string, suiteId: string, userId: string | null | undefined) {
  return `${STORAGE_PREFIX}:${userId ?? "anonymous"}:${projectId}:${suiteId}`;
}

function legacyStorageKey(projectId: string, suiteId: string) {
  return `${STORAGE_PREFIX}:${projectId}:${suiteId}`;
}

type StoredCaseColumnPreferences = {
  columns: CaseListColumn[];
  widths: CaseColumnWidths;
};

function normalizeColumns(value: unknown): CaseListColumn[] | null {
  if (!Array.isArray(value)) return null;
  const columns = value.filter((item): item is CaseListColumn => allowedColumns.has(item as CaseListColumn));
  return columns.length > 0 ? Array.from(new Set(columns)) : null;
}

function normalizeColumnWidths(value: unknown): CaseColumnWidths {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const row = value as Record<string, unknown>;
  const widths: CaseColumnWidths = {};
  for (const column of allowedColumns) {
    const raw = row[column];
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    widths[column] = Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, Math.round(raw)));
  }
  return widths;
}

function parsePreferences(raw: string | null): StoredCaseColumnPreferences | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const legacyColumns = normalizeColumns(parsed);
    if (legacyColumns) return { columns: legacyColumns, widths: {} };
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const row = parsed as Record<string, unknown>;
    const columns = normalizeColumns(row.columns);
    if (!columns) return null;
    return { columns, widths: normalizeColumnWidths(row.widths) };
  } catch {
    return null;
  }
}

function readPreferences(
  projectId: string,
  suiteId: string,
  userId: string | null | undefined
): StoredCaseColumnPreferences | null {
  if (typeof window === "undefined") return null;
  return (
    parsePreferences(window.localStorage.getItem(storageKey(projectId, suiteId, userId))) ??
    parsePreferences(window.localStorage.getItem(legacyStorageKey(projectId, suiteId)))
  );
}

function normalizeWidthPatch(widths: CaseColumnWidths): CaseColumnWidths {
  return normalizeColumnWidths(widths);
}

export function useCaseColumnPreferences(
  projectId: string,
  suiteId: string,
  userId: string | null | undefined,
  urlColumns: CaseListColumn[],
  hasUrlColumns: boolean
) {
  const [stored, setStored] = useState<StoredCaseColumnPreferences | null>(() =>
    readPreferences(projectId, suiteId, userId)
  );

  useEffect(() => {
    setStored(readPreferences(projectId, suiteId, userId));
  }, [projectId, suiteId, userId]);

  const effectiveColumns = hasUrlColumns ? urlColumns : (stored?.columns ?? urlColumns);
  const columnWidths = { ...defaultCaseColumnWidths, ...(stored?.widths ?? {}) };

  const writePreferences = useCallback(
    (columns: CaseListColumn[], widths: CaseColumnWidths) => {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(
        storageKey(projectId, suiteId, userId),
        JSON.stringify({ columns, widths: normalizeWidthPatch(widths) })
      );
    },
    [projectId, suiteId, userId]
  );

  const persistColumns = useCallback(
    (columns: CaseListColumn[]) => {
      const normalized = Array.from(new Set(columns.filter((column) => allowedColumns.has(column))));
      const next = normalized.length > 0 ? normalized : defaultCaseListColumns;
      writePreferences(next, stored?.widths ?? {});
      setStored({ columns: next, widths: stored?.widths ?? {} });
      return next;
    },
    [stored?.widths, writePreferences]
  );

  const persistColumnWidths = useCallback(
    (widths: CaseColumnWidths) => {
      const next = normalizeWidthPatch(widths);
      writePreferences(effectiveColumns, next);
      setStored({ columns: effectiveColumns, widths: next });
      return { ...defaultCaseColumnWidths, ...next };
    },
    [effectiveColumns, writePreferences]
  );

  return { effectiveColumns, columnWidths, persistColumns, persistColumnWidths, hasStoredPreference: stored != null };
}
