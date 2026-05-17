import type { ReactNode } from "react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { FilterBar, type FilterField } from "../../../../shared/ui/FilterBar";
import { PageHeader } from "../../../../shared/ui/PageHeader";
import { PrintLinkButton } from "../../../print/components/PrintLinkButton";
import { buildReportPrintPath } from "../../../print/api/reportPrintApi";
import { requestReportExportJob } from "../../api/importExportApi";
import { downloadReportCsv, type ReportExportType } from "../../api/reportsApi";
import { createSavedReport, type SavedReportFilters } from "../../api/savedReportsApi";

type SummaryTone = "neutral" | "emerald" | "amber" | "rose" | "violet";

const toneCls: Record<SummaryTone, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-800",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  rose: "border-rose-200 bg-rose-50 text-rose-900",
  violet: "border-violet-200 bg-violet-50 text-violet-900"
};

export type ReportSummaryItem = {
  label: string;
  value: string | number;
  tone?: SummaryTone;
  hint?: string;
};

/** Page title + optional description for report drilldown routes. */
export function ReportPageHeader({ title, description }: { title: string; description?: string }) {
  return <PageHeader title={title} description={description} />;
}

/** Compact KPI strip (filter/summary bar baseline for report pages). */
export function ReportSummaryStrip({ items }: { items: ReportSummaryItem[] }) {
  if (items.length === 0) return null;
  return (
    <div
      className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
      aria-label="Report summary"
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={`min-w-[6.5rem] rounded-md border px-2.5 py-1.5 text-xs ${toneCls[item.tone ?? "neutral"]}`}
          title={item.hint}
        >
          <p className="font-medium uppercase tracking-wide opacity-80">{item.label}</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export type ReportFilterField = FilterField;

/** Compact filter row for report drilldown pages (client-side filtering baseline). */
export function ReportFilterBar({ fields }: { fields: ReportFilterField[] }) {
  return <FilterBar fields={fields} ariaLabel="Report filters" variant="card" />;
}

/** CSV export for the current report type (uses ad-hoc GET export API). */
export function ReportExportButton({
  projectId,
  reportType,
  disabled
}: {
  projectId: string;
  reportType: ReportExportType;
  disabled?: boolean;
}) {
  return <ReportExportActions projectId={projectId} reportType={reportType} disabled={disabled} />;
}

export function ReportExportActions({
  projectId,
  reportType,
  disabled,
  exportQuery
}: {
  projectId: string;
  reportType: ReportExportType;
  disabled?: boolean;
  exportQuery?: Record<string, string | undefined>;
}) {
  const { projectId: routeProjectId = projectId } = useParams();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<"download" | "queue" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queuedJobId, setQueuedJobId] = useState<string | null>(null);
  const historyHref = `/projects/${routeProjectId}/reports/saved`;

  async function handleDownload() {
    setBusy("download");
    setError(null);
    try {
      await downloadReportCsv(projectId, reportType, exportQuery);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleQueue() {
    setBusy("queue");
    setError(null);
    try {
      const { jobId } = await requestReportExportJob(projectId, {
        reportType,
        format: "csv",
        ...exportQuery
      });
      setQueuedJobId(jobId);
      void qc.invalidateQueries({ queryKey: ["report-export-jobs", projectId] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not queue export");
    } finally {
      setBusy(null);
    }
  }

  const printPath = buildReportPrintPath(routeProjectId, reportType, exportQuery);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        {printPath ? <PrintLinkButton to={printPath} label="Print view" /> : null}
        <button
          type="button"
          disabled={disabled || busy != null}
          onClick={() => void handleDownload()}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "download" ? "Exporting…" : "Export CSV"}
        </button>
        <button
          type="button"
          disabled={disabled || busy != null}
          onClick={() => void handleQueue()}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "queue" ? "Queuing…" : "Queue export"}
        </button>
      </div>
      {queuedJobId ? (
        <p className="text-xs text-emerald-700">
          Export queued (#{queuedJobId}).{" "}
          <Link to={historyHref} className="font-medium underline">
            View history
          </Link>
        </p>
      ) : null}
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}

export function ReportSaveViewButton({
  projectId,
  reportType,
  filters,
  disabled
}: {
  projectId: string;
  reportType: ReportExportType;
  filters: SavedReportFilters;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const saveMutation = useMutation({
    mutationFn: () =>
      createSavedReport({
        projectId,
        name: name.trim(),
        reportType,
        filters
      }),
    onSuccess: () => {
      setMessage("Saved.");
      setOpen(false);
      setName("");
    },
    onError: (e) => setMessage(e instanceof Error ? e.message : "Could not save view.")
  });

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        Save view
      </button>
    );
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        saveMutation.mutate();
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="View name"
        className="min-w-[10rem] rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
        autoFocus
      />
      <button
        type="submit"
        disabled={!name.trim() || saveMutation.isPending}
        className="rounded-md bg-slate-900 px-2.5 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {saveMutation.isPending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setName("");
          setMessage(null);
        }}
        className="text-sm text-slate-600 hover:text-slate-900"
      >
        Cancel
      </button>
      {message ? <span className="text-xs text-slate-600">{message}</span> : null}
    </form>
  );
}

/** Bordered panel wrapping the main table for a report. */
export function ReportTablePanel({ title, toolbar, children }: { title: string; toolbar?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{title}</h2>
        {toolbar ? <div className="flex flex-wrap gap-2">{toolbar}</div> : null}
      </div>
      {children}
    </div>
  );
}
