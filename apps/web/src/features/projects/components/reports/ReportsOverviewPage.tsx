import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../../shared/ui/EmptyState";
import { ErrorState } from "../../../../shared/ui/ErrorState";
import { LoadingState } from "../../../../shared/ui/LoadingState";
import { workbenchDensity as density } from "../../../../shared/ui/density/uiDensity";
import type { ReportExportType } from "../../api/reportsApi";
import { createSavedReport, fetchSavedReports, type SavedReportRow } from "../../api/savedReportsApi";
import { REPORT_TYPE_LABELS, buildReportPageHref } from "../../reports/reportRoutes";

type ReportCategory = "Execution" | "Planning" | "Coverage" | "Defects" | "Cases" | "References" | "Project";

type ReportTemplate = {
  type: ReportExportType;
  category: ReportCategory;
  description: string;
  output: string;
  options: Array<{ id: string; label: string; placeholder: string }>;
};

const reportTemplates: ReportTemplate[] = [
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

const categories: Array<ReportCategory | "All"> = ["All", "Execution", "Planning", "Coverage", "Defects", "Cases", "References", "Project"];

function defaultReportName(template: ReportTemplate) {
  return `${REPORT_TYPE_LABELS[template.type]} report`;
}

function uiFiltersFromOptions(values: Record<string, string>) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim().length > 0));
}

