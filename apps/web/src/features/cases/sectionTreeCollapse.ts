export function sectionTreeCollapseStorageKey(projectId: string, suiteId: string) {
  return `cases:section-tree-collapsed:${projectId}:${suiteId}`;
}

export function readCollapsedSectionIds(projectId: string, suiteId: string): Set<number> {
  if (!projectId || !suiteId) return new Set();
  try {
    const raw = window.localStorage.getItem(sectionTreeCollapseStorageKey(projectId, suiteId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is number => Number.isInteger(id) && id > 0));
  } catch {
    return new Set();
  }
}

export function writeCollapsedSectionIds(projectId: string, suiteId: string, ids: Set<number>) {
  if (!projectId || !suiteId) return;
  try {
    window.localStorage.setItem(
      sectionTreeCollapseStorageKey(projectId, suiteId),
      JSON.stringify([...ids])
    );
  } catch {
    /* ignore quota / private mode */
  }
}
