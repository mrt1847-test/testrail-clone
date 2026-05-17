import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import {
  fetchDefectIntegrationSettings,
  fetchDefectTemplatePreview,
  testDefectIntegrationConnection,
  updateDefectIntegrationSettings,
  type DefectCreateMode,
  type DefectIntegrationConnectionTestResult
} from "../api/settingsApi";

const PROVIDER_OPTIONS = [
  { value: "jira", label: "Jira" },
  { value: "github", label: "GitHub" },
  { value: "azure_devops", label: "Azure DevOps" },
  { value: "custom", label: "Custom (URL template)" }
] as const;

const CREATE_MODE_OPTIONS: Array<{ value: DefectCreateMode; label: string }> = [
  { value: "url_template", label: "URL template (link existing issues)" },
  { value: "provider_api", label: "Provider API (create/sync issues)" }
];

const PROVIDER_TEMPLATE_HINTS: Record<string, string> = {
  jira: "https://your-domain.atlassian.net/browse/{key}",
  github: "https://github.com/org/repo/issues/{key}",
  azure_devops: "https://dev.azure.com/org/project/_workitems/edit/{key}",
  custom: "https://tracker.example/issues/{key}"
};

function checkTone(status: "pass" | "fail" | "warn") {
  if (status === "pass") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "fail") return "border-rose-200 bg-rose-50 text-rose-900";
  return "border-amber-200 bg-amber-50 text-amber-900";
}

