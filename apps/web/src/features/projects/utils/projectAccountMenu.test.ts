import { describe, expect, it, vi } from "vitest";

import { buildProjectAccountMenu, inboxMenuLabel } from "./projectAccountMenu";

describe("projectAccountMenu", () => {
  it("keeps named Jump to, Inbox, theme and logout entries", () => {
    const onJumpTo = vi.fn();
    const onSearch = vi.fn();
    const onTheme = vi.fn();
    const onLogout = vi.fn();
    const groups = buildProjectAccountMenu({
      projectId: "2",
      unreadCount: 3,
      theme: "system",
      userEmail: "admin@example.com",
      includeSearch: true,
      onJumpTo,
      onSearch,
      onTheme,
      onLogout
    });

    expect(inboxMenuLabel(3)).toBe("Inbox (3)");
    expect(groups[0]?.items.map((item) => item.id)).toEqual(["search", "jump", "inbox"]);
    expect(groups[0]?.items[2]).toMatchObject({
      label: "Inbox (3)",
      to: "/projects/2/notifications"
    });
    expect(groups[1]?.items.find((item) => item.id === "theme-system")?.selected).toBe(true);
    groups[0]?.items[0]?.onSelect?.();
    groups[0]?.items[1]?.onSelect?.();
    groups[1]?.items[1]?.onSelect?.();
    groups[2]?.items[1]?.onSelect?.();
    expect(onSearch).toHaveBeenCalled();
    expect(onJumpTo).toHaveBeenCalled();
    expect(onTheme).toHaveBeenCalledWith("dark");
    expect(onLogout).toHaveBeenCalled();
    expect(groups[2]?.items[0]).toMatchObject({
      label: "admin@example.com",
      disabled: true
    });
  });
});
