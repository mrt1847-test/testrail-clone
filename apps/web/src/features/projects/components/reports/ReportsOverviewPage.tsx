import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Button, DataTable, WorkbenchPage, WorkbenchToolbar, buttonClassName } from "../../../../shared/ui";
import { EmptyState } from "../../../../shared/ui/EmptyState";
import { ErrorState } from "../../../../shared/ui/ErrorState";
import { LoadingState } from "../../../../shared/ui/LoadingState";
import type { ReportExportType } from "../../api/reportsApi";
import { createSavedReport, fetchSavedReports } from "../../api/savedReportsApi";
import { REPORT_CATEGORIES, reportTemplates, type ReportCategory } from "../../reports/reportCatalog";
import { REPORT_TYPE_LABELS, buildReportPageHref } from "../../reports/reportRoutes";
import { ReportAddDialog, type ReportAddDialogValues } from "./ReportAddDialog";
import { ReportsHeader } from "./ReportsHeader";

function uiFiltersFromOptions(values: Record<string, string>) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim().length > 0));
}

export function ReportsOverviewPage() {
  const { projectId = "" } = useParams();
  const qc = useQueryClient();
  const [category, setCategory] = useState<ReportCategory | "All">("All");
  const [selectedType, setSelectedType] = useState<ReportExportType>("run_summary");
  const [addOpen, setAddOpen] = useState(false);

  const savedReportsQuery = useQuery({
    queryKey: ["saved-reports", projectId],
    queryFn: () => fetchSavedReports(projectId),
    enabled: Boolean(projectId)
  });

  const visibleTemplates = useMemo(
    () => reportTemplates.filter((template) => category === "All" || template.category === category),
    [category]
  );
  const savedRows = savedReportsQuery.data ?? [];

  const saveMutation = useMutation({
    mutationFn: (values: ReportAddDialogValues) =>
      createSavedReport({
        projectId,
        name: values.name,
        reportType: values.reportType,
        filters: {
          ui: {
            ...uiFiltersFromOptions(values.optionValues),
            description: values.description,
            access: values.access
          },
          export: uiFiltersFromOptions(values.optionValues)
        }
      }),
    onSuccess: () => {
      setAddOpen(false);
      void qc.invalidateQueries({ queryKey: ["saved-reports", projectId] });
    }
  });

  const header = (
    <ReportsHeader
      projectId={projectId}
      onAddReport={() => {
        saveMutation.reset();
        setAddOpen(true);
      }}
    />
  );
  const toolbar = (
    <WorkbenchToolbar className="flex flex-wrap items-center gap-2 border border-slate-300 bg-white px-3 py-2">
      <div className="flex flex-wrap gap-1">
        {REPORT_CATEGORIES.map((item) => (
          <Button
            key={item}
            size="sm"
            variant={category === item ? "primary" : "secondary"}
            onClick={() => setCategory(item)}
          >
            {item}
          </Button>
        ))}
      </div>
      <span className="ml-auto text-xs text-slate-500">{visibleTemplates.length} templates</span>
    </WorkbenchToolbar>
  );
  const dialog = (
    <ReportAddDialog
      open={addOpen}
      initialType={selectedType}
      saving={saveMutation.isPending}
      saveStatus={saveMutation.isPending ? "saving" : saveMutation.isError ? "failed" : "idle"}
      saveError={saveMutation.error instanceof Error ? saveMutation.error.message : undefined}
      onCancel={() => setAddOpen(false)}
      onSubmit={(values) => void saveMutation.mutateAsync(values)}
    />
  );

  if (savedReportsQuery.isLoading) {
    return (
      <WorkbenchPage data-reports-workbench="">
        {header}
        <LoadingState message="Loading reports..." />
        {dialog}
      </WorkbenchPage>
    );
  }

  return (
    <WorkbenchPage data-reports-workbench="">
      {header}
      {toolbar}
      <section className="overflow-hidden border border-slate-300 bg-white">
        <header className="border-b border-slate-200 px-3 py-2">
          <h2 className="text-sm font-semibold text-slate-900">Report templates</h2>
          <p className="text-xs text-slate-500">Open a template to see results. Add report saves a named view.</p>
        </header>
        <DataTable
          dense
          className="rounded-none border-0"
          rowKey={(row) => row.type}
          rows={visibleTemplates}
          columns={[
            {
              key: "template",
              header: "Template",
              cell: (row) => (
                <button
                  type="button"
                  className="text-left"
                  onClick={() => setSelectedType(row.type)}
                >
                  <p className={`font-medium ${selectedType === row.type ? "text-slate-950" : "text-slate-900"}`}>
                    {REPORT_TYPE_LABELS[row.type]}
                  </p>
                  <p className="mt-0.5 max-w-2xl text-xs text-slate-500">{row.description}</p>
                </button>
              )
            },
            {
              key: "category",
              header: "Category",
              headerClassName: "hidden sm:table-cell",
              cellClassName: "hidden sm:table-cell text-slate-700",
              cell: (row) => row.category
            },
            {
              key: "output",
              header: "Output",
              headerClassName: "hidden md:table-cell",
              cellClassName: "hidden md:table-cell text-slate-700",
              cell: (row) => row.output
            },
            {
              key: "action",
              header: "Action",
              align: "right",
              cell: (row) => (
                <Link
                  to={buildReportPageHref(projectId, row.type)}
                  className={buttonClassName({ size: "sm", variant: "primary" })}
                  onClick={() => setSelectedType(row.type)}
                >
                  Open
                </Link>
              )
            }
          ]}
        />
      </section>
      {savedReportsQuery.isError ? (
        <ErrorState title="Could not load saved reports" onRetry={() => void savedReportsQuery.refetch()} />
      ) : savedRows.length === 0 ? (
        <EmptyState
          title="No saved reports"
          description="Use Add report to save a named view. Opening a template does not require saving first."
        />
      ) : (
        <section className="overflow-hidden border border-slate-300 bg-white">
          <header className="border-b border-slate-200 px-3 py-2">
            <h2 className="text-sm font-semibold text-slate-900">Saved reports</h2>
            <p className="text-xs text-slate-500">Schedules and export history stay in More actions.</p>
          </header>
          <DataTable
            dense
            className="rounded-none border-0"
            rowKey={(row) => row.id}
            rows={savedRows.slice(0, 6)}
            columns={[
              {
                key: "name",
                header: "Saved report",
                cell: (row) => (
                  <div>
                    <p className="font-medium text-slate-900">{row.name}</p>
                    <p className="text-xs text-slate-500">{REPORT_TYPE_LABELS[row.reportType]}</p>
                  </div>
                )
              },
              {
                key: "open",
                header: "Action",
                align: "right",
                cell: (row) => (
                  <Link
                    to={buildReportPageHref(projectId, row.reportType, row.filters?.ui)}
                    className="text-xs font-medium text-slate-800 underline-offset-2 hover:underline"
                  >
                    Open
                  </Link>
                )
              }
            ]}
          />
        </section>
      )}
      {dialog}
    </WorkbenchPage>
  );
}
