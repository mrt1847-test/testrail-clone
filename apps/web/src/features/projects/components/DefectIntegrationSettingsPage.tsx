import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import {
  fetchDefectIntegrationSettings,
  updateDefectIntegrationSettings
} from "../api/advancedApi";

export function DefectIntegrationSettingsPage() {
  const { projectId = "" } = useParams();
  const qc = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ["defect-integration-settings", projectId],
    queryFn: () => fetchDefectIntegrationSettings(projectId),
    enabled: Boolean(projectId)
  });

  const [provider, setProvider] = useState("custom");
  const [isEnabled, setIsEnabled] = useState(false);
  const [issueUrlTemplate, setIssueUrlTemplate] = useState("");
  const [defaultProjectKey, setDefaultProjectKey] = useState("");

  useEffect(() => {
    if (!settingsQuery.data) return;
    setProvider(settingsQuery.data.provider);
    setIsEnabled(settingsQuery.data.isEnabled);
    setIssueUrlTemplate(settingsQuery.data.issueUrlTemplate ?? "");
    setDefaultProjectKey(settingsQuery.data.defaultProjectKey ?? "");
  }, [settingsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateDefectIntegrationSettings({
        projectId,
        provider: provider.trim() || "custom",
        isEnabled,
        issueUrlTemplate: issueUrlTemplate.trim() || null,
        defaultProjectKey: defaultProjectKey.trim() || null
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["defect-integration-settings", projectId] });
    }
  });

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <header>
        <h2 className="text-base font-semibold text-slate-900">Defect Integration Settings</h2>
        <p className="text-xs text-slate-500">Defect push URL template and provider baseline settings</p>
      </header>
      {settingsQuery.isLoading ? (
        <p className="text-sm text-slate-500">Loading settings…</p>
      ) : (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} />
            Enable integration
          </label>
          <label className="block space-y-1 text-sm text-slate-700">
            <span>Provider</span>
            <input
              className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="custom / jira / github"
            />
          </label>
          <label className="block space-y-1 text-sm text-slate-700">
            <span>Issue URL template</span>
            <input
              className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
              value={issueUrlTemplate}
              onChange={(e) => setIssueUrlTemplate(e.target.value)}
              placeholder="https://jira.example/browse/{key}"
            />
          </label>
          <label className="block space-y-1 text-sm text-slate-700">
            <span>Default project key</span>
            <input
              className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
              value={defaultProjectKey}
              onChange={(e) => setDefaultProjectKey(e.target.value)}
              placeholder="QA"
            />
          </label>
          <button
            type="button"
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            disabled={updateMutation.isPending}
            onClick={() => void updateMutation.mutateAsync()}
          >
            {updateMutation.isPending ? "Saving…" : "Save settings"}
          </button>
        </div>
      )}
    </section>
  );
}
