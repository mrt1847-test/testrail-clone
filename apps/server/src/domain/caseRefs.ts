/** Split TestRail-style case references (comma/semicolon/newline separated). */
export function parseCaseRefs(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  const tokens = value.split(/[,;\n]+/).map((part) => part.trim()).filter(Boolean);
  return [...new Set(tokens)];
}

export function normalizeCaseRefsInput(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
