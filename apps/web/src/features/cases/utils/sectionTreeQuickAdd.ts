export function normalizeQuickAddCaseTitle(raw: string): string | null {
  const title = raw.trim();
  return title.length > 0 ? title : null;
}
