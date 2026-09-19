import { describe, expect, it, vi } from "vitest";

import { cycleModalFocus, resolveMenuTrigger } from "./modalFocus";

function button(id: string) {
  return { id, focus: vi.fn() } as unknown as HTMLElement;
}

describe("cycleModalFocus", () => {
  it("moves from the last control to the first on Tab", () => {
    const first = button("first");
    const last = button("last");
    const preventDefault = vi.fn();
    const cycled = cycleModalFocus([first, last], { key: "Tab", shiftKey: false, preventDefault }, last);
    expect(cycled).toBe(true);
    expect(preventDefault).toHaveBeenCalled();
    expect(first.focus).toHaveBeenCalled();
    expect(last.focus).not.toHaveBeenCalled();
  });

  it("moves from the first control to the last on Shift+Tab", () => {
    const first = button("first");
    const last = button("last");
    const preventDefault = vi.fn();
    const cycled = cycleModalFocus([first, last], { key: "Tab", shiftKey: true, preventDefault }, first);
    expect(cycled).toBe(true);
    expect(preventDefault).toHaveBeenCalled();
    expect(last.focus).toHaveBeenCalled();
  });

  it("does not cycle for other keys", () => {
    const first = button("first");
    const preventDefault = vi.fn();
    expect(cycleModalFocus([first], { key: "Escape", shiftKey: false, preventDefault }, first)).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
  });
});

describe("resolveMenuTrigger", () => {
  it("returns the button whose name matches the menu label", () => {
    const trigger = { id: "actions" };
    const menuItem = {
      closest: (selector: string) =>
        selector === "[role='menu']"
          ? {
              getAttribute: (name: string) => (name === "aria-label" ? "Authentication actions" : null),
              parentElement: { querySelector: () => null }
            }
          : null
    };
    const found = resolveMenuTrigger(menuItem, (selector) =>
      selector === 'button[aria-label="Authentication actions"]' ? trigger : null
    );
    expect(found).toBe(trigger);
  });
});
