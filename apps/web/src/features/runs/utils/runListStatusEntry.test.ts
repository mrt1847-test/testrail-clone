import { describe, expect, it } from "vitest";

import { defaultProjectStatusOptions } from "./projectStatuses";
import {
  runListStatusAriaLabel,
  runListStatusChoices,
  runListStatusTitle,
  shouldOpenResultDialogForListStatus
} from "./runListStatusEntry";

describe("runListStatusEntry", () => {
  const options = defaultProjectStatusOptions();

  it("opens the dialog for Passed as well as evidence-requiring statuses", () => {
    const choices = runListStatusChoices(options, "untested");
    const passed = choices.find((choice) => choice.canonicalStatus === "passed");
    const failed = choices.find((choice) => choice.canonicalStatus === "failed");
    expect(passed && shouldOpenResultDialogForListStatus(passed)).toBe(true);
    expect(failed && shouldOpenResultDialogForListStatus(failed)).toBe(true);
  });

  it("keeps Untested disabled and allows choosing the current status again", () => {
    const choices = runListStatusChoices(options, "passed");
    const untested = choices.find((choice) => choice.canonicalStatus === "untested");
    const currentPassed = choices.find((choice) => choice.canonicalStatus === "passed");
    expect(untested?.disabled).toBe(true);
    expect(untested && shouldOpenResultDialogForListStatus(untested)).toBe(false);
    expect(currentPassed?.isCurrent).toBe(true);
    expect(currentPassed && shouldOpenResultDialogForListStatus(currentPassed)).toBe(true);
  });

  it("does not promise that Passed saves immediately", () => {
    const label = runListStatusAriaLabel("C1");
    const title = runListStatusTitle();
    expect(label).toContain("Opens the result dialog");
    expect(label.toLowerCase()).not.toContain("immediately");
    expect(title.toLowerCase()).not.toContain("immediately");
    expect(title).toContain("not updated until you save");
  });
});
