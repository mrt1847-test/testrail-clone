import { describe, expect, it } from "vitest";

import {
  runTestRowClassName,
  runTestTitleClassName,
  shouldExpandRunSchedulePanel,
  showInlineAssigneeActions
} from "./runExecutionDensity";

describe("runExecutionDensity", () => {
  it("keeps an empty schedule collapsed in the default viewport", () => {
    expect(shouldExpandRunSchedulePanel({})).toBe(false);
    expect(shouldExpandRunSchedulePanel({ startedAt: null, dueOn: null, warningCount: 0 })).toBe(false);
  });

  it("expands schedule only when dates or warnings exist", () => {
    expect(shouldExpandRunSchedulePanel({ dueOn: "2026-09-18" })).toBe(true);
    expect(shouldExpandRunSchedulePanel({ warningCount: 1 })).toBe(true);
    expect(shouldExpandRunSchedulePanel({ closedAt: "2026-09-18T00:00:00.000Z" })).toBe(true);
  });

  it("hides inline assignee actions in compact density so rows stay one line", () => {
    expect(showInlineAssigneeActions("compact")).toBe(false);
    expect(showInlineAssigneeActions("comfortable")).toBe(true);
  });

  it("distinguishes the active row by weight and a neutral edge, not color alone", () => {
    expect(runTestTitleClassName(true)).toContain("font-semibold");
    expect(runTestTitleClassName(false)).toContain("font-normal");
    expect(runTestTitleClassName(true)).toContain("max-w-0");
    expect(runTestTitleClassName(true)).not.toContain("max-w-[24rem]");
    expect(runTestRowClassName(true)).toContain("border-l-slate-900");
    expect(runTestRowClassName(false)).toContain("border-l-transparent");
  });
});
