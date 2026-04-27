export const errorCodes = [
  "VALIDATION_ERROR",
  "INTERNAL_ERROR",
  "TEST_NOT_FOUND",
  "CASE_NOT_FOUND_IN_RUN",
  "NO_CASES_FOUND"
] as const;

export type ErrorCode = (typeof errorCodes)[number];
