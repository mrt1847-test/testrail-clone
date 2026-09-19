const PRIMARY_TAB_SEGMENTS = new Set([
  "cases",
  "runs",
  "milestones",
  "plans",
  "reports",
  "my-tests",
  "settings"
]);

/** True for Overview and top-level project tabs, where tabs already show the current place. */
export function isPrimaryProjectTabPath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "projects" || !parts[1]) return false;
  if (parts.length === 2) return true;
  return parts.length === 3 && PRIMARY_TAB_SEGMENTS.has(parts[2]!);
}
