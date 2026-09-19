import { buildCaseDetailPath } from "../caseRoute";
import type { OverflowMenuGroup } from "../../../shared/ui";

export function caseDetailPanelTitle(caseCode?: string | null, title?: string | null): string {
  const code = caseCode?.trim();
  const name = title?.trim();
  if (code && name) return `${code} ${name}`;
  if (name) return name;
  if (code) return code;
  return "Test case";
}

export function caseDetailUtilityMenuGroups(input: {
  projectId: string;
  caseId: number;
  sectionId: number | null;
  isEditing: boolean;
}): OverflowMenuGroup[] {
  const openPath = buildCaseDetailPath(input.projectId, input.caseId, {
    sectionId: input.sectionId,
    mode: input.isEditing ? "edit" : "view"
  });
  return [
    {
      id: "share",
      label: "Share",
      items: [
        { id: "copy-id", label: "Copy ID" },
        { id: "copy-link", label: "Copy link" }
      ]
    },
    {
      id: "open",
      label: "Open",
      items: [
        { id: "open-page", label: "Open full page", to: openPath },
        {
          id: "print",
          label: "Print view",
          href: `/projects/${input.projectId}/cases/${input.caseId}/print`,
          external: true
        }
      ]
    }
  ];
}
