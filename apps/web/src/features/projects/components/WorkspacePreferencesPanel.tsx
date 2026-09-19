import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { FormField, SaveFeedback, type SaveFeedbackStatus } from "../../../shared/ui";
import { fetchSuites } from "../api/suitesApi";
import type { SuiteSummary } from "../types";
import {
  useUpdateWorkspacePreferencesMutation,
  useWorkspacePreferences
} from "../hooks/useWorkspacePreferences";
import {
  WORKSPACE_LANDING_OPTIONS,
  type WorkspaceLandingPage,
  type WorkspacePreferences
} from "../workspacePreferences";
import { useCaseSavedViews } from "../../cases/hooks/useCaseSavedViews";
import { useAuth } from "../../auth/context/AuthContext";
import { defaultCaseListColumns } from "../../cases/hooks/useExpandedCase";

type WorkspacePreferencesPanelProps = {
  projectId: string;
};

const emptyView = {
  sectionId: null as number | null,
  filters: {
    q: "",
    priority: "" as const,
    caseType: "" as const,
    automation: "" as const,
    refs: "" as const,
    labels: "" as const,
    estimate: "" as const,
    state: "active" as const
  },
  columns: defaultCaseListColumns,
  scope: "subtree" as const
};

const selectClass = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";

export function WorkspacePreferencesPanel({ projectId }: WorkspacePreferencesPanelProps) {
  const { user } = useAuth();
  const preferencesQuery = useWorkspacePreferences(projectId);
  const updateMutation = useUpdateWorkspacePreferencesMutation(projectId);
  const suitesQuery = useQuery({
    queryKey: ["suites", projectId, "workspace-prefs"],
    queryFn: () => fetchSuites(projectId),
    enabled: Boolean(projectId)
  });
  const { savedViews } = useCaseSavedViews(projectId, user?.id, emptyView);

  const [landingPage, setLandingPage] = useState<WorkspaceLandingPage>("overview");
  const [defaultSuiteId, setDefaultSuiteId] = useState("");
  const [defaultSavedViewId, setDefaultSavedViewId] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveFeedbackStatus>("idle");
  const [lastPatch, setLastPatch] = useState<Partial<WorkspacePreferences> | null>(null);

  useEffect(() => {
    const prefs = preferencesQuery.data;
    if (!prefs) return;
    setLandingPage(prefs.landingPage);
    setDefaultSuiteId(prefs.defaultSuiteId ?? "");
    setDefaultSavedViewId(prefs.defaultSavedViewId ?? "");
  }, [preferencesQuery.data]);

  async function savePreferences(patch: Partial<WorkspacePreferences>) {
    setLastPatch(patch);
    setSaveStatus("saving");
    try {
      const next = await updateMutation.mutateAsync({
        landingPage: patch.landingPage ?? landingPage,
        defaultSuiteId: patch.defaultSuiteId !== undefined ? patch.defaultSuiteId : defaultSuiteId || null,
        defaultSavedViewId:
          patch.defaultSavedViewId !== undefined ? patch.defaultSavedViewId : defaultSavedViewId || null
      });
      setLandingPage(next.landingPage);
      setDefaultSuiteId(next.defaultSuiteId ?? "");
      setDefaultSavedViewId(next.defaultSavedViewId ?? "");
      setSaveStatus("saved");
    } catch {
      setSaveStatus("failed");
    }
  }

  if (preferencesQuery.isLoading) {
    return <p className="text-sm text-slate-500">Loading workspace defaults...</p>;
  }

  const suites: SuiteSummary[] = suitesQuery.data ?? [];

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-900">My workspace defaults</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Default landing page">
          {(control) => (
            <select
              {...control}
              className={selectClass}
              value={landingPage}
              onChange={(event) => {
                const value = event.target.value as WorkspaceLandingPage;
                setLandingPage(value);
                void savePreferences({ landingPage: value });
              }}
            >
              {WORKSPACE_LANDING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <FormField label="Default test suite">
          {(control) => (
            <select
              {...control}
              className={selectClass}
              value={defaultSuiteId}
              onChange={(event) => {
                const value = event.target.value;
                setDefaultSuiteId(value);
                void savePreferences({ defaultSuiteId: value || null });
              }}
            >
              <option value="">Use last selected suite</option>
              {suites.map((suite) => (
                <option key={suite.id} value={suite.id}>
                  {suite.name}
                  {suite.isMaster ? " (Master)" : ""}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <FormField
          className="md:col-span-2"
          label="Default saved case view"
          helpText={savedViews.length === 0 ? "Save a view from the Test Cases toolbar to list it here." : undefined}
        >
          {(control) => (
            <select
              {...control}
              className={selectClass}
              value={defaultSavedViewId}
              onChange={(event) => {
                const value = event.target.value;
                setDefaultSavedViewId(value);
                void savePreferences({ defaultSavedViewId: value || null });
              }}
            >
              <option value="">No default saved view</option>
              {savedViews.map((view) => (
                <option key={view.id} value={view.id}>
                  {view.name}
                </option>
              ))}
            </select>
          )}
        </FormField>
      </div>
      <SaveFeedback
        status={saveStatus}
        message={
          saveStatus === "failed"
            ? "Could not save workspace defaults."
            : saveStatus === "saved"
              ? "Workspace defaults saved."
              : undefined
        }
        onRetry={lastPatch ? () => void savePreferences(lastPatch) : undefined}
      />
    </section>
  );
}
