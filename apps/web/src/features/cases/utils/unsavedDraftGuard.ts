export type UnsavedLeaveDecision = "proceed" | "confirm" | "block-saving";

/** Decide whether a leave attempt may proceed, must confirm, or must wait for save. */
export function decideUnsavedLeave(input: { dirty: boolean; saving: boolean }): UnsavedLeaveDecision {
  if (input.saving) return "block-saving";
  if (input.dirty) return "confirm";
  return "proceed";
}

export function shouldWarnBeforeUnload(input: { dirty: boolean; saving: boolean }): boolean {
  return decideUnsavedLeave(input) === "confirm";
}

/** Close / other row / read mode while the panel is in edit. Dirty is checked separately. */
export function panelNavigationDiscardsDraft(input: {
  panelMode: "view" | "edit";
  currentCaseId: number | null;
  nextCaseId: number | null;
  nextMode: "view" | "edit";
}): boolean {
  if (input.panelMode !== "edit") return false;
  return input.nextCaseId !== input.currentCaseId || input.nextMode !== "edit";
}

export function shouldGuardPanelNavigation(
  input: Parameters<typeof panelNavigationDiscardsDraft>[0] & { skipGuard?: boolean }
): boolean {
  if (input.skipGuard) return false;
  return panelNavigationDiscardsDraft(input);
}

export function shouldInterceptInAppAnchorNavigation(input: {
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  href: string | null;
  download: boolean;
  target: string;
  currentOrigin: string;
  currentLocation: string;
}): string | null {
  if (input.defaultPrevented || input.button !== 0) return null;
  if (input.metaKey || input.ctrlKey || input.shiftKey || input.altKey) return null;
  if (!input.href || input.download) return null;
  if (input.target && input.target !== "" && input.target !== "_self") return null;
  let url: URL;
  try {
    url = new URL(input.href, input.currentOrigin);
  } catch {
    return null;
  }
  if (url.origin !== input.currentOrigin) return null;
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (next === input.currentLocation) return null;
  return next;
}

/**
 * After a same-URL sentinel intercepts Back and we re-push the draft URL,
 * Discard must skip both sentinels to reach the previous real page.
 */
export function discardedBrowserBackDelta(): number {
  return -2;
}
