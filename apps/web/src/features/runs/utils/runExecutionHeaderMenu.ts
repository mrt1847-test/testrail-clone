import { buildReportPageHref } from "../../projects/reports/reportRoutes";

export type RunExecutionHeaderMenuItem = {
  id: "duplicate" | "compare" | "rerun" | "run-summary" | "results-explorer" | "defect-summary" | "traceability" | "print" | "export-tests" | "export-results" | "export-suite";
  label: string;
  description?: string;
  to?: string;
};

export type RunExecutionHeaderMenuGroup = {
  id: "management" | "reports" | "output";
  label: string;
  items: RunExecutionHeaderMenuItem[];
};

/**
 * The menu's information architecture is deliberately data-only so the run
 * workbench can keep result recording separate from secondary utilities.
 */
export function runExecutionHeaderMenuGroups(
  projectId: string,
  runId: string,
  suiteId?: string
): RunExecutionHeaderMenuGroup[] {
  const runScope = { runId, scopeType: "run" as const, scopeId: runId };
  const outputItems: RunExecutionHeaderMenuItem[] = [
    {
      id: "print",
      label: "Print view",
      description: "Printer-friendly run summary",
      to: `/projects/${projectId}/runs/${runId}/print`
    },
    {
      id: "export-tests",
      label: "Export tests (CSV)",
      description: "Current test list with status and assignee"
    },
    {
      id: "export-results",
      label: "Export results (CSV)",
      description: "All submitted results in this run"
    }
  ];
  if (suiteId) {
    outputItems.splice(1, 0, {
      id: "export-suite",
      label: "Export suite (CSV)",
      description: "Case repository export for this suite",
      to: `/projects/${projectId}/import-export?kind=export&suiteId=${encodeURIComponent(suiteId)}`
    });
  }

  return [
    {
      id: "management",
      label: "Run management",
      items: [
        { id: "duplicate", label: "Duplicate run" },
        { id: "compare", label: "Compare runs" },
        { id: "rerun", label: "Create rerun" }
      ]
    },
    {
      id: "reports",
      label: "Reports",
      items: [
        {
          id: "run-summary",
          label: "Run summary",
          to: buildReportPageHref(projectId, "run_summary", runScope)
        },
        {
          id: "results-explorer",
          label: "Results explorer",
          to: buildReportPageHref(projectId, "results_explorer", runScope)
        },
        {
          id: "defect-summary",
          label: "Defect summary",
          to: buildReportPageHref(projectId, "defect_summary", runScope)
        },
        {
          id: "traceability",
          label: "Traceability",
          to: buildReportPageHref(projectId, "traceability")
        }
      ]
    },
    { id: "output", label: "Output", items: outputItems }
  ];
}
