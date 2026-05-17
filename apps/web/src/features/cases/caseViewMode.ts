export type CaseViewMode = "panel" | "page";

export const CASE_VIEW_MODE_STORAGE_KEY = "qa-rail.case-view-mode";

export function readCaseViewMode(): CaseViewMode {
  try {
    const value = localStorage.getItem(CASE_VIEW_MODE_STORAGE_KEY);
    if (value === "page" || value === "panel") return value;
  } catch {
    /* ignore */
  }
  return "panel";
}

export function writeCaseViewMode(mode: CaseViewMode): void {
  try {
    localStorage.setItem(CASE_VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}
