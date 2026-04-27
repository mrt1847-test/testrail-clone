import type { TestStatus } from "./status.js";

export const testRailStatusMap: Record<number, TestStatus> = {
  1: "passed",
  2: "blocked",
  3: "untested",
  4: "retest",
  5: "failed"
};
