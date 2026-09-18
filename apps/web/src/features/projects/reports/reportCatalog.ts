import type { ReportExportType } from "../api/reportsApi";

export type ReportCategory = "Execution" | "Planning" | "Coverage" | "Defects" | "Cases" | "References" | "Project";

export type ReportTemplate = {
  type: ReportExportType;
  category: ReportCategory;
  description: string;
  output: string;
  options: Array<{ id: string; label: string; placeholder: string }>;
};

export const REPORT_CATEGORIES: Array<ReportCategory | "All"> = [
  "All",
  "Execution",
  "Planning",
  "Coverage",
  "Defects",
  "Cases",
  "References",
  "Project"
];

export const reportTemplates: ReportTemplate[] = [
  {
    type: "run_summary",
    category: "Execution",
    description: "Run status, pass/fail counts, progress, and time variance.",
    output: "Execution table",
    options: [
      { id: "search", label: "Run name contains", placeholder: "Smoke, regression..." },
      { id: "status", label: "Status", placeholder: "all, open, closed" }
    ]
  },
  {
    type: "results_explorer",
    category: "Execution",
    description: "Filtered test results for daily execution follow-up.",
    output: "Result drilldown",
    options: [
      { id: "status", label: "Result status", placeholder: "failed, blocked, retest..." },
      { id: "runId", label: "Run ID", placeholder: "Optional run ID" }
    ]
  },
  {
    type: "milestone_summary",
    category: "Planning",
    description: "Milestone progress, open runs, dates, and forecast status.",
    output: "Milestone table",
    options: [
      { id: "status", label: "Lifecycle", placeholder: "all, open, upcoming, completed" },
      { id: "search", label: "Milestone name contains", placeholder: "Release, sprint..." }
    ]
  },
  {
    type: "plan_summary",
    category: "Planning",
    description: "Plan entries, generated runs, open runs, and progress rollups.",
    output: "Plan table",
    options: [
      { id: "status", label: "Plan status", placeholder: "all, open, closed" },
      { id: "search", label: "Plan name contains", placeholder: "Matrix, release..." }
    ]
  },
  {
    type: "coverage_gap",
    category: "Coverage",
    description: "Requirements or references that lack passing test coverage.",
    output: "Gap table",
    options: [
      { id: "q", label: "Requirement/ref contains", placeholder: "REQ-123" },
      { id: "status", label: "Coverage state", placeholder: "gap, partial, covered" }
    ]
  },
  {
    type: "traceability",
    category: "Coverage",
    description: "Requirement-to-case-to-run traceability with drilldowns.",
    output: "Traceability matrix",
    options: [
      { id: "q", label: "Requirement/ref contains", placeholder: "REQ, JIRA..." },
      { id: "status", label: "Result status", placeholder: "failed, passed..." }
    ]
  },
  {
    type: "defect_coverage",
    category: "Defects",
    description: "Defects linked to requirements and execution coverage.",
    output: "Defect matrix",
    options: [
      { id: "q", label: "Defect or ref contains", placeholder: "BUG-123" },
      { id: "status", label: "Coverage state", placeholder: "open, covered..." }
    ]
  },
  {
    type: "defect_summary",
    category: "Defects",
    description: "Defects grouped by status, source, and execution impact.",
    output: "Defect table",
    options: [
      { id: "status", label: "Defect status", placeholder: "open, closed..." },
      { id: "q", label: "Text contains", placeholder: "Crash, payment..." }
    ]
  },
  {
    type: "case_activity_summary",
    category: "Cases",
    description: "Case creation and update activity over a selected period.",
    output: "Activity table",
    options: [
      { id: "days", label: "Period", placeholder: "7, 30, 60" },
      { id: "q", label: "Case text contains", placeholder: "Login..." }
    ]
  },
  {
    type: "cases_property_distribution",
    category: "Cases",
    description: "Case counts by status, priority, type, or custom property.",
    output: "Distribution table",
    options: [
      { id: "property", label: "Property", placeholder: "priority, type, status" },
      { id: "suiteId", label: "Suite ID", placeholder: "Optional suite ID" }
    ]
  },
  {
    type: "refs_coverage",
    category: "References",
    description: "Reference coverage across cases and execution results.",
    output: "Reference coverage",
    options: [
      { id: "q", label: "Reference contains", placeholder: "REQ, JIRA..." },
      { id: "status", label: "Coverage status", placeholder: "covered, uncovered" }
    ]
  },
  {
    type: "refs_comparison",
    category: "References",
    description: "Compare reference coverage across selected runs or periods.",
    output: "Comparison table",
    options: [
      { id: "q", label: "Reference contains", placeholder: "REQ, JIRA..." }
    ]
  },
  {
    type: "refs_defect_summary",
    category: "References",
    description: "Defects grouped by the references they cover.",
    output: "Defect table",
    options: [
      { id: "q", label: "Reference contains", placeholder: "REQ, JIRA..." }
    ]
  },
  {
    type: "status_tops",
    category: "Execution",
    description: "Highest-volume statuses and outcomes across results.",
    output: "Status table",
    options: [
      { id: "status", label: "Status", placeholder: "failed, blocked..." }
    ]
  },
  {
    type: "results_case_comparison",
    category: "Execution",
    description: "Compare case results across two runs.",
    output: "Comparison table",
    options: [
      { id: "leftRunId", label: "Left run ID", placeholder: "Run ID" },
      { id: "rightRunId", label: "Right run ID", placeholder: "Run ID" }
    ]
  },
  {
    type: "results_property_distribution",
    category: "Execution",
    description: "Result counts by status or custom result property.",
    output: "Distribution table",
    options: [
      { id: "property", label: "Property", placeholder: "status, priority" }
    ]
  },
  {
    type: "project_summary",
    category: "Project",
    description: "Project-level cases, runs, failures, plans, and milestone health.",
    output: "Project document",
    options: [
      { id: "period", label: "Period", placeholder: "current, 30d, 90d" },
      { id: "include", label: "Include sections", placeholder: "runs, milestones, defects" }
    ]
  },
  {
    type: "users_workload_summary",
    category: "Project",
    description: "Assigned workload by user, status, aging, and due date.",
    output: "Workload table",
    options: [
      { id: "status", label: "Assignment status", placeholder: "active, overdue..." },
      { id: "user", label: "User contains", placeholder: "Name or email" }
    ]
  }
];
