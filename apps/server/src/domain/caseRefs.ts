import { AppError } from "../common/errors/appError.js";

export const CASE_REFS_MAX_LENGTH = 4000;
export const CASE_REFS_MAX_TOKENS = 100;

/** Split TestRail-style case references (comma/semicolon/newline separated). */
export function parseCaseRefs(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  const tokens = value.split(/[,;\n]+/).map((part) => part.trim()).filter(Boolean);
  return [...new Set(tokens)];
}

export function assertCaseRefsValid(value: string | null | undefined): void {
  if (value == null || value.trim().length === 0) return;
  if (value.length > CASE_REFS_MAX_LENGTH) {
    throw new Error("CASE_REFS_TOO_LONG");
  }
  const tokens = parseCaseRefs(value);
  if (tokens.length > CASE_REFS_MAX_TOKENS) {
    throw new Error("CASE_REFS_TOO_MANY");
  }
  for (const token of tokens) {
    if (token.length > 255) {
      throw new Error("CASE_REFS_TOKEN_TOO_LONG");
    }
  }
}

export function normalizeCaseRefsInput(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const tokens = parseCaseRefs(trimmed);
  return tokens.length > 0 ? tokens.join(", ") : null;
}

export function prepareCaseRefsInput(value: string | null | undefined): string | null {
  assertCaseRefsValid(value);
  return normalizeCaseRefsInput(value);
}

export function caseRefsValidationError(error: unknown): AppError | null {
  if (!(error instanceof Error)) return null;
  switch (error.message) {
    case "CASE_REFS_TOO_LONG":
      return new AppError("VALIDATION_ERROR", `refs must be at most ${CASE_REFS_MAX_LENGTH} characters`, 400);
    case "CASE_REFS_TOO_MANY":
      return new AppError("VALIDATION_ERROR", `refs may contain at most ${CASE_REFS_MAX_TOKENS} IDs`, 400);
    case "CASE_REFS_TOKEN_TOO_LONG":
      return new AppError("VALIDATION_ERROR", "each reference ID must be at most 255 characters", 400);
    default:
      return null;
  }
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
