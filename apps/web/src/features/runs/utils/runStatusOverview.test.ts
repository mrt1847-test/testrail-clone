import { describe, expect, it } from "vitest";

import { runCompletionPercent, runPassedPercent, runStatusTotal } from "./runProgressSegments";
import {
  UI040_STATUS_FIXTURE_COUNTS,
  buildRunStatusLegendItems,
  formatRunWidePassedLabel,
  formatRunWideUntestedLabel,
  runRecordedPercent,
  runStatusFilterHint
} from "./runStatusOverview";

describe("runStatusOverview", () => {
  it("uses the whole-run 59-test fixture for pass rate, not recorded-complete", () => {
    const counts = UI040_STATUS_FIXTURE_COUNTS;
    expect(runStatusTotal(counts)).toBe(59);
    expect(runPassedPercent(counts)).toBe(73);
    expect(formatRunWidePassedLabel(counts)).toBe("73% passed");
    expect(formatRunWideUntestedLabel(counts)).toBe("9 / 59 untested");
    expect(runRecordedPercent(counts)).toBe(85);
    expect(runCompletionPercent(counts)).toBe(85);
    expect(runRecordedPercent(counts)).not.toBe(runPassedPercent(counts));
  });

  it("keeps zero-count statuses in the legend and All statuses as a filter clear", () => {
    const items = buildRunStatusLegendItems({
      passed: 2,
      failed: 0,
      blocked: 0,
      retest: 0,
      untested: 0
    });
    expect(items.find((item) => item.key === "failed")).toMatchObject({ label: "Failed", count: 0, percent: 0 });
    expect(items.at(-1)).toMatchObject({ key: "all", label: "All statuses", count: 2 });
  });

  it("explains run-wide counts when the list is filtered", () => {
    expect(
      runStatusFilterHint({
        activeStatus: "failed",
        counts: UI040_STATUS_FIXTURE_COUNTS,
        visibleCount: 0
      })
    ).toBe("Showing Failed. Run-wide Failed: 2 of 59. 0 in the current list.");
    expect(runStatusFilterHint({ activeStatus: "all", counts: UI040_STATUS_FIXTURE_COUNTS })).toBeNull();
  });

  it("treats an empty run as 0 tests instead of 100%", () => {
    const empty = { passed: 0, failed: 0, blocked: 0, retest: 0, untested: 0 };
    expect(formatRunWidePassedLabel(empty)).toBe("0 tests");
    expect(runPassedPercent(empty)).toBe(0);
    expect(runRecordedPercent(empty)).toBe(0);
  });
});
