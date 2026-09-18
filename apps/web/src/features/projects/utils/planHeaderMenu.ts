import { buildReportPageHref } from "../reports/reportRoutes";
import { buildPlanPrintPath } from "../../print/api/printApi";
import type { OverflowMenuGroup } from "../../../shared/ui";

/**
 * Plan-list utilities stay out of the primary create slot so Add Plan remains
 * the only dominant action on this route.
 */
export function planListHeaderMenuGroups(projectId: string): OverflowMenuGroup[] {
  return [
    {
      id: "reports",
      label: "Reports",
      items: [
        {
          id: "plan-summary",
          label: "Plan summary",
          description: "Progress across plans and generated runs",
          to: buildReportPageHref(projectId, "plan_summary")
        },
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

/**
 * Plan-hub utilities stay out of Add entry so composition remains the
 * dominant surface.
 */
export function planDetailHeaderMenuGroups(
  projectId: string,
  planId: string,
  actions: { onPlanDefaults: () => void }
): OverflowMenuGroup[] {
  return [
    {
      id: "admin",
      label: "Plan settings",
      items: [
        {
          id: "plan-defaults",
          label: "Plan defaults",
          description: "Assignee, references, and schedule",
          onSelect: actions.onPlanDefaults
        }
      ]
    },
    {
      id: "reports",
      label: "Reports",
      items: [
        {
          id: "plan-summary",
          label: "Plan summary",
          description: "Open the plan summary report",
          to: buildReportPageHref(projectId, "plan_summary")
        },
        {
          id: "all-reports",
          label: "All reports",
          description: "Open the reports catalog",
          to: `/projects/${projectId}/reports`
        }
      ]
    },
    {
      id: "output",
      label: "Output",
      items: [
        {
          id: "print",
          label: "Print view",
          description: "Open a printable plan summary",
          to: buildPlanPrintPath(projectId, planId)
        }
      ]
    }
  ];
}
