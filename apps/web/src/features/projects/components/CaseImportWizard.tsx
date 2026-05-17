import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  importCasesCsv,
  loadSavedCaseCsvMapping,
  saveCaseCsvMapping,
  shouldUseAsyncImport,
  suggestCaseCsvMapping,
  type CaseImportProfile,
  type CaseImportResult
} from "../api/importExportApi";
import { buildCaseCsvTemplate, extractCsvHeaders } from "../utils/caseCsvHeaders";
import { CaseCsvMappingPanel } from "./CaseCsvMappingPanel";
import { CaseImportValidationPanel } from "./CaseImportValidationPanel";

const sampleCsv = [
  "section_id,title,preconditions,priority,type,refs,labels,automation_key,external_id,custom_risk,steps",
  ',"Checkout with saved card","User has saved card",High,Regression,REQ-1,checkout|payment,checkout.saved_card,EXT-100,High,"Open checkout=>Checkout opens|Pay with saved card=>Payment succeeds"'
].join("\n");

type WizardStep = "source" | "mapping" | "validate" | "import";

const STEPS: Array<{ id: WizardStep; label: string }> = [
  { id: "source", label: "1. Source" },
  { id: "mapping", label: "2. Map columns" },
  { id: "validate", label: "3. Validate" },
  { id: "import", label: "4. Import" }
];

type Props = {
  projectId: string;
  profile: CaseImportProfile | undefined;
  onImportComplete: (result: CaseImportResult) => void;
};

