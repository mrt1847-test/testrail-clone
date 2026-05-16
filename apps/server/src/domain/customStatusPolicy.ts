import type { TestStatus } from "./status.js";

export const MAX_PROJECT_CUSTOM_STATUSES = 7;

const defaultFinal = new Set<TestStatus>(["passed", "failed", "blocked"]);

export function resolveStatusFlags(
  canonicalStatus: TestStatus,
  overrides?: { isFinal?: boolean; isUntested?: boolean }
) {
  return {
    isUntested: overrides?.isUntested ?? canonicalStatus === "untested",
    isFinal: overrides?.isFinal ?? defaultFinal.has(canonicalStatus)
  };
}
