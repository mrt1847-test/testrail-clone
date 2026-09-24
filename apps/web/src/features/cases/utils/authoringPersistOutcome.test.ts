import { describe, expect, it } from "vitest";

import {
  authoringFailureKind,
  authoringFailureSummary,
  authoringLeaveDescription,
  mergeDraftsForRetry,
  resumeFromOutcome,
  shouldCreateNewCase,
  uniqueSavedStepIds,
  emptyAuthoringOutcome
} from "./authoringPersistOutcome";

describe("authoringFailureKind", () => {
  it("distinguishes body, first step, middle step, move, and conflict (CA-F04)", () => {
    expect(authoringFailureKind({ bodySaved: false, failedStepIndex: null })).toBe("body");
    expect(authoringFailureKind({ bodySaved: true, failedStepIndex: 0 })).toBe("steps-first");
    expect(authoringFailureKind({ bodySaved: true, failedStepIndex: 1 })).toBe("steps-middle");
    expect(authoringFailureKind({ bodySaved: true, moveFailed: true, failedStepIndex: null })).toBe("move");
    expect(authoringFailureKind({ bodySaved: false, conflict: true, failedStepIndex: null })).toBe("conflict");
  });
});

describe("authoringFailureSummary", () => {
  it("does not pretend a partial save was complete", () => {
    expect(authoringFailureSummary({ failureKind: "body" })).toMatch(/nothing was stored/i);
    expect(authoringFailureSummary({ failureKind: "steps-first", caseCode: "C12" })).toMatch(/C12 was saved.*steps/i);
    expect(
      authoringFailureSummary({ failureKind: "steps-middle", caseCode: "C12", failedStepNumber: 2, stepCount: 3 })
    ).toMatch(/step 2 of 3/i);
    expect(authoringFailureSummary({ failureKind: "move", caseCode: "C12" })).toMatch(/moved/i);
    expect(authoringFailureSummary({ failureKind: "conflict" })).toMatch(/changed after you opened/i);
  });
});

describe("retry without duplicating saved work", () => {
  it("does not create a second case after the body already saved", () => {
    expect(shouldCreateNewCase(null)).toBe(true);
    expect(
      shouldCreateNewCase({
        caseId: 12,
        caseCode: "C12",
        bodySaved: true,
        moved: true,
        completedDrafts: [{ key: "a", id: 40, description: "Open", expected: "" }],
        savedStepIds: [40],
        failureKind: "steps-middle"
      })
    ).toBe(false);
  });

  it("reuses saved step ids so a second retry does not insert duplicates", () => {
    const current = [
      { key: "a", description: "Open settings first", expected: "Settings still open" },
      { key: "b", description: "Change language", expected: "Language updates" },
      { key: "c", description: "Save profile", expected: "Profile saved" }
    ];
    const merged = mergeDraftsForRetry(current, {
      caseId: 12,
      caseCode: "C12",
      bodySaved: true,
      moved: true,
      completedDrafts: [{ key: "a", id: 40, description: "Open settings first", expected: "Settings still open" }],
      savedStepIds: [40],
      failureKind: "steps-middle"
    });
    expect(merged[0]?.id).toBe(40);
    expect(merged[1]?.id).toBeUndefined();
    expect(merged[2]?.id).toBeUndefined();
    expect(uniqueSavedStepIds([40, 40, 41])).toEqual([40, 41]);
  });

  it("does not mix case A's resume into case B", () => {
    const a = emptyAuthoringOutcome({
      ok: false,
      caseId: 1,
      caseCode: "C1",
      bodySaved: true,
      failureKind: "steps-first",
      savedStepIds: [9]
    });
    const resumeA = resumeFromOutcome(a);
    expect(resumeA?.caseId).toBe(1);
    expect(resumeFromOutcome(emptyAuthoringOutcome({ caseId: 2, bodySaved: false }))).toBeNull();
  });
});

describe("authoringLeaveDescription", () => {
  it("explains already-saved work versus the draft to discard", () => {
    expect(
      authoringLeaveDescription({ mode: "add", bodySaved: true, stepsComplete: false, caseCode: "C12" })
    ).toBe("C12 is already saved. Unsaved steps will be lost.");
    expect(
      authoringLeaveDescription({
        mode: "add",
        bodySaved: true,
        stepsComplete: true,
        caseCode: "C12",
        hasPendingAttachments: true
      })
    ).toBe("C12 is already saved. Staged images that were not uploaded will be lost.");
    expect(authoringLeaveDescription({ mode: "add", bodySaved: false, stepsComplete: false })).toBe(
      "Your changes to this new test case will be lost."
    );
    expect(authoringLeaveDescription({ mode: "edit", bodySaved: false, stepsComplete: true })).toBe(
      "Your unsaved test case changes will be lost."
    );
  });
});
