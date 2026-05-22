import { buildEntityJumpPath, type EntityJumpKind } from "./entityJump";

export type RecentlyViewedKind = EntityJumpKind;

export type RecentlyViewedEntry = {
  kind: RecentlyViewedKind;
  id: string;
  title: string;
  subtitle?: string | null;
  viewedAt: number;
};

const MAX_ENTRIES = 15;

export function recentlyViewedStorageKey(projectId: string, userId?: string | null) {
  return userId ? `recently-viewed:${userId}.${projectId}` : `recently-viewed:${projectId}`;
}

function readRaw(key: string): RecentlyViewedEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is RecentlyViewedEntry =>
        row != null &&
        typeof row === "object" &&
        (row.kind === "case" || row.kind === "run" || row.kind === "milestone" || row.kind === "plan") &&
        typeof row.id === "string" &&
        typeof row.title === "string" &&
        typeof row.viewedAt === "number"
    );
  } catch {
    return [];
  }
}

export function getRecentlyViewed(projectId: string, userId?: string | null): RecentlyViewedEntry[] {
  if (!projectId) return [];
  const key = recentlyViewedStorageKey(projectId, userId);
  return readRaw(key)
    .filter((row) => row.kind === "case" || row.kind === "run" || row.kind === "milestone")
    .sort((a, b) => b.viewedAt - a.viewedAt)
    .slice(0, MAX_ENTRIES);
}

export function recordRecentlyViewed(
  projectId: string,
  userId: string | null | undefined,
  entry: Omit<RecentlyViewedEntry, "viewedAt">
): void {
  if (typeof window === "undefined" || !projectId || !entry.id.trim() || !entry.title.trim()) return;
  if (entry.kind !== "case" && entry.kind !== "run" && entry.kind !== "milestone") return;

  const key = recentlyViewedStorageKey(projectId, userId);
  const existing = readRaw(key);
  const next: RecentlyViewedEntry = { ...entry, viewedAt: Date.now() };
  const without = existing.filter((row) => !(row.kind === next.kind && row.id === next.id));
  window.localStorage.setItem(key, JSON.stringify([next, ...without].slice(0, MAX_ENTRIES)));
}

export function buildRecentlyViewedPath(projectId: string, entry: RecentlyViewedEntry): string {
  return buildEntityJumpPath(projectId, { kind: entry.kind, id: entry.id });
}

export function filterRecentlyViewed(entries: RecentlyViewedEntry[], query: string): RecentlyViewedEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return entries;
  return entries.filter((entry) => {
    const label = `${entry.kind === "case" ? "C" : entry.kind === "run" ? "R" : "M"}${entry.id}`.toLowerCase();
    return (
      entry.title.toLowerCase().includes(needle) ||
      entry.id.includes(needle) ||
      label.includes(needle) ||
      (entry.subtitle?.toLowerCase().includes(needle) ?? false)
    );
  });
}
