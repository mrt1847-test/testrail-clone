import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ConfirmDialog } from "../../../../shared/ui/ConfirmDialog";
import { EmptyState } from "../../../../shared/ui/EmptyState";
import { LoadingState } from "../../../../shared/ui/LoadingState";
import {
  downloadExportJob,
  fetchReportExportJobs,
  type ImportExportJobRow
} from "../../api/importExportApi";
import {
  createSavedReport,
  deleteSavedReport,
  fetchSavedReports,
  type SavedReportRow
} from "../../api/savedReportsApi";
import {
  createScheduledReport,
  deleteScheduledReport,
  fetchScheduledReports,
  runScheduledReportNow,
  updateScheduledReport,
  type ScheduledReportRow
} from "../../api/scheduledReportsApi";
import type { ReportExportType } from "../../api/reportsApi";
import { REPORT_TYPE_LABELS, buildReportPageHref } from "../../reports/reportRoutes";
import { ReportPageHeader } from "./ReportChrome";

const reportKeys = {
  saved: (projectId: string) => ["saved-reports", projectId] as const,
  schedules: (projectId: string) => ["scheduled-reports", projectId] as const,
  exportJobs: (projectId: string) => ["report-export-jobs", projectId] as const
};

type TabId = "saved" | "schedules" | "exports";

const INTERVAL_OPTIONS = [
  { value: 60, label: "Every hour" },
  { value: 360, label: "Every 6 hours" },
  { value: 1440, label: "Daily" },
  { value: 10_080, label: "Weekly" }
];

function formatInterval(minutes: number) {
  return INTERVAL_OPTIONS.find((o) => o.value === minutes)?.label ?? `Every ${minutes} min`;
}

function reportTypeFromJobType(type: string): ReportExportType | null {
  const match = type.match(/^report_(.+)_csv$/);
  if (!match?.[1]) return null;
  return match[1] as ReportExportType;
}

function exportJobLabel(row: ImportExportJobRow): string {
  const reportType = reportTypeFromJobType(row.type);
  const filters = row.filters ?? {};
  const reportTypeLabel = reportType ? REPORT_TYPE_LABELS[reportType] : row.type;
  const runId = typeof filters.runId === "string" ? filters.runId : null;
  return runId ? `${reportTypeLabel} · run ${runId}` : reportTypeLabel;
}

function exportFileName(row: ImportExportJobRow): string {
  const summary = row.summary ?? {};
  if (typeof summary.fileName === "string" && summary.fileName.length > 0) return summary.fileName;
  const reportType = reportTypeFromJobType(row.type);
  return reportType ? `${reportType.replace(/_/g, "-")}.csv` : `export-${row.id}.csv`;
}

