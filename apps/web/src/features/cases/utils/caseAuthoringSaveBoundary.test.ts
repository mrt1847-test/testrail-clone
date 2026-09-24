import { describe, expect, it } from "vitest";

import {
  authoringStepsComplete,
  decideAuthoringSaveRefresh,
  shouldKeepAuthoringSaveBusy
} from "./caseAuthoringSaveBoundary";

describe("decideAuthoringSaveRefresh", () => {
  it("holds refresh while only the case body has saved (CA-F03)", () => {
    expect(
      decideAuthoringSaveRefresh({
        bodyComplete: true,
        stepsComplete: false,
        saveGeneration: 1,
        incomingGeneration: 1
      })
    ).toBe("hold");
    expect(shouldKeepAuthoringSaveBusy({ bodyComplete: true, stepsComplete: false })).toBe(true);
  });

  it("refreshes once after body and steps both complete", () => {
    expect(
      decideAuthoringSaveRefresh({
        bodyComplete: true,
        stepsComplete: true,
        saveGeneration: 2,
        incomingGeneration: 2
      })
    ).toBe("refresh");
    expect(shouldKeepAuthoringSaveBusy({ bodyComplete: true, stepsComplete: true })).toBe(false);
    expect(authoringStepsComplete(null)).toBe(true);
    expect(authoringStepsComplete("Could not save steps.")).toBe(false);
  });

  it("ignores a late A response after B has become the active save", () => {
    expect(
      decideAuthoringSaveRefresh({
        bodyComplete: true,
        stepsComplete: true,
        saveGeneration: 2,
        incomingGeneration: 1
      })
    ).toBe("ignore-stale");
  });
});
