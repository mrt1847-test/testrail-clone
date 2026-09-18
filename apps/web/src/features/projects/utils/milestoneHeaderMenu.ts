import { reportMenuItems } from "../content-header/contentHeaderReportMenus";

export type MilestoneHeaderMenuGroup = {
  id: "reports";
  label: string;
  items: Array<{ id: string; label: string; description?: string; to: string }>;
};

/**
 * Milestone utilities stay out of the primary create slot so Add Milestone
 * remains the only dominant action on this route.
 */
export function milestoneHeaderMenuGroups(projectId: string): MilestoneHeaderMenuGroup[] {
  return [
    {
      id: "reports",
      label: "Reports",
      items: [
        ...reportMenuItems(projectId, "milestones").map((item, index) => ({
          id: `report-${index}`,
          label: item.label,
          description: item.description,
          to: item.href
        })),
        {
          id: "all-reports",
          label: "All reports",
          description: "Open the reports catalog",
          to: `/projects/${projectId}/reports`
        }
      ]
    }
  ];
}
