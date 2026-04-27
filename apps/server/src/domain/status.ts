export const testStatuses = ["untested", "passed", "failed", "blocked", "retest"] as const;
export type TestStatus = (typeof testStatuses)[number];

export const testRailStatusMap: Record<number, TestStatus> = {
  1: "passed",
  2: "blocked",
  3: "untested",
  4: "retest",
  5: "failed"
};