export function DefectIntegrationSettingsPage() {
  const { projectId = "" } = useParams();
  const qc = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ["defect-integration-settings", projectId],
    queryFn: () => fetchDefectIntegrationSettings(projectId),
    enabled: Boolean(projectId)
  });

  const [provider, setProvider] = useState("custom");
  const [createMode, setCreateMode] = useState<DefectCreateMode>("url_template");
  const [isEnabled, setIsEnabled] = useState(false);
  const [issueUrlTemplate, setIssueUrlTemplate] = useState("");
  const [defaultProjectKey, setDefaultProjectKey] = useState("");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [clearApiToken, setClearApiToken] = useState(false);
  const [sampleIssueKey, setSampleIssueKey] = useState("");
  const [testResult, setTestResult] = useState<DefectIntegrationConnectionTestResult | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!settingsQuery.data) return;
    setProvider(settingsQuery.data.provider);
    setCreateMode(settingsQuery.data.createMode);
    setIsEnabled(settingsQuery.data.isEnabled);
    setIssueUrlTemplate(settingsQuery.data.issueUrlTemplate ?? "");
    setDefaultProjectKey(settingsQuery.data.defaultProjectKey ?? "");
    setApiBaseUrl(settingsQuery.data.apiBaseUrl ?? "");
    setApiToken("");
    setClearApiToken(false);
  }, [settingsQuery.data]);

  const draftPayload = () => ({
    projectId,
    provider: provider.trim() || "custom",
    isEnabled,
    createMode,
    issueUrlTemplate: issueUrlTemplate.trim() || null,
    defaultProjectKey: defaultProjectKey.trim() || null,
    apiBaseUrl: apiBaseUrl.trim() || null,
    ...(apiToken.trim() ? { apiToken: apiToken.trim() } : {}),
    ...(clearApiToken ? { clearApiToken: true } : {})
  });

  const previewQuery = useQuery({
    queryKey: [
      "defect-template-preview",
      projectId,
      provider,
      createMode,
      issueUrlTemplate,
      defaultProjectKey,
      sampleIssueKey
    ],
    queryFn: () =>
      fetchDefectTemplatePreview(projectId, {
        provider,
        createMode,
        issueUrlTemplate: issueUrlTemplate.trim() || null,
        defaultProjectKey: defaultProjectKey.trim() || null,
        sampleIssueKey: sampleIssueKey.trim() || undefined
      }),
    enabled: Boolean(projectId && issueUrlTemplate.trim())
  });

  const updateMutation = useMutation({
    mutationFn: () => updateDefectIntegrationSettings(draftPayload()),
    onSuccess: () => {
      setSaveError(null);
      setApiToken("");
      setClearApiToken(false);
      void qc.invalidateQueries({ queryKey: ["defect-integration-settings", projectId] });
    },
    onError: (error) => {
      setSaveError(error instanceof Error ? error.message : "Could not save settings");
    }
  });

  const testMutation = useMutation({
    mutationFn: () =>
      testDefectIntegrationConnection({
        ...draftPayload(),
        sampleIssueKey: sampleIssueKey.trim() || undefined,
        ...(apiToken.trim() ? { apiToken: apiToken.trim() } : {})
      }),
    onSuccess: (result) => {
      setSaveError(null);
      setTestResult(result);
    },
    onError: (error) => {
      setTestResult(null);
      setSaveError(error instanceof Error ? error.message : "Connection test failed");
    }
  });

  const templateHint = PROVIDER_TEMPLATE_HINTS[provider] ?? PROVIDER_TEMPLATE_HINTS.custom;

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header>
        <h2 className="text-base font-semibold text-slate-900">Defect integration</h2>
        <p className="text-xs text-slate-500">
          Link defects with URL templates or create/sync issues through provider API adapters (baseline
          simulated mode when API credentials are not configured).
        </p>
      </header>
      {settingsQuery.isLoading ? (
        <p className="text-sm text-slate-500">Loading settings…</p>
      ) : (
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} />
            Enable integration
          </label>

          <label className="block space-y-1 text-sm text-slate-700">
            <span>Provider</span>
            <select
              className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              {PROVIDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-sm text-slate-700">
            <span>Create mode</span>
            <select
              className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
              value={createMode}
              onChange={(e) => setCreateMode(e.target.value as DefectCreateMode)}
            >
              {CREATE_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-sm text-slate-700">
            <span>Issue URL template</span>
            <input
              className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm font-mono"
              value={issueUrlTemplate}
              onChange={(e) => setIssueUrlTemplate(e.target.value)}
              placeholder={templateHint}
            />
            <p className="text-xs text-slate-500">Must include {"{key}"}. Example: {templateHint}</p>
          </label>

          {previewQuery.data ? (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-sm text-slate-800">
              <p className="font-medium text-slate-900">Template preview</p>
              <p className="mt-1 text-xs text-slate-600">
                {previewQuery.data.providerLabel} · {previewQuery.data.createMode}
              </p>
              <p className="mt-2 text-xs">
                Sample key <span className="font-mono">{previewQuery.data.sampleIssueKey}</span>
                {previewQuery.data.url ? (
                  <>
                    {" "}
                    →{" "}
                    <a href={previewQuery.data.url} className="text-indigo-800 underline" target="_blank" rel="noreferrer">
                      {previewQuery.data.url}
                    </a>
                  </>
                ) : (
                  <span className="text-rose-700"> (could not resolve URL)</span>
                )}
              </p>
              {createMode === "provider_api" ? (
                <p className="mt-2 text-xs text-slate-600">
                  Push fields: {previewQuery.data.fieldHints.join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}

          <label className="block space-y-1 text-sm text-slate-700">
            <span>Default project key</span>
            <input
              className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
              value={defaultProjectKey}
              onChange={(e) => setDefaultProjectKey(e.target.value)}
              placeholder="QA"
            />
          </label>

          {createMode === "provider_api" ? (
            <>
              <label className="block space-y-1 text-sm text-slate-700">
                <span>API base URL (optional)</span>
                <input
                  className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm font-mono"
                  value={apiBaseUrl}
                  onChange={(e) => setApiBaseUrl(e.target.value)}
                  placeholder="https://defect-bridge.example/api"
                />
              </label>
              <label className="block space-y-1 text-sm text-slate-700">
                <span>API token</span>
                <input
                  type="password"
                  className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder={settingsQuery.data?.hasApiToken ? "•••••••• (saved)" : "Bearer token"}
                />
                {settingsQuery.data?.hasApiToken ? (
                  <label className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={clearApiToken}
                      onChange={(e) => setClearApiToken(e.target.checked)}
                    />
                    Clear saved token on save
                  </label>
                ) : null}
              </label>
            </>
          ) : null}

          <label className="block space-y-1 text-sm text-slate-700">
            <span>Sample issue key (optional)</span>
            <input
              className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
              value={sampleIssueKey}
              onChange={(e) => setSampleIssueKey(e.target.value)}
              placeholder={defaultProjectKey.trim() ? `${defaultProjectKey.trim()}-1` : "TEST-1"}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              disabled={testMutation.isPending}
              onClick={() => void testMutation.mutateAsync()}
            >
              {testMutation.isPending ? "Testing…" : "Test connection"}
            </button>
            <button
              type="button"
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              disabled={updateMutation.isPending}
              onClick={() => void updateMutation.mutateAsync()}
            >
              {updateMutation.isPending ? "Saving…" : "Save settings"}
            </button>
          </div>

          {saveError ? <p className="text-sm text-rose-700">{saveError}</p> : null}

          {testResult ? (
            <div
              className={`rounded-lg border p-3 ${testResult.ok ? "border-emerald-200 bg-emerald-50/80" : "border-rose-200 bg-rose-50/80"}`}
            >
              <p className="text-sm font-medium text-slate-900">
                {testResult.ok ? "Connection test passed" : "Connection test failed"}
              </p>
              <ul className="mt-2 space-y-1.5">
                {testResult.checks.map((check, index) => (
                  <li
                    key={`${check.code}-${index}`}
                    className={`rounded border px-2.5 py-1.5 text-xs ${checkTone(check.status)}`}
                  >
                    {check.message}
                  </li>
                ))}
              </ul>
              {testResult.sampleUrls.length > 0 ? (
                <div className="mt-3 text-xs text-slate-700">
                  <p className="font-medium">Sample URLs</p>
                  <ul className="mt-1 space-y-1">
                    {testResult.sampleUrls.map((row) => (
                      <li key={row.key}>
                        {row.key}:{" "}
                        {row.url ? (
                          <a href={row.url} className="text-indigo-800 underline" target="_blank" rel="noreferrer">
                            {row.url}
                          </a>
                        ) : (
                          <span className="text-rose-700">Could not resolve</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