export function ReportsOverviewPage() {
  const { projectId = "" } = useParams();
  const qc = useQueryClient();
  const [category, setCategory] = useState<ReportCategory | "All">("All");
  const [selectedType, setSelectedType] = useState<ReportExportType>("run_summary");
  const [reportName, setReportName] = useState(() => defaultReportName(reportTemplates[0]));
  const [description, setDescription] = useState("");
  const [access, setAccess] = useState("project_team");
  const [schedule, setSchedule] = useState("none");
  const [optionValues, setOptionValues] = useState<Record<string, string>>({});
  const [createdReport, setCreatedReport] = useState<SavedReportRow | null>(null);

  const savedReportsQuery = useQuery({
    queryKey: ["saved-reports", projectId],
    queryFn: () => fetchSavedReports(projectId),
    enabled: Boolean(projectId)
  });

  const selectedTemplate = useMemo(
    () => reportTemplates.find((template) => template.type === selectedType) ?? reportTemplates[0],
    [selectedType]
  );
  const visibleTemplates = useMemo(
    () => reportTemplates.filter((template) => category === "All" || template.category === category),
    [category]
  );
  const savedRows = savedReportsQuery.data ?? [];

  const selectTemplate = (template: ReportTemplate) => {
    setSelectedType(template.type);
    setReportName(defaultReportName(template));
    setOptionValues({});
    setCreatedReport(null);
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      createSavedReport({
        projectId,
        name: reportName.trim(),
        reportType: selectedTemplate.type,
        filters: {
          ui: {
            ...uiFiltersFromOptions(optionValues),
            description: description.trim(),
            access,
            schedule
          },
          export: uiFiltersFromOptions(optionValues)
        }
      }),
    onSuccess: (row) => {
      setCreatedReport(row);
      void qc.invalidateQueries({ queryKey: ["saved-reports", projectId] });
    }
  });

  return (
    <div className={`grid ${density.pageGap} xl:grid-cols-[minmax(0,1fr)_22rem]`}>
      <main className={density.mainStack}>
        <section className={`${density.panel} px-3 py-2`}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Reports</p>
          <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Template catalog</h2>
              <p className="mt-1 text-sm text-slate-600">
                Choose a report template, configure options, then save it for export, print, or scheduling.
              </p>
            </div>
            <Link
              to={`/projects/${projectId}/reports/saved`}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Saved & exports
            </Link>
          </div>
        </section>

        <div className={`${density.toolbar} justify-between`}>
          <div className="flex flex-wrap gap-1">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={
                  category === item
                    ? "rounded bg-slate-900 px-2.5 py-1 text-xs font-medium text-white"
                    : "rounded px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                }
              >
                {item}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-500">{visibleTemplates.length} templates</span>
        </div>

        <section className={`overflow-hidden ${density.panel}`}>
          <div className={density.panelHeader}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Report templates</h3>
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className={density.tableHeaderCell}>Template</th>
                <th className={density.tableHeaderCell}>Category</th>
                <th className={density.tableHeaderCell}>Output</th>
                <th className={`${density.tableHeaderCell} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleTemplates.map((template) => (
                <tr key={template.type} className={selectedType === template.type ? "bg-slate-50" : "hover:bg-slate-50"}>
                  <td className={density.tableCell}>
                    <p className="font-medium text-slate-900">{REPORT_TYPE_LABELS[template.type]}</p>
                    <p className="mt-0.5 max-w-2xl text-xs text-slate-500">{template.description}</p>
                  </td>
                  <td className={`${density.tableCell} text-slate-700`}>{template.category}</td>
                  <td className={`${density.tableCell} text-slate-700`}>{template.output}</td>
                  <td className={`${density.tableCell} text-right`}>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                        disabled={selectedType === template.type}
                        onClick={() => selectTemplate(template)}
                      >
                        Configure
                      </button>
                      <Link
                        to={buildReportPageHref(projectId, template.type)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Run now
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={`${density.panel} ${density.panelBody}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Saved reports</h3>
              <p className="mt-1 text-sm text-slate-600">Saved configurations stay close to export history and schedules.</p>
            </div>
            <Link to={`/projects/${projectId}/reports/saved`} className="text-sm font-medium text-indigo-800 hover:underline">
              Manage saved reports
            </Link>
          </div>
          {savedReportsQuery.isLoading ? (
            <LoadingState message="Loading saved reports..." />
          ) : savedReportsQuery.isError ? (
            <ErrorState title="Could not load saved reports" onRetry={() => void savedReportsQuery.refetch()} />
          ) : savedRows.length === 0 ? (
            <EmptyState title="No saved reports" description="Configure a template to create one." />
          ) : (
            <ul className="mt-3 divide-y divide-slate-100 border border-slate-200">
              {savedRows.slice(0, 6).map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{row.name}</p>
                    <p className="text-xs text-slate-500">{REPORT_TYPE_LABELS[row.reportType]}</p>
                  </div>
                  <Link
                    to={buildReportPageHref(projectId, row.reportType, row.filters?.ui)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <aside className={density.sidebarStack}>
        <section className={density.sidebarPanel}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Add report</h3>
          <p className="mt-1 text-sm text-slate-600">{REPORT_TYPE_LABELS[selectedTemplate.type]}</p>
          <form
            className={density.formGrid}
            onSubmit={(e) => {
              e.preventDefault();
              if (!reportName.trim()) return;
              saveMutation.mutate();
            }}
          >
            <label className="grid gap-1 text-sm text-slate-700">
              <span>Name</span>
              <input
                className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm text-slate-700">
              <span>Description</span>
              <textarea
                className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                rows={3}
                placeholder="Purpose, audience, or review cadence"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <div className="border-t border-slate-200 pt-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Report options</p>
              <div className="mt-2 grid gap-2">
                {selectedTemplate.options.map((option) => (
                  <label key={option.id} className="grid gap-1 text-sm text-slate-700">
                    <span>{option.label}</span>
                    <input
                      className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                      placeholder={option.placeholder}
                      value={optionValues[option.id] ?? ""}
                      onChange={(e) => setOptionValues((current) => ({ ...current, [option.id]: e.target.value }))}
                    />
                  </label>
                ))}
              </div>
            </div>
            <label className="grid gap-1 text-sm text-slate-700">
              <span>Access</span>
              <select
                className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                value={access}
                onChange={(e) => setAccess(e.target.value)}
              >
                <option value="project_team">Project team</option>
                <option value="private">Only me</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm text-slate-700">
              <span>Scheduling</span>
              <select
                className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
              >
                <option value="none">Do not schedule</option>
                <option value="daily">Daily review</option>
                <option value="weekly">Weekly review</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={!reportName.trim() || saveMutation.isPending}
              className="rounded border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {saveMutation.isPending ? "Saving..." : "Save report"}
            </button>
            {saveMutation.isError ? <p className="text-xs text-rose-700">Could not save report.</p> : null}
            {createdReport ? (
              <div className="rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">
                <p className="font-medium">Saved {createdReport.name}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Link className="underline" to={buildReportPageHref(projectId, createdReport.reportType, createdReport.filters?.ui)}>
                    Open report
                  </Link>
                  <Link className="underline" to={`/projects/${projectId}/reports/saved`}>
                    Schedule or export
                  </Link>
                </div>
              </div>
            ) : null}
          </form>
        </section>

        <section className={density.sidebarPanel}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Selected template</h3>
          <dl className="mt-2 space-y-2 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Category</dt>
              <dd className="text-slate-900">{selectedTemplate.category}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Output</dt>
              <dd className="text-slate-900">{selectedTemplate.output}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Template</dt>
              <dd className="text-slate-900">{selectedTemplate.description}</dd>
            </div>
          </dl>
        </section>
      </aside>
    </div>
  );
}
