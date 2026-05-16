import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";

import {
  downloadCasesCsv,
  downloadRunResultsCsv,
  fetchExportJobs,
  fetchImportJobs,
  importCasesCsv,
  type CaseImportResult,
  type ImportExportJobRow
} from "../api/advancedApi";

const sampleCsv = [
  "section_id,title,preconditions,priority,type,refs,labels,automation_key,external_id,custom_risk,steps",
  ',"Checkout with saved card","User has saved card",High,Regression,REQ-1,checkout|payment,checkout.saved_card,EXT-100,High,"Open checkout=>Checkout opens|Pay with saved card=>Payment succeeds"'
].join("\n");

function JobTable({ title, rows }: { title: string; rows: ImportExportJobRow[] }) {
  return (
    <section className="rounded border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
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
                <th className="px-4 py-2">Summary</th>
                <th className="px-4 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-mono text-xs text-slate-600">{row.id}</td>
                  <td className="px-4 py-2">{row.type}</td>
                  <td className="px-4 py-2">{row.status}</td>
                  <td className="px-4 py-2 text-xs text-slate-600">
                    {row.summary ? JSON.stringify(row.summary) : "-"}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">{new Date(row.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ImportResult({ result }: { result: CaseImportResult | null }) {
  if (!result) return null;
  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
      <p className="font-medium text-slate-900">
        Rows {result.summary.totalRows} / valid {result.summary.validRows} / invalid {result.summary.invalidRows} /
        imported {result.summary.imported}
      </p>
      {result.issues.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-red-700">
          {result.issues.slice(0, 8).map((issue, index) => (
            <li key={`${issue.row}-${issue.code}-${index}`}>
              row {issue.row}: {issue.field ? `${issue.field} - ` : ""}
              {issue.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-emerald-700">No validation issues.</p>
      )}
    </div>
  );
}

export function ImportExportPage() {
  const { projectId = "" } = useParams();
  const qc = useQueryClient();
  const [csv, setCsv] = useState(sampleCsv);
  const [sectionId, setSectionId] = useState("");
  const [runId, setRunId] = useState("");
  const [lastImportResult, setLastImportResult] = useState<CaseImportResult | null>(null);

  const importJobsQuery = useQuery({
    queryKey: ["import-jobs", projectId],
    queryFn: () => fetchImportJobs(projectId),
    enabled: Boolean(projectId)
  });
  const exportJobsQuery = useQuery({
    queryKey: ["export-jobs", projectId],
    queryFn: () => fetchExportJobs(projectId),
    enabled: Boolean(projectId)
  });

  const importMutation = useMutation({
    mutationFn: (dryRun: boolean) =>
      importCasesCsv({
        projectId,
        csv,
        dryRun,
        atomic: true,
        sectionId: sectionId.trim() || undefined
      }),
    onSuccess: (result) => {
      setLastImportResult(result);
      void qc.invalidateQueries({ queryKey: ["import-jobs", projectId] });
      void qc.invalidateQueries({ queryKey: ["cases", projectId] });
    }
  });

  const caseExportMutation = useMutation({
    mutationFn: () => downloadCasesCsv(projectId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["export-jobs", projectId] });
    }
  });

  const resultExportMutation = useMutation({
    mutationFn: () => downloadRunResultsCsv(projectId, runId.trim()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["export-jobs", projectId] });
    }
  });

  const isImportBusy = importMutation.isPending;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Import / Export</h1>
        <p className="mt-1 text-sm text-slate-600">Move cases and execution results in and out of the project.</p>
      </div>

      <section className="rounded border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Case CSV Import</h2>
            <p className="mt-1 text-xs text-slate-500">
              Columns: section_id, title, preconditions, priority, type, refs (References), labels, automation_key,
              external_id, custom_{"{systemName}"}, steps. Import also accepts references / References headers; empty
              refs cells import as blank.
            </p>
          </div>
          <input
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
            placeholder="Default section ID"
            className="w-40 rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          className="mt-3 min-h-[220px] w-full rounded border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-slate-400"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isImportBusy || !csv.trim()}
            onClick={() => importMutation.mutate(true)}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            {isImportBusy ? "Checking..." : "Dry run"}
          </button>
          <button
            type="button"
            disabled={isImportBusy || !csv.trim()}
            onClick={() => importMutation.mutate(false)}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {isImportBusy ? "Importing..." : "Import cases"}
          </button>
        </div>
        {importMutation.isError ? (
          <p className="mt-2 text-sm text-red-700">{(importMutation.error as Error).message}</p>
        ) : null}
        <div className="mt-3">
          <ImportResult result={lastImportResult} />
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Exports</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={caseExportMutation.isPending}
            onClick={() => caseExportMutation.mutate()}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {caseExportMutation.isPending ? "Exporting..." : "Export cases CSV"}
          </button>
          <input
            value={runId}
            onChange={(e) => setRunId(e.target.value)}
            placeholder="Run ID"
            className="w-32 rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            disabled={resultExportMutation.isPending || !runId.trim()}
            onClick={() => resultExportMutation.mutate()}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            {resultExportMutation.isPending ? "Exporting..." : "Export run results"}
          </button>
        </div>
        {caseExportMutation.isError ? (
          <p className="mt-2 text-sm text-red-700">{(caseExportMutation.error as Error).message}</p>
        ) : null}
        {resultExportMutation.isError ? (
          <p className="mt-2 text-sm text-red-700">{(resultExportMutation.error as Error).message}</p>
        ) : null}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <JobTable title="Import Jobs" rows={importJobsQuery.data ?? []} />
        <JobTable title="Export Jobs" rows={exportJobsQuery.data ?? []} />
      </div>
    </div>
  );
}
