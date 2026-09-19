import { describe, expect, it } from "vitest";

import { formatResultDialogTitle, isResultComposerDirty, resultDialogFooterActions, shouldAssignAfterResult } from "./resultEntryDialogModel";

describe("formatResultDialogTitle", () => {
  it("names the target test with case code and title", () => {
    expect(formatResultDialogTitle("C12", "Login succeeds")).toBe("Add result · C12 Login succeeds");
  });

  it("falls back when the case code is missing", () => {
    expect(formatResultDialogTitle("  ", "Logout")).toBe("Add result · Logout");
  });
});

describe("resultDialogFooterActions", () => {
  it("keeps Add Result primary, Save & Next as a split, and Cancel as text", () => {
    expect(resultDialogFooterActions()).toEqual([
      { id: "add-result", kind: "primary", label: "Add Result" },
      { id: "save-and-next", kind: "split", label: "Save & Next" },
      { id: "cancel", kind: "text", label: "Cancel" }
    ]);
  });
});

describe("shouldAssignAfterResult", () => {
  it("does not assign when the draft is omitted or unchanged", () => {
    expect(shouldAssignAfterResult({ currentAssignedTo: "u1", draftAssignedTo: undefined })).toBe(false);
    expect(shouldAssignAfterResult({ currentAssignedTo: "u1", draftAssignedTo: "u1" })).toBe(false);
    expect(shouldAssignAfterResult({ currentAssignedTo: null, draftAssignedTo: null })).toBe(false);
  });

  it("assigns when the draft differs from the current test assignee", () => {
    expect(shouldAssignAfterResult({ currentAssignedTo: null, draftAssignedTo: "u1" })).toBe(true);
    expect(shouldAssignAfterResult({ currentAssignedTo: "u1", draftAssignedTo: null })).toBe(true);
  });
});

describe("isResultComposerDirty", () => {
  const clean = {
    statusChanged: false,
    comment: "",
    actualResult: "",
    stagedFileCount: 0,
    elapsed: "",
    version: "",
    defects: [] as string[],
    customValues: {}
  };

  it("is clean when nothing was entered", () => {
    expect(isResultComposerDirty(clean)).toBe(false);
  });

  it("is dirty for comments, files, a status change, or assignee draft", () => {
    expect(isResultComposerDirty({ ...clean, comment: "timeout" })).toBe(true);
    expect(isResultComposerDirty({ ...clean, stagedFileCount: 1 })).toBe(true);
    expect(isResultComposerDirty({ ...clean, statusChanged: true })).toBe(true);
    expect(isResultComposerDirty({ ...clean, assignedToChanged: true })).toBe(true);
  });
});
