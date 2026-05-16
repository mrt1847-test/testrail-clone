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

/** Canonical case CSV column for external reference IDs (UI label: References). */
export const CASE_CSV_REFS_COLUMN = "refs";

const CASE_CSV_REFS_ALIASES = [CASE_CSV_REFS_COLUMN, "references", "References", "Refs"] as const;

export function caseRefsFromCsvCell(raw: string | undefined): string | null | undefined {
  if (raw === undefined) return undefined;
  return normalizeCaseRefsInput(raw);
}

export function caseRefsCsvAliases(): readonly string[] {
  return CASE_CSV_REFS_ALIASES;
}

export function formatCaseRefsForCsv(value: string | null | undefined): string {
  if (value == null) return "";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "";
}