export function CaseImportWizard({ projectId, profile, onImportComplete }: Props) {
  const [step, setStep] = useState<WizardStep>("source");
  const [csv, setCsv] = useState(sampleCsv);
  const [fileName, setFileName] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState("");
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [mappingInitialized, setMappingInitialized] = useState(false);
  const [lastImportResult, setLastImportResult] = useState<CaseImportResult | null>(null);
  const [asyncHint, setAsyncHint] = useState(false);

  const headers = useMemo(() => extractCsvHeaders(csv), [csv]);
  const csvBytes = useMemo(() => new TextEncoder().encode(csv).length, [csv]);

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
    setAsyncHint(shouldUseAsyncImport(csv));
  }, [csv]);

  useEffect(() => {
    if (step !== "mapping" || !projectId || headers.length === 0) return;
    if (mappingInitialized) return;
    void applySuggestedMapping(headers).finally(() => setMappingInitialized(true));
  }, [applySuggestedMapping, headers, mappingInitialized, projectId, step]);

  const dryRunMutation = useMutation({
    mutationFn: () =>
      importCasesCsv({
        projectId,
        csv,
        dryRun: true,
        atomic: true,
        sectionId: sectionId.trim() || undefined,
        columnMapping,
        preferAsync: asyncHint
      }),
    onSuccess: (result) => {
      setLastImportResult(result);
      onImportComplete(result);
      setStep("import");
    }
  });

  const commitMutation = useMutation({
    mutationFn: () =>
      importCasesCsv({
        projectId,
        csv,
        dryRun: false,
        atomic: true,
        sectionId: sectionId.trim() || undefined,
        columnMapping,
        preferAsync: asyncHint
      }),
    onSuccess: (result) => {
      setLastImportResult(result);
      onImportComplete(result);
    }
  });

  const isBusy = dryRunMutation.isPending || commitMutation.isPending;
  const canCommit =
    lastImportResult != null &&
    lastImportResult.summary.invalidRows === 0 &&
    lastImportResult.summary.validRows > 0;

  const onFileChange = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    setMappingInitialized(false);
    setLastImportResult(null);
  };

  const downloadTemplate = () => {
    const exportHeaders = profile?.exportHeaders ?? extractCsvHeaders(sampleCsv);
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
      <nav className="flex flex-wrap gap-2" aria-label="Import wizard steps">
        {STEPS.map((item) => {
          const active = item.id === step;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setStep(item.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {step === "source" ? (
        <WizardSection
          title="Upload or paste CSV"
          description="Large files run as background import jobs so the browser stays responsive."
        >
          <WizardSourceControls
            fileName={fileName}
            sectionId={sectionId}
            csvBytes={csvBytes}
            asyncHint={asyncHint}
            onFileChange={onFileChange}
            onSectionIdChange={setSectionId}
            onDownloadTemplate={downloadTemplate}
          />
          <textarea
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setFileName(null);
              setMappingInitialized(false);
              setLastImportResult(null);
            }}
            className="mt-3 min-h-[160px] w-full rounded border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-slate-400"
          />
          <WizardNav
            onBack={null}
            onNext={() => setStep("mapping")}
            nextLabel="Continue to mapping"
            nextDisabled={headers.length === 0}
          />
        </WizardSection>
      ) : null}

      {step === "mapping" ? (
        <WizardSection
          title="Map CSV columns"
          description="Match file headers to canonical case fields before validation."
        >
          <CaseCsvMappingPanel
            headers={headers}
            profile={profile}
            mapping={columnMapping}
            onChange={setColumnMapping}
            onSuggest={() => void applySuggestedMapping(headers)}
            onSave={() => saveCaseCsvMapping(projectId, columnMapping)}
            onClearSaved={() => {
              void applySuggestedMapping(headers);
            }}
            hasSavedMapping={Boolean(projectId && loadSavedCaseCsvMapping(projectId))}
          />
          <WizardNav onBack={() => setStep("source")} onNext={() => setStep("validate")} nextLabel="Continue to validation" />
        </WizardSection>
      ) : null}

      {step === "validate" ? (
        <WizardSection title="Dry run" description="Validate every row before committing.">
          {asyncHint ? (
            <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              This file is large; validation runs as a background job. Watch progress in the job table below.
            </p>
          ) : null}
          <button
            type="button"
            disabled={isBusy || !csv.trim() || headers.length === 0}
            onClick={() => dryRunMutation.mutate()}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            {dryRunMutation.isPending ? "Validating…" : "Run dry run"}
          </button>
          {dryRunMutation.isError ? (
            <p className="text-sm text-red-700">{(dryRunMutation.error as Error).message}</p>
          ) : null}
          <CaseImportValidationPanel result={lastImportResult} />
          <WizardNav onBack={() => setStep("mapping")} onNext={null} />
        </WizardSection>
      ) : null}

      {step === "import" ? (
        <WizardSection title="Commit import" description="Import only after a successful dry run with zero errors.">
          {asyncHint ? (
            <p className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
              Large imports are processed in the background; watch job status in the history table.
            </p>
          ) : null}
          <button
            type="button"
            disabled={isBusy || !canCommit}
            onClick={() => commitMutation.mutate()}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            title={canCommit ? undefined : "Complete a successful dry run first"}
          >
            {commitMutation.isPending ? "Importing…" : "Import cases"}
          </button>
          {commitMutation.isError ? (
            <p className="text-sm text-red-700">{(commitMutation.error as Error).message}</p>
          ) : null}
          <CaseImportValidationPanel result={lastImportResult} />
          <WizardNav onBack={() => setStep("validate")} onNext={null} />
        </WizardSection>
      ) : null}
    </div>
  );
}

function WizardSection({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
      {children}
    </div>
  );
}

function WizardSourceControls(props: {
  fileName: string | null;
  sectionId: string;
  csvBytes: number;
  asyncHint: boolean;
  onFileChange: (file: File | null) => void;
  onSectionIdChange: (value: string) => void;
  onDownloadTemplate: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="cursor-pointer rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
        {props.fileName ? `File: ${props.fileName}` : "Choose CSV file"}
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => void props.onFileChange(e.target.files?.[0] ?? null)}
        />
      </label>
      <button
        type="button"
        onClick={props.onDownloadTemplate}
        className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        Download template
      </button>
      <input
        value={props.sectionId}
        onChange={(e) => props.onSectionIdChange(e.target.value)}
        placeholder="Default section ID"
        className="w-40 rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
      <span className="text-xs text-slate-500">
        {(props.csvBytes / 1024).toFixed(1)} KB
        {props.asyncHint ? " · background job" : ""}
      </span>
    </div>
  );
}

function WizardNav(props: {
  onBack: (() => void) | null;
  onNext: (() => void) | null;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2 pt-2">
      {props.onBack ? (
        <button
          type="button"
          onClick={props.onBack}
          className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
        >
          Back
        </button>
      ) : (
        <span />
      )}
      {props.onNext ? (
        <button
          type="button"
          disabled={props.nextDisabled}
          onClick={props.onNext}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {props.nextLabel ?? "Next"}
        </button>
      ) : null}
    </div>
  );
}
