import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";

export const MODAL_FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function listModalFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE_SELECTOR)).filter(
    (element) => element.offsetParent !== null
  );
}

export function cycleModalFocus(
  focusable: readonly HTMLElement[],
  event: Pick<KeyboardEvent, "key" | "shiftKey" | "preventDefault">,
  activeElement: Element | null = typeof document === "undefined" ? null : document.activeElement
): boolean {
  if (event.key !== "Tab" || focusable.length === 0) return false;
  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  if (event.shiftKey && activeElement === first) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && activeElement === last) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

export function trapModalTab(
  container: HTMLElement | null,
  event: Pick<KeyboardEvent, "key" | "shiftKey" | "preventDefault"> | ReactKeyboardEvent<HTMLElement>
): boolean {
  return cycleModalFocus(listModalFocusable(container), event);
}

export function resolveMenuTrigger(
  menuItem: { closest: (selector: string) => { getAttribute: (name: string) => string | null; parentElement: { querySelector: (selector: string) => unknown } | null } | null },
  querySelector: (selector: string) => unknown = (selector) =>
    typeof document === "undefined" ? null : document.querySelector(selector)
): HTMLElement | null {
  const menu = menuItem.closest("[role='menu']");
  if (!menu) return null;
  const menuLabel = menu.getAttribute("aria-label");
  if (menuLabel) {
    const trigger = querySelector(`button[aria-label="${menuLabel.replace(/"/g, '\\"')}"]`);
    if (trigger) return trigger as HTMLElement;
  }
  const local = menu.parentElement?.querySelector("button[aria-expanded], button[aria-haspopup]");
  return local ? (local as HTMLElement) : null;
}

let pendingMenuTrigger: HTMLElement | null = null;
let pendingMenuTriggerSelector: string | null = null;
/** Survives React Strict Mode double-invoke of useModalFocus take/clear. */
let lastMenuTriggerSelector: string | null = null;

export function rememberModalRestoreTarget(element: HTMLElement | null) {
  if (!element?.isConnected) {
    pendingMenuTrigger = null;
    pendingMenuTriggerSelector = null;
    return;
  }
  pendingMenuTrigger = element;
  const aria = element.getAttribute("aria-label");
  pendingMenuTriggerSelector = aria
    ? `button[aria-label="${aria.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`
    : null;
  if (pendingMenuTriggerSelector) {
    lastMenuTriggerSelector = pendingMenuTriggerSelector;
  }
}

function rememberMenuTrigger(event: Event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const item = target.closest("[role='menuitem'], [role='menuitemcheckbox']");
  if (!item) return;
  const trigger = resolveMenuTrigger(item);
  if (trigger) rememberModalRestoreTarget(trigger);
}

if (typeof document !== "undefined") {
  document.addEventListener("click", rememberMenuTrigger, true);
}

function resolvePendingMenuTrigger(): HTMLElement | null {
  if (pendingMenuTrigger?.isConnected) return pendingMenuTrigger;
  const selector = pendingMenuTriggerSelector ?? lastMenuTriggerSelector;
  if (selector && typeof document !== "undefined") {
    const found = document.querySelector(selector);
    if (found instanceof HTMLElement) return found;
  }
  return null;
}

function takeRestoreTarget(): HTMLElement | null {
  const remembered = resolvePendingMenuTrigger();
  pendingMenuTrigger = null;
  pendingMenuTriggerSelector = null;
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const activeRole = active?.getAttribute("role");
  const activeIsMenuItem = activeRole === "menuitem" || activeRole === "menuitemcheckbox";
  if (active && active.isConnected && active !== document.body && !activeIsMenuItem) {
    // Prefer a remembered menu trigger over transient dialog/menu focus during Strict Mode remounts.
    if (remembered && active.closest("[data-shared-dialog], [role='menu']")) {
      return remembered;
    }
    return active;
  }
  return remembered;
}

function selectorForFocusTarget(element: HTMLElement | null): string | null {
  if (element) {
    const aria = element.getAttribute("aria-label");
    if (aria) {
      return `button[aria-label="${aria.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
    }
    if (element.id) return `[id="${element.id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
  }
  return lastMenuTriggerSelector;
}

function restoreFocusTarget(element: HTMLElement | null, selector: string | null) {
  const tryFocus = () => {
    const connected = element?.isConnected ? element : null;
    const bySelector =
      selector && typeof document !== "undefined" ? document.querySelector(selector) : null;
    const target =
      connected ?? (bySelector instanceof HTMLElement ? bySelector : null);
    if (!target) return false;
    target.focus();
    return document.activeElement === target;
  };
  // Wait until #root inert is cleared (Dialog effect cleanup), then retry briefly.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (tryFocus()) return;
      window.setTimeout(() => {
        if (tryFocus()) return;
        window.setTimeout(() => {
          tryFocus();
        }, 50);
      }, 0);
    });
  });
}

type UseModalFocusInput = {
  open: boolean;
  containerRef: { current: HTMLElement | null };
  initialFocusRef?: { current: HTMLElement | null };
  onClose: () => void;
  closeOnEscape?: boolean;
};

export function useModalFocus({
  open,
  containerRef,
  initialFocusRef,
  onClose,
  closeOnEscape = true
}: UseModalFocusInput) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closeOnEscapeRef = useRef(closeOnEscape);
  closeOnEscapeRef.current = closeOnEscape;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = takeRestoreTarget();
    const restoreSelector = selectorForFocusTarget(previouslyFocused);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      const initial = initialFocusRef?.current ?? listModalFocusable(containerRef.current)[0] ?? null;
      initial?.focus();
    });
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !closeOnEscapeRef.current) return;
      event.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
      restoreFocusTarget(previouslyFocused, restoreSelector);
    };
  }, [containerRef, initialFocusRef, open]);
}
