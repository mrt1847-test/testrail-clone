import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import {
  clearSavedCaseCsvMapping,
  downloadCasesCsv,
  downloadRunResultsCsv,
  fetchCaseImportProfile,
  fetchExportJobs,
  fetchImportJobs,
  importCasesCsv,
  loadSavedCaseCsvMapping,
  saveCaseCsvMapping,
  suggestCaseCsvMapping,
  type CaseImportResult,
  type ImportExportJobRow
} from "../api/importExportApi";
import { buildCaseCsvTemplate, extractCsvHeaders } from "../utils/caseCsvHeaders";
import { CaseCsvMappingPanel } from "./CaseCsvMappingPanel";
import { CaseImportValidationPanel } from "./CaseImportValidationPanel";

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

export function ImportExportPage() {
  const { projectId = "" } = useParams();
  const qc = useQueryClient();
  const [csv, setCsv] = useState(sampleCsv);
  const [sectionId, setSectionId] = useState("");
  const [runId, setRunId] = useState("");
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [lastImportResult, setLastImportResult] = useState<CaseImportResult | null>(null);
  const [mappingInitialized, setMappingInitialized] = useState(false);

  const headers = useMemo(() => extractCsvHeaders(csv), [csv]);

  const profileQuery = useQuery({
    queryKey: ["case-import-profile", projectId],
    queryFn: () => fetchCaseImportProfile(projectId),
    enabled: Boolean(projectId)
  });

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

  const applySuggestedMapping = useCallback(
    async (headerList: string[]) => {
      if (!projectId || headerList.length === 0) return;
      const saved = loadSavedCaseCsvMapping(projectId);
      if (saved && headerList.every((header) => header in saved)) {
        setColumnMapping(saved);
        return;
      }
      const suggested = await suggestCaseCsvMapping(projectId, { headers: headerList });
      setColumnMapping(suggested.mapping);
    },
    [projectId]
  );

  useEffect(() => {
    if (!projectId || headers.length === 0) {
      setColumnMapping({});
      setMappingInitialized(false);
      return;
    }
    if (mappingInitialized) return;
    void applySuggestedMapping(headers).finally(() => setMappingInitialized(true));
  }, [applySuggestedMapping, headers, mappingInitialized, projectId]);

  useEffect(() => {
    setMappingInitialized(false);
  }, [csv]);

  const importMutation = useMutation({
    mutationFn: (dryRun: boolean) =>
      importCasesCsv({
        projectId,
        csv,
        dryRun,
        atomic: true,
        sectionId: sectionId.trim() || undefined,
        columnMapping
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
  const canCommit =
    lastImportResult != null &&
    lastImportResult.summary.invalidRows === 0 &&
    lastImportResult.summary.validRows > 0;

  const downloadTemplate = () => {
    const exportHeaders = profileQuery.data?.exportHeaders ?? extractCsvHeaders(sampleCsv);
    const template = buildCaseCsvTemplate(exportHeaders.filter((header) => header !== "id"), {
      title: "Sample case title",
      priority: "High",
      type: "Regression",
      refs: "REQ-1",
      steps: "Step one=>Expected one"
    });
    const blob = new Blob([template], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `project-${projectId}-cases-template.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Import / Export</h1>
        <p className="mt-1 text-sm text-slate-600">
          Map CSV columns to case fields, validate with a dry run, then import. Exports use the canonical column set.
        </p>
      </div>

      <section className="rounded border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Case CSV Import</h2>
            <p className="mt-1 text-xs text-slate-500">
              Step 1: paste CSV · Step 2: map columns · Step 3: dry run · Step 4: import when validation passes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={downloadTemplate}
              className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Download import template
            </button>
            <input
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              placeholder="Default section ID"
              className="w-40 rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          className="mt-3 min-h-[180px] w-full rounded border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-slate-400"
        />

        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Column mapping</h3>
          <div className="mt-2">
            <CaseCsvMappingPanel
              headers={headers}
              profile={profileQuery.data}
              mapping={columnMapping}
              onChange={setColumnMapping}
              onSuggest={() => void applySuggestedMapping(headers)}
              onSave={() => saveCaseCsvMapping(projectId, columnMapping)}
              onClearSaved={() => {
                clearSavedCaseCsvMapping(projectId);
                void applySuggestedMapping(headers);
              }}
              hasSavedMapping={Boolean(projectId && loadSavedCaseCsvMapping(projectId))}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isImportBusy || !csv.trim() || headers.length === 0}
            onClick={() => importMutation.mutate(true)}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            {isImportBusy ? "Checking..." : "Dry run (validate)"}
          </button>
          <button
            type="button"
            disabled={isImportBusy || !csv.trim() || !canCommit}
            onClick={() => importMutation.mutate(false)}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            title={canCommit ? undefined : "Run a successful dry run with no validation issues first"}
          >
            {isImportBusy ? "Importing..." : "Import cases"}
          </button>
        </div>
        {importMutation.isError ? (
          <p className="mt-2 text-sm text-red-700">{(importMutation.error as Error).message}</p>
        ) : null}
        <div className="mt-3">
          <CaseImportValidationPanel result={lastImportResult} />
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Exports</h2>
        <p className="mt-1 text-xs text-slate-500">
          Case export uses canonical headers from the import profile (including active custom fields).
        </p>
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


