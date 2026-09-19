import type { OverflowMenuGroup } from "../../../shared/ui";

/** Settings hub overflow: administrative destinations, not the page's save actions. */
export const SETTINGS_ADMIN_MENU_LABEL = "Administration";

export function settingsAdminMenuGroups(projectId: string): OverflowMenuGroup[] {
  const base = `/projects/${projectId}`;
  return [
    {
      id: "access",
      label: "Access",
      items: [
        { id: "members", label: "Members & roles", to: `${base}/settings/members` },
        { id: "roles", label: "Custom roles", to: `${base}/settings/custom-roles` }
      ]
    },
    {
      id: "case-data",
      label: "Case data",
      items: [
        { id: "fields", label: "Custom fields", to: `${base}/settings/custom-fields` },
        { id: "statuses", label: "Custom statuses", to: `${base}/settings/statuses` },
        { id: "templates", label: "Case templates", to: `${base}/settings/templates` }
      ]
    },
    {
      id: "integrations",
      label: "Integrations",
      items: [
        { id: "tokens", label: "API tokens", to: `${base}/settings/tokens` },
        { id: "api-docs", label: "API reference", to: `${base}/settings/api-docs` },
        { id: "webhooks", label: "Webhooks", to: `${base}/settings/webhooks` },
        { id: "email", label: "Email outbox", to: `${base}/settings/email-outbox` },
        { id: "defects", label: "Defect integration", to: `${base}/settings/defect-integration` }
      ]
    },
    {
      id: "activity",
      label: "Activity",
      items: [
        { id: "audit", label: "Audit logs", to: `${base}/settings/audit-logs` },
        { id: "notifications", label: "Notifications", to: `${base}/notifications` }
      ]
    }
  ];
}
