export const testStatuses = ["untested", "passed", "failed", "blocked", "retest"] as const;
export type TestStatus = (typeof testStatuses)[number];

export const runStatuses = ["open", "closed"] as const;
export type RunStatus = (typeof runStatuses)[number];

export const projectRoles = ["owner", "manager", "tester", "viewer"] as const;
export type ProjectRole = (typeof projectRoles)[number];

export const errorCodes = [
  "VALIDATION_ERROR",
  "INTERNAL_ERROR",
  "TEST_NOT_FOUND",
  "CASE_NOT_FOUND_IN_RUN",
  "NO_CASES_FOUND"
] as const;
export type ErrorCode = (typeof errorCodes)[number];

export type Ok<T> = {
  data: T;
};

export type Paged<T> = {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: Array<{ field?: string; reason: string }>;
    requestId?: string;
  };
};
