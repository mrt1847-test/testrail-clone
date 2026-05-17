import { describe, expect, it } from "vitest";

import { formatDurationSeconds, parseDurationToSeconds, sumDurationSeconds } from "./timeTracking.js";

describe("timeTracking", () => {
  it("parses TestRail-style duration strings", () => {
    expect(parseDurationToSeconds("5")).toBe(300);
    expect(parseDurationToSeconds("1h 20m")).toBe(4800);
    expect(parseDurationToSeconds("90s")).toBe(90);
    expect(parseDurationToSeconds("01:30")).toBe(90);
    expect(parseDurationToSeconds("1:02:03")).toBe(3723);
    expect(parseDurationToSeconds("later")).toBeNull();
  });

  it("formats and sums durations for reports", () => {
    expect(formatDurationSeconds(3723)).toBe("1h 2m 3s");
    expect(sumDurationSeconds(["5m", "30s", null])).toBe(330);
  });
});
