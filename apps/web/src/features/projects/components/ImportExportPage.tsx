import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";

import {
  downloadCasesCsv,
  downloadCasesJson,
  downloadCasesXml,
  downloadExportJob,
  downloadAttachmentsExport,
  downloadRunResultsCsv,
  fetchCaseImportProfile,
  importAttachmentsManifest,
  importCasesStructured,
  requestAttachmentsExportAsync,
  pollExportJobUntilReady,
  requestCasesExportAsync,
  requestRunResultsExportAsync,
  type CaseImportResult,
  type StructuredCaseImportFormat
} from "../api/importExportApi";
import { BddFeatureImportSection } from "./BddFeatureImportSection";
import { CaseImportWizard } from "./CaseImportWizard";
import { CaseImportValidationPanel } from "./CaseImportValidationPanel";
import { ImportExportJobsPanel } from "./ImportExportJobsPanel";

const sampleJson = JSON.stringify(
  {
    cases: [
      {
        title: "Checkout with saved card",
        preconditions: "User has saved card",
        priority: "High",
        type: "Regression",
        refs: ["REQ-1"],
        labels: ["checkout", "payment"],
        automation_key: "checkout.saved_card",
        external_id: "EXT-100",
        customValues: { risk: "High" },
        steps: [{ content: "Open checkout", expected_result: "Checkout opens" }]
      }
    ]
  },
  null,
  2
);

const sampleXml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  "<cases>",
  '  <case>',
  "    <title>Checkout with saved card</title>",
  "    <preconditions>User has saved card</preconditions>",
  "    <priority>High</priority>",
  "    <type>Regression</type>",
  "    <refs>REQ-1</refs>",
  "    <labels><label>checkout</label><label>payment</label></labels>",
  "    <automation_key>checkout.saved_card</automation_key>",
  "    <external_id>EXT-100</external_id>",
  '    <custom_values><custom name="risk">High</custom></custom_values>',
  "    <steps><step><content>Open checkout</content><expected_result>Checkout opens</expected_result></step></steps>",
  "  </case>",
  "</cases>"
].join("\n");

type StructuredFormat = StructuredCaseImportFormat;

