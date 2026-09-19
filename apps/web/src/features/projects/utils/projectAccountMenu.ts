import type { OverflowMenuGroup } from "../../../shared/ui";
import type { ThemePreference } from "../../../shared/theme/themePreference";

export function inboxMenuLabel(unreadCount?: number) {
  return unreadCount ? `Inbox (${unreadCount})` : "Inbox";
}

export function buildProjectAccountMenu(input: {
  projectId: string;
  unreadCount?: number;
  theme: ThemePreference;
  userEmail?: string;
  includeSearch?: boolean;
  onJumpTo: () => void;
  onSearch?: () => void;
  onTheme: (value: ThemePreference) => void;
  onLogout: () => void;
}): OverflowMenuGroup[] {
  const workspaceItems = [
    ...(input.includeSearch
      ? [
          {
            id: "search",
            label: "Search project",
            onSelect: () => input.onSearch?.()
          }
        ]
      : []),
    {
      id: "jump",
      label: "Jump to…",
      description: "Ctrl+K",
      onSelect: input.onJumpTo
    },
    {
      id: "inbox",
      label: inboxMenuLabel(input.unreadCount),
      to: `/projects/${input.projectId}/notifications`
    }
  ];

  return [
    {
      id: "workspace",
      label: "Workspace",
      items: workspaceItems
    },
    {
      id: "appearance",
      label: "Color theme",
      items: [
        {
          id: "theme-light",
          label: "Light",
          selected: input.theme === "light",
          onSelect: () => input.onTheme("light")
        },
        {
          id: "theme-dark",
          label: "Dark",
          selected: input.theme === "dark",
          onSelect: () => input.onTheme("dark")
        },
        {
          id: "theme-system",
          label: "System",
          selected: input.theme === "system",
          onSelect: () => input.onTheme("system")
        }
      ]
    },
    {
      id: "session",
      label: "Account",
      items: [
        {
          id: "identity",
          label: input.userEmail ?? "Signed in",
          disabled: true
        },
        {
          id: "logout",
          label: "Logout",
          onSelect: input.onLogout
        }
      ]
    }
  ];
}
