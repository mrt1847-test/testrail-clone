import { describe, expect, it } from "vitest";

import {
  decideUnsavedLeave,
  discardedBrowserBackDelta,
  panelNavigationDiscardsDraft,
  shouldGuardPanelNavigation,
  shouldInterceptInAppAnchorNavigation,
  shouldWarnBeforeUnload
} from "./unsavedDraftGuard";

describe("decideUnsavedLeave", () => {
  it("confirms panel Close and other leave paths only when the draft is dirty", () => {
    expect(decideUnsavedLeave({ dirty: true, saving: false })).toBe("confirm");
    expect(decideUnsavedLeave({ dirty: false, saving: false })).toBe("proceed");
  });

  it("does not warn after a clean view or a successful save", () => {
    expect(shouldWarnBeforeUnload({ dirty: false, saving: false })).toBe(false);
    expect(decideUnsavedLeave({ dirty: false, saving: false })).toBe("proceed");
  });

  it("keeps the in-flight save target instead of switching cases", () => {
    expect(decideUnsavedLeave({ dirty: true, saving: true })).toBe("block-saving");
    expect(decideUnsavedLeave({ dirty: false, saving: true })).toBe("block-saving");
    expect(shouldWarnBeforeUnload({ dirty: true, saving: true })).toBe(false);
  });
});

describe("panelNavigationDiscardsDraft", () => {
  it("treats CA-F02 Close and leaving edit as a draft discard path", () => {
    expect(
      panelNavigationDiscardsDraft({
        panelMode: "edit",
        currentCaseId: 6,
        nextCaseId: null,
        nextMode: "view"
      })
    ).toBe(true);
  });

  it("treats another row or leaving edit for read as a discard path", () => {
    expect(
      panelNavigationDiscardsDraft({
        panelMode: "edit",
        currentCaseId: 6,
        nextCaseId: 7,
        nextMode: "view"
      })
    ).toBe(true);
    expect(
      panelNavigationDiscardsDraft({
        panelMode: "edit",
        currentCaseId: 6,
        nextCaseId: 6,
        nextMode: "view"
      })
    ).toBe(true);
  });

  it("does not treat a clean view Close or staying in the same edit as discard", () => {
    expect(
      panelNavigationDiscardsDraft({
        panelMode: "view",
        currentCaseId: 6,
        nextCaseId: null,
        nextMode: "view"
      })
    ).toBe(false);
    expect(
      panelNavigationDiscardsDraft({
        panelMode: "edit",
        currentCaseId: 6,
        nextCaseId: 6,
        nextMode: "edit"
      })
    ).toBe(false);
  });

  it("skips the discard path after a completed save", () => {
    expect(
      shouldGuardPanelNavigation({
        panelMode: "edit",
        currentCaseId: 6,
        nextCaseId: 6,
        nextMode: "view",
        skipGuard: true
      })
    ).toBe(false);
  });

  it("still treats leaving edit as a discard unless skipGuard is set", () => {
    expect(
      shouldGuardPanelNavigation({
        panelMode: "edit",
        currentCaseId: 6,
        nextCaseId: 6,
        nextMode: "view"
      })
    ).toBe(true);
  });
});

describe("shouldInterceptInAppAnchorNavigation", () => {
  const base = {
    defaultPrevented: false,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    href: "http://localhost:5173/projects/1/runs",
    download: false,
    target: "",
    currentOrigin: "http://localhost:5173",
    currentLocation: "/projects/1/cases/new?sectionId=2"
  };

  it("blocks top-nav same-origin links so Keep/Discard can run", () => {
    expect(shouldInterceptInAppAnchorNavigation(base)).toBe("/projects/1/runs");
  });

  it("leaves modified clicks, downloads, and external links alone", () => {
    expect(shouldInterceptInAppAnchorNavigation({ ...base, ctrlKey: true })).toBeNull();
    expect(shouldInterceptInAppAnchorNavigation({ ...base, download: true })).toBeNull();
    expect(
      shouldInterceptInAppAnchorNavigation({
        ...base,
        href: "https://example.com/runs",
        currentOrigin: "http://localhost:5173"
      })
    ).toBeNull();
    expect(
      shouldInterceptInAppAnchorNavigation({
        ...base,
        href: "http://localhost:5173/projects/1/cases/new?sectionId=2",
        currentLocation: "/projects/1/cases/new?sectionId=2"
      })
    ).toBeNull();
  });
});

describe("discardedBrowserBackDelta", () => {
  it("performs the intended Back once after Keep/Discard intercept", () => {
    expect(discardedBrowserBackDelta()).toBe(-2);
  });
});
