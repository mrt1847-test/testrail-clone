import { reportMenuItems } from "../../projects/content-header/contentHeaderReportMenus";
import { buildRunComparisonPath } from "./runComparisonUrl";

export type RunListHeaderMenuItem = {
  id: string;
  label: string;
  description?: string;
  to: string;
};

export type RunListHeaderMenuGroup = {
  id: "workflow" | "reports";
  label: string;
  items: RunListHeaderMenuItem[];
};

/**
 * Run-list utilities stay out of the primary create slot so Add Run remains
 * the only dominant action on this route.
 */
export function runListHeaderMenuGroups(projectId: string): RunListHeaderMenuGroup[] {
  return [
    {
      id: "workflow",
      label: "Workflow",
      items: [
        {
          id: "add-plan",
          label: "Add test plan",
          description: "Open plans to create or manage a plan",
          to: `/projects/${projectId}/plans`
        },
        {
          id: "compare",
          label: "Compare runs",
          description: "Compare results across two runs",
          to: buildRunComparisonPath(projectId)
        }
      ]
    },
    {
      id: "reports",
      label: "Reports",
      items: [
        ...reportMenuItems(projectId, "runs").map((item, index) => ({
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