function SchedulesTab(props: {
  projectId: string;
  savedRows: SavedReportRow[];
  scheduleRows: ScheduledReportRow[];
  schedulesQuery: { isLoading: boolean };
  scheduleName: string;
  setScheduleName: (v: string) => void;
  scheduleSavedReportId: string;
  setScheduleSavedReportId: (v: string) => void;
  scheduleReportType: ReportExportType;
  setScheduleReportType: (v: ReportExportType) => void;
  scheduleInterval: number;
  setScheduleInterval: (v: number) => void;
  scheduleRecipients: string;
  setScheduleRecipients: (v: string) => void;
  scheduleFeedback: string | null;
  createScheduleMutation: { isPending: boolean; mutate: () => void };
  runScheduleMutation: { isPending: boolean; mutate: (row: ScheduledReportRow) => void };
  toggleScheduleMutation: { mutate: (row: ScheduledReportRow) => void };
  onDeleteSchedule: (row: ScheduledReportRow) => void;
}) {
  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Report schedules</h2>
        <p className="mt-1 text-sm text-slate-600">
          CSV export runs on an interval and queues email with a download link to recipients.
        </p>
      </div>
      {props.scheduleFeedback ? <p className="text-sm text-slate-700">{props.scheduleFeedback}</p> : null}
      <form
        className="grid gap-3 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!props.scheduleName.trim() || !props.scheduleRecipients.trim()) return;
          props.createScheduleMutation.mutate();
        }}
      >
        <label className="flex flex-col gap-1 text-xs text-slate-600 md:col-span-2">
          <span className="font-medium uppercase tracking-wide">Name</span>
          <input
            value={props.scheduleName}
            onChange={(e) => props.setScheduleName(e.target.value)}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
            placeholder="e.g. Weekly run summary"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          <span className="font-medium uppercase tracking-wide">Saved report (optional)</span>
          <select
            value={props.scheduleSavedReportId}
            onChange={(e) => props.setScheduleSavedReportId(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
          >
            <option value="">— use report type below —</option>
            {props.savedRows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} ({REPORT_TYPE_LABELS[row.reportType]})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          <span className="font-medium uppercase tracking-wide">Report type</span>
          <select
            value={props.scheduleReportType}
            disabled={Boolean(props.scheduleSavedReportId)}
            onChange={(e) => props.setScheduleReportType(e.target.value as ReportExportType)}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm disabled:opacity-50"
          >
            {(Object.keys(REPORT_TYPE_LABELS) as ReportExportType[]).map((type) => (
              <option key={type} value={type}>
                {REPORT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600">
          <span className="font-medium uppercase tracking-wide">Interval</span>
          <select
            value={props.scheduleInterval}
            onChange={(e) => props.setScheduleInterval(Number(e.target.value))}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
          >
            {INTERVAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-600 md:col-span-2">
          <span className="font-medium uppercase tracking-wide">Recipients (comma-separated emails)</span>
          <input
            value={props.scheduleRecipients}
            onChange={(e) => props.setScheduleRecipients(e.target.value)}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
            placeholder="qa@example.com, lead@example.com"
          />
        </label>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={
              !props.scheduleName.trim() || !props.scheduleRecipients.trim() || props.createScheduleMutation.isPending
            }
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {props.createScheduleMutation.isPending ? "Creating…" : "Create schedule"}
          </button>
        </div>
      </form>
      {props.schedulesQuery.isLoading ? (
        <LoadingState message="Loading schedules…" />
      ) : props.scheduleRows.length === 0 ? (
        <EmptyState title="No schedules" description="Create a schedule to email CSV exports automatically." />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-100">
          {props.scheduleRows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {row.name}{" "}
                  <span className="text-xs font-normal text-slate-500">
                    · {REPORT_TYPE_LABELS[row.reportType]} · {formatInterval(row.intervalMinutes)}
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  {row.enabled ? "Enabled" : "Disabled"}
                  {row.nextRunAt ? ` · next ${new Date(row.nextRunAt).toLocaleString()}` : ""}
                  {row.lastRunAt ? ` · last ${new Date(row.lastRunAt).toLocaleString()}` : ""}
                </p>
                <p className="text-xs text-slate-500">{row.recipientEmails.join(", ")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={props.runScheduleMutation.isPending}
                  onClick={() => props.runScheduleMutation.mutate(row)}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Run now
                </button>
                <button
                  type="button"
                  onClick={() => props.toggleScheduleMutation.mutate(row)}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {row.enabled ? "Disable" : "Enable"}
                </button>
                <button
                  type="button"
                  onClick={() => props.onDeleteSchedule(row)}
                  className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-800"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ExportHistoryTable({
  projectId,
  rows,
  onDownloaded
}: {
  projectId: string;
  rows: ImportExportJobRow[];
  onDownloaded: () => void;
}) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload(row: ImportExportJobRow) {
    setDownloadingId(row.id);
    setError(null);
    try {
      await downloadExportJob(projectId, row.id, exportFileName(row));
      onDownloaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloadingId(null);
    }
  }

  if (rows.length === 0) {
    return <EmptyState title="No report exports yet" description="Queue a CSV export from any report page." />;
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Report</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Rows</th>
              <th className="px-4 py-2">Created</th>
              <th className="px-4 py-2 text-right">Download</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const totalRows =
                row.summary && typeof row.summary.totalRows === "number" ? row.summary.totalRows : null;
              return (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-800">{exportJobLabel(row)}</td>
                  <td className="px-4 py-2 capitalize text-slate-600">{row.status}</td>
                  <td className="px-4 py-2 tabular-nums text-slate-600">{totalRows ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">{new Date(row.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      disabled={downloadingId === row.id}
                      onClick={() => void handleDownload(row)}
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {downloadingId === row.id ? "Downloading…" : "Download CSV"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ReportOperationsPage() {
  const { projectId = "" } = useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>("saved");
  const [saveName, setSaveName] = useState("");
  const [saveReportType, setSaveReportType] = useState<ReportExportType>("run_summary");
  const [deleteTarget, setDeleteTarget] = useState<SavedReportRow | null>(null);
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleSavedReportId, setScheduleSavedReportId] = useState("");
  const [scheduleReportType, setScheduleReportType] = useState<ReportExportType>("run_summary");
  const [scheduleInterval, setScheduleInterval] = useState(1440);
  const [scheduleRecipients, setScheduleRecipients] = useState("");
  const [deleteScheduleTarget, setDeleteScheduleTarget] = useState<ScheduledReportRow | null>(null);
  const [scheduleFeedback, setScheduleFeedback] = useState<string | null>(null);

  const savedQuery = useQuery({
    queryKey: reportKeys.saved(projectId),
    queryFn: () => fetchSavedReports(projectId),
    enabled: Boolean(projectId)
  });
  const exportJobsQuery = useQuery({
    queryKey: reportKeys.exportJobs(projectId),
    queryFn: () => fetchReportExportJobs(projectId),
    enabled: Boolean(projectId)
  });
  const schedulesQuery = useQuery({
    queryKey: reportKeys.schedules(projectId),
    queryFn: () => fetchScheduledReports(projectId),
    enabled: Boolean(projectId)
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      createSavedReport({
        projectId,
        name: saveName.trim(),
        reportType: saveReportType,
        filters: { ui: {} }
      }),
    onSuccess: () => {
      setSaveName("");
      void qc.invalidateQueries({ queryKey: reportKeys.saved(projectId) });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (row: SavedReportRow) => deleteSavedReport(projectId, row.id),
    onSuccess: () => {
      setDeleteTarget(null);
      void qc.invalidateQueries({ queryKey: reportKeys.saved(projectId) });
    }
  });

  const createScheduleMutation = useMutation({
    mutationFn: () => {
      const emails = scheduleRecipients
        .split(/[,\s;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      return createScheduledReport({
        projectId,
        name: scheduleName.trim(),
        savedReportId: scheduleSavedReportId || undefined,
        reportType: scheduleSavedReportId ? undefined : scheduleReportType,
        intervalMinutes: scheduleInterval,
        recipientEmails: emails
      });
    },
    onSuccess: () => {
      setScheduleName("");
      setScheduleRecipients("");
      setScheduleFeedback("Schedule created.");
      void qc.invalidateQueries({ queryKey: reportKeys.schedules(projectId) });
    },
    onError: (e) => setScheduleFeedback(e instanceof Error ? e.message : "Could not create schedule.")
  });

  const toggleScheduleMutation = useMutation({
    mutationFn: (row: ScheduledReportRow) =>
      updateScheduledReport({ projectId, scheduledReportId: row.id, enabled: !row.enabled }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: reportKeys.schedules(projectId) })
  });

  const runScheduleMutation = useMutation({
    mutationFn: (row: ScheduledReportRow) => runScheduledReportNow(projectId, row.id),
    onSuccess: (data) => {
      setScheduleFeedback(data.skipped ? "Schedule skipped." : `Export queued (job #${data.jobId ?? "—"}).`);
      void qc.invalidateQueries({ queryKey: reportKeys.schedules(projectId) });
      void qc.invalidateQueries({ queryKey: reportKeys.exportJobs(projectId) });
    },
    onError: (e) => setScheduleFeedback(e instanceof Error ? e.message : "Run failed.")
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: (row: ScheduledReportRow) => deleteScheduledReport(projectId, row.id),
    onSuccess: () => {
      setDeleteScheduleTarget(null);
      void qc.invalidateQueries({ queryKey: reportKeys.schedules(projectId) });
    }
  });

  const savedRows = savedQuery.data ?? [];
  const scheduleRows = schedulesQuery.data ?? [];
  const exportRows = exportJobsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <ReportPageHeader
        title="Saved reports & export history"
        description="저장한 리포트 정의, 예약 CSV보내기·이메일,보내기 기록을 관리합니다."
      />

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-1">
        {(
          [
            ["saved", "Saved reports"],
            ["schedules", "Schedules"],
            ["exports", "Export history"]
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={
              tab === id
                ? "border-b-2 border-slate-900 px-3 py-2 text-sm font-medium text-slate-900"
                : "px-3 py-2 text-sm text-slate-600 hover:text-slate-900"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "saved" ? (
        <>
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Save report definition</h2>
        <p className="mt-1 text-sm text-slate-600">
          리포트 페이지에서 &quot;Save view&quot;로 현재 필터를 저장하거나, 여기서 빈 템플릿을 추가할 수 있습니다.
        </p>
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!saveName.trim()) return;
            saveMutation.mutate();
          }}
        >
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-slate-600">
            <span className="font-medium uppercase tracking-wide">Name</span>
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
              placeholder="e.g. Open runs — smoke"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            <span className="font-medium uppercase tracking-wide">Report</span>
            <select
              value={saveReportType}
              onChange={(e) => setSaveReportType(e.target.value as ReportExportType)}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
            >
              {(Object.keys(REPORT_TYPE_LABELS) as ReportExportType[]).map((type) => (
                <option key={type} value={type}>
                  {REPORT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={!saveName.trim() || saveMutation.isPending}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saveMutation.isPending ? "Saving…" : "Save"}
          </button>
        </form>
        {saveMutation.isError ? (
          <p className="mt-2 text-sm text-rose-700">
            {saveMutation.error instanceof Error ? saveMutation.error.message : "Could not save report."}
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Saved reports</h2>
        {savedQuery.isLoading ? (
          <LoadingState message="Loading saved reports…" />
        ) : savedRows.length === 0 ? (
          <EmptyState
            title="No saved reports"
            description="Open a report, set filters, and use Save view on that page."
          />
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-md border border-slate-100">
            {savedRows.map((row) => {
              const ui = row.filters?.ui ?? {};
              const href = buildReportPageHref(projectId, row.reportType, ui);
              return (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{row.name}</p>
                    <p className="text-xs text-slate-500">
                      {REPORT_TYPE_LABELS[row.reportType]} · updated {new Date(row.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={href}
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Open
                    </Link>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(row)}
                      className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-800 hover:bg-rose-100"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
        </>
      ) : null}

      {tab === "schedules" ? (
        <SchedulesTab
          projectId={projectId}
          savedRows={savedRows}
          scheduleRows={scheduleRows}
          schedulesQuery={schedulesQuery}
          scheduleName={scheduleName}
          setScheduleName={setScheduleName}
          scheduleSavedReportId={scheduleSavedReportId}
          setScheduleSavedReportId={setScheduleSavedReportId}
          scheduleReportType={scheduleReportType}
          setScheduleReportType={setScheduleReportType}
          scheduleInterval={scheduleInterval}
          setScheduleInterval={setScheduleInterval}
          scheduleRecipients={scheduleRecipients}
          setScheduleRecipients={setScheduleRecipients}
          scheduleFeedback={scheduleFeedback}
          createScheduleMutation={createScheduleMutation}
          runScheduleMutation={runScheduleMutation}
          toggleScheduleMutation={toggleScheduleMutation}
          onDeleteSchedule={setDeleteScheduleTarget}
        />
      ) : null}

      {tab === "exports" ? (
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Export history</h2>
          <button
            type="button"
            onClick={() => void exportJobsQuery.refetch()}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
        {exportJobsQuery.isLoading ? (
          <LoadingState message="Loading export history…" />
        ) : (
          <ExportHistoryTable
            projectId={projectId}
            rows={exportRows}
            onDownloaded={() => void exportJobsQuery.refetch()}
          />
        )}
      </section>
      ) : null}

      <ConfirmDialog
        open={deleteTarget != null}
        title="Delete saved report?"
        description={deleteTarget ? `"${deleteTarget.name}" will be removed. This does not delete export files.` : ""}
        confirmLabel="Delete"
        variant="danger"
        confirmDisabled={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget);
        }}
      />
      <ConfirmDialog
        open={deleteScheduleTarget != null}
        title="Delete schedule?"
        description={deleteScheduleTarget ? `"${deleteScheduleTarget.name}" will be removed.` : ""}
        confirmLabel="Delete"
        variant="danger"
        confirmDisabled={deleteScheduleMutation.isPending}
        onCancel={() => setDeleteScheduleTarget(null)}
        onConfirm={() => {
          if (deleteScheduleTarget) deleteScheduleMutation.mutate(deleteScheduleTarget);
        }}
      />
    </div>
  );
}
