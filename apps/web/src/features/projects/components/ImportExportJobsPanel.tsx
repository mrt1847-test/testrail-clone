import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import {
  downloadExportJob,
  fetchExportJobs,
  fetchImportJobs,
  pollExportJobUntilReady,
  type ImportExportJobRow
} from "../api/importExportApi";

function jobProgressLabel(row: ImportExportJobRow): string {
  const summary =
    row.summary && typeof row.summary === "object" && !Array.isArray(row.summary)
      ? (row.summary as Record<string, unknown>)
      : {};
  if (typeof summary.phase === "string") return summary.phase;
  if (row.status === "processing") return "processing";
  if (row.status === "pending") return "queued";
  if (typeof summary.validRows === "number" && typeof summary.totalRows === "number") {
    return `${summary.validRows}/${summary.totalRows} valid`;
  }
  if (typeof summary.totalRows === "number") return `${summary.totalRows} rows`;
  return row.status;
}

function exportFileName(row: ImportExportJobRow): string {
  const summary =
    row.summary && typeof row.summary === "object" && !Array.isArray(row.summary)
      ? (row.summary as Record<string, unknown>)
      : {};
  if (typeof summary.fileName === "string") return summary.fileName;
  if (row.type === "cases_json") return "cases.json";
  if (row.type === "cases_xml") return "cases.xml";
  if (row.type.startsWith("run_results")) return "run-results.csv";
  return "export.csv";
}

function isActiveJob(status: string) {
  return status === "pending" || status === "processing";
}

type Props = {
  projectId: string;
};

export function ImportExportJobsPanel({ projectId }: Props) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const importJobsQuery = useQuery({
    queryKey: ["import-jobs", projectId],
    queryFn: () => fetchImportJobs(projectId),
    enabled: Boolean(projectId),
    refetchInterval: (query) => {
      const rows = query.state.data ?? [];
      return rows.some((row) => isActiveJob(row.status)) ? 2000 : false;
    }
  });

  const exportJobsQuery = useQuery({
    queryKey: ["export-jobs", projectId],
    queryFn: () => fetchExportJobs(projectId),
    enabled: Boolean(projectId),
    refetchInterval: (query) => {
      const rows = query.state.data ?? [];
      return rows.some((row) => isActiveJob(row.status)) ? 2000 : false;
    }
  });

  async function handleExportDownload(row: ImportExportJobRow) {
    setDownloadingId(row.id);
    setDownloadError(null);
    try {
      if (row.status !== "completed") {
        await pollExportJobUntilReady(projectId, row.id);
      }
      await downloadExportJob(projectId, row.id, exportFileName(row));
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Download failed");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {downloadError ? <p className="col-span-full text-sm text-red-700">{downloadError}</p> : null}
      <JobTable title="Import jobs" rows={importJobsQuery.data ?? []} kind="import" />
      <JobTable
        title="Export jobs"
        rows={exportJobsQuery.data ?? []}
        kind="export"
        downloadingId={downloadingId}
        onDownload={handleExportDownload}
      />
    </div>
  );
}

function JobTable({
  title,
  rows,
  kind,
  downloadingId,
  onDownload
}: {
  title: string;
  rows: ImportExportJobRow[];
  kind: "import" | "export";
  downloadingId?: string | null;
  onDownload?: (row: ImportExportJobRow) => void;
}) {
  return (
    <section className="rounded border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {kind === "import"
            ? "Background CSV imports show queued → processing → completed."
            : "Queue large exports, then download when status is completed."}
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-4 text-sm text-slate-500">No jobs yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">ID</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Progress</th>
                <th className="px-4 py-2">Created</th>
                {kind === "export" ? <th className="px-4 py-2 text-right">Download</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-mono text-xs text-slate-600">{row.id}</td>
                  <td className="px-4 py-2">{row.type}</td>
                  <td className="px-4 py-2 capitalize">{row.status}</td>
                  <td className="px-4 py-2 text-xs text-slate-600">{jobProgressLabel(row)}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">{new Date(row.createdAt).toLocaleString()}</td>
                  {kind === "export" && onDownload ? (
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        disabled={downloadingId === row.id || row.status === "failed"}
                        onClick={() => void onDownload(row)}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
                      >
                        {downloadingId === row.id
                          ? "Preparing…"
                          : row.status === "completed"
                            ? "Download"
                            : "Wait & download"}
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
