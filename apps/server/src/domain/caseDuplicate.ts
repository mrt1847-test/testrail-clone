export function buildDuplicateCaseTitle(sourceTitle: string): string {
  const trimmed = sourceTitle.trim();
  if (trimmed.length === 0) return "Untitled (copy)";
  if (/\(copy\)$/i.test(trimmed)) return trimmed;
  return `${trimmed} (copy)`;
}
