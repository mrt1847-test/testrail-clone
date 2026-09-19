import { buildReportPageHref } from "../../projects/reports/reportRoutes";

export type MyTestsHeaderMenuGroup = {
  id: "workflow" | "reports";
  label: string;
  items: Array<{ id: string; label: string; description?: string; to: string }>;
};

/**
 * My Tests keeps recording in Run Execution. Reports and team-wide views stay
 * in overflow so the assigned queue and Open test remain the primary work.
 */
export function myTestsHeaderMenuGroups(projectId: string): MyTestsHeaderMenuGroup[] {
  return [
    {
      id: "workflow",
      label: "Workflow",
      items: [
        {
          id: "team-todo",
          label: "Team to-do",
          description: "Assigned tests across the project team",
          to: `/projects/${projectId}/team-todo`
        }
      ]
    },
    {
      id: "reports",
      label: "Reports",
      items: [
        {
          id: "users-workload",
          label: "Users workload",
          description: "Workload summary report",
          to: buildReportPageHref(projectId, "users_workload_summary")
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
