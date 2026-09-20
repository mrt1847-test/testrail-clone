import { describe, expect, it } from "vitest";

import { resultDialogFooterActions } from "./resultEntryDialogModel";
import { resultSaveShouldAdvance } from "./resultSaveAdvanceIntent";

describe("resultSaveShouldAdvance", () => {
  it("keeps Add Result on the current test even when a next id exists", () => {
    expect(resultSaveShouldAdvance({ action: "add-result", nextTestId: "7" })).toBe(false);
  });

  it("advances only for Save & Next when a next visible test exists", () => {
    expect(resultSaveShouldAdvance({ action: "save-and-next", nextTestId: "7" })).toBe(true);
    expect(resultSaveShouldAdvance({ action: "save-and-next", nextTestId: null })).toBe(false);
  });

  it("keeps Save & Next as an explicit split action, not the primary button", () => {
    expect(resultDialogFooterActions()).toEqual([
      { id: "add-result", kind: "primary", label: "Add Result" },
      { id: "save-and-next", kind: "split", label: "Save & Next" },
      { id: "cancel", kind: "text", label: "Cancel" }
    ]);
  });
});