export function ImportExportPage() {
  const { projectId = "" } = useParams();
  const qc = useQueryClient();
  const [importFormat, setImportFormat] = useState<"csv" | StructuredFormat>("csv");
  const [structuredContent, setStructuredContent] = useState(sampleJson);
  const [sectionId, setSectionId] = useState("");
  const [runId, setRunId] = useState("");
  const [lastImportResult, setLastImportResult] = useState<CaseImportResult | null>(null);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const [attachmentCaseId, setAttachmentCaseId] = useState("");
  const [attachmentRunId, setAttachmentRunId] = useState("");
  const [attachmentManifest, setAttachmentManifest] = useState("");
  const [attachmentImportFeedback, setAttachmentImportFeedback] = useState<string | null>(null);
  const [includeAttachmentContent, setIncludeAttachmentContent] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["case-import-profile", projectId],
    queryFn: () => fetchCaseImportProfile(projectId),
    enabled: Boolean(projectId)
  });

  const structuredImportMutation = useMutation({
    mutationFn: (dryRun: boolean) =>
      importCasesStructured({
        projectId,
        format: importFormat as StructuredFormat,
        content: structuredContent,
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

  const queueCasesExport = useMutation({
    mutationFn: (format: "csv" | "json" | "xml") => requestCasesExportAsync(projectId, format),
    onSuccess: async (data, exportFormat) => {
      setExportFeedback(`Export #${data.job.id} queued.`);
      void qc.invalidateQueries({ queryKey: ["export-jobs", projectId] });
      await pollExportJobUntilReady(projectId, data.job.id);
      await downloadExportJob(
        projectId,
        data.job.id,
        exportFormat === "json" ? "cases.json" : exportFormat === "xml" ? "cases.xml" : "cases.csv"
      );
      setExportFeedback(`Export #${data.job.id} downloaded.`);
    },
    onError: (e) => setExportFeedback(e instanceof Error ? e.message : "Export failed")
  });

  const queueRunExport = useMutation({
    mutationFn: () => requestRunResultsExportAsync(projectId, runId.trim()),
    onSuccess: async (data) => {
      setExportFeedback(`Run export #${data.job.id} queued.`);
      void qc.invalidateQueries({ queryKey: ["export-jobs", projectId] });
      await pollExportJobUntilReady(projectId, data.job.id);
      await downloadExportJob(projectId, data.job.id, `run-${runId.trim()}-results.csv`);
      setExportFeedback(`Run export #${data.job.id} downloaded.`);
    },
    onError: (e) => setExportFeedback(e instanceof Error ? e.message : "Export failed")
  });

  const syncCaseCsvExport = useMutation({
    mutationFn: () => downloadCasesCsv(projectId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["export-jobs", projectId] })
  });
  const syncCaseJsonExport = useMutation({
    mutationFn: () => downloadCasesJson(projectId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["export-jobs", projectId] })
  });
  const syncCaseXmlExport = useMutation({
    mutationFn: () => downloadCasesXml(projectId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["export-jobs", projectId] })
  });
  const syncRunExport = useMutation({
    mutationFn: () => downloadRunResultsCsv(projectId, runId.trim()),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["export-jobs", projectId] })
  });

  const queueAttachmentsExport = useMutation({
    mutationFn: () =>
      requestAttachmentsExportAsync(projectId, {
        caseId: attachmentCaseId.trim() || undefined,
        runId: attachmentRunId.trim() || undefined,
        includeContent: includeAttachmentContent
      }),
    onSuccess: async (data) => {
      setExportFeedback(`Attachment export #${data.job.id} queued.`);
      void qc.invalidateQueries({ queryKey: ["export-jobs", projectId] });
      await pollExportJobUntilReady(projectId, data.job.id);
      await downloadExportJob(projectId, data.job.id, `project-${projectId}-attachments.json`);
      setExportFeedback(`Attachment export #${data.job.id} downloaded.`);
    },
    onError: (e) => setExportFeedback(e instanceof Error ? e.message : "Attachment export failed")
  });

  const syncAttachmentsExport = useMutation({
    mutationFn: () =>
      downloadAttachmentsExport(projectId, {
        caseId: attachmentCaseId.trim() || undefined,
        runId: attachmentRunId.trim() || undefined,
        includeContent: includeAttachmentContent
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["export-jobs", projectId] })
  });

  const attachmentImportMutation = useMutation({
    mutationFn: (dryRun: boolean) =>
      importAttachmentsManifest({
        projectId,
        manifest: attachmentManifest,
        dryRun,
        replaceExisting: false
      }),
    onSuccess: (result, dryRun) => {
      setAttachmentImportFeedback(
        dryRun
          ? `Dry run: ${result.summary.imported} would import (${result.summary.failed} failed, ${result.summary.skipped} skipped).`
          : `Imported ${result.summary.imported} attachment(s).`
      );
      void qc.invalidateQueries({ queryKey: ["import-jobs", projectId] });
    },
    onError: (e) =>
      setAttachmentImportFeedback(e instanceof Error ? e.message : "Attachment import failed")
  });

  const isStructuredBusy = structuredImportMutation.isPending;
  const canCommitStructured =
    lastImportResult != null &&
    lastImportResult.summary.invalidRows === 0 &&
    lastImportResult.summary.validRows > 0;

  const setFormat = (format: "csv" | StructuredFormat) => {
    setImportFormat(format);
    if (format === "json") setStructuredContent(sampleJson);
    if (format === "xml") setStructuredContent(sampleXml);
    setLastImportResult(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Import / Export</h1>
        <p className="mt-1 text-sm text-slate-600">
          CSV imports use a guided mapping wizard. Large files and exports run as background jobs with polling and download.
        </p>
      </div>

      <BddFeatureImportSection projectId={projectId} />

      <section className="rounded border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Case import</h2>
            <p className="mt-1 text-xs text-slate-500">CSV uses a four-step wizard. JSON/XML keep the direct editor flow.</p>
          </div>
          <select
            value={importFormat}
            onChange={(e) => setFormat(e.target.value as "csv" | StructuredFormat)}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="csv">CSV (wizard)</option>
            <option value="json">JSON</option>
            <option value="xml">XML</option>
          </select>
        </div>

        {importFormat === "csv" ? (
          <div className="mt-4">
            <CaseImportWizard
              projectId={projectId}
              profile={profileQuery.data}
              onImportComplete={(result) => {
                setLastImportResult(result);
                void qc.invalidateQueries({ queryKey: ["import-jobs", projectId] });
                void qc.invalidateQueries({ queryKey: ["cases", projectId] });
              }}
            />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <input
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              placeholder="Default section ID"
              className="w-48 rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
            <textarea
              value={structuredContent}
              onChange={(e) => {
                setStructuredContent(e.target.value);
                setLastImportResult(null);
              }}
              className="min-h-[180px] w-full rounded border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-slate-400"
            />
            <div className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
              {importFormat === "json"
                ? 'JSON import accepts { "cases": [...] } or an array.'
                : "XML import accepts the exported <cases> shape."}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isStructuredBusy || !structuredContent.trim()}
                onClick={() => structuredImportMutation.mutate(true)}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                {isStructuredBusy ? "Checking…" : "Dry run"}
              </button>
              <button
                type="button"
                disabled={isStructuredBusy || !structuredContent.trim() || !canCommitStructured}
                onClick={() => structuredImportMutation.mutate(false)}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Import cases
              </button>
            </div>
            {structuredImportMutation.isError ? (
              <p className="text-sm text-red-700">{(structuredImportMutation.error as Error).message}</p>
            ) : null}
            <CaseImportValidationPanel result={lastImportResult} />
          </div>
        )}
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Exports</h2>
        <p className="mt-1 text-xs text-slate-500">
          Queue exports for large projects (recommended) or use quick download for small datasets.
        </p>
        {exportFeedback ? <p className="mt-2 text-xs text-slate-600">{exportFeedback}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={queueCasesExport.isPending}
            onClick={() => queueCasesExport.mutate("csv")}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {queueCasesExport.isPending ? "Exporting…" : "Queue cases CSV"}
          </button>
          <button
            type="button"
            disabled={queueCasesExport.isPending}
            onClick={() => queueCasesExport.mutate("json")}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            Queue cases JSON
          </button>
          <button
            type="button"
            disabled={queueCasesExport.isPending}
            onClick={() => queueCasesExport.mutate("xml")}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            Queue cases XML
          </button>
          <button
            type="button"
            disabled={syncCaseCsvExport.isPending}
            onClick={() => syncCaseCsvExport.mutate()}
            className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Quick CSV
          </button>
          <button
            type="button"
            disabled={syncCaseJsonExport.isPending}
            onClick={() => syncCaseJsonExport.mutate()}
            className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Quick JSON
          </button>
          <button
            type="button"
            disabled={syncCaseXmlExport.isPending}
            onClick={() => syncCaseXmlExport.mutate()}
            className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Quick XML
          </button>
          <input
            value={runId}
            onChange={(e) => setRunId(e.target.value)}
            placeholder="Run ID"
            className="w-32 rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            disabled={queueRunExport.isPending || !runId.trim()}
            onClick={() => queueRunExport.mutate()}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            {queueRunExport.isPending ? "Exporting…" : "Queue run results"}
          </button>
          <button
            type="button"
            disabled={syncRunExport.isPending || !runId.trim()}
            onClick={() => syncRunExport.mutate()}
            className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Quick run CSV
          </button>
        </div>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Attachment import / export</h2>
        <p className="mt-1 text-xs text-slate-500">
          Export case and result attachment metadata as JSON (optional inline base64 when blobs were imported).
          Re-import manifests to register links in another environment.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={attachmentCaseId}
            onChange={(e) => setAttachmentCaseId(e.target.value)}
            placeholder="Filter case ID (optional)"
            className="w-36 rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
          <input
            value={attachmentRunId}
            onChange={(e) => setAttachmentRunId(e.target.value)}
            placeholder="Filter run ID (optional)"
            className="w-36 rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={includeAttachmentContent}
              onChange={(e) => setIncludeAttachmentContent(e.target.checked)}
            />
            Include inline content
          </label>
          <button
            type="button"
            disabled={queueAttachmentsExport.isPending}
            onClick={() => void queueAttachmentsExport.mutateAsync()}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Queue export
          </button>
          <button
            type="button"
            disabled={syncAttachmentsExport.isPending}
            onClick={() => syncAttachmentsExport.mutate()}
            className="rounded border border-slate-200 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-50"
          >
            Quick export
          </button>
        </div>
        <textarea
          value={attachmentManifest}
          onChange={(e) => setAttachmentManifest(e.target.value)}
          placeholder='Paste attachment manifest JSON (version 1, "attachments" array)'
          className="mt-3 min-h-[120px] w-full rounded border border-slate-300 px-3 py-2 font-mono text-xs"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={attachmentImportMutation.isPending || !attachmentManifest.trim()}
            onClick={() => attachmentImportMutation.mutate(true)}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Dry run import
          </button>
          <button
            type="button"
            disabled={attachmentImportMutation.isPending || !attachmentManifest.trim()}
            onClick={() => attachmentImportMutation.mutate(false)}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Import attachments
          </button>
        </div>
        {attachmentImportFeedback ? (
          <p className="mt-2 text-xs text-slate-600">{attachmentImportFeedback}</p>
        ) : null}
      </section>

      <ImportExportJobsPanel projectId={projectId} />
    </div>
  );
}
