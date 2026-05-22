import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

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
  columns: defaultCaseListColumns
};

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
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const prefs = preferencesQuery.data;
    if (!prefs) return;
    setLandingPage(prefs.landingPage);
    setDefaultSuiteId(prefs.defaultSuiteId ?? "");
    setDefaultSavedViewId(prefs.defaultSavedViewId ?? "");
  }, [preferencesQuery.data]);

  async function savePreferences(patch: Partial<WorkspacePreferences>) {
    setSaved(false);
    const next = await updateMutation.mutateAsync({
      landingPage: patch.landingPage ?? landingPage,
      defaultSuiteId: patch.defaultSuiteId !== undefined ? patch.defaultSuiteId : defaultSuiteId || null,
      defaultSavedViewId:
        patch.defaultSavedViewId !== undefined ? patch.defaultSavedViewId : defaultSavedViewId || null
    });
    setLandingPage(next.landingPage);
    setDefaultSuiteId(next.defaultSuiteId ?? "");
    setDefaultSavedViewId(next.defaultSavedViewId ?? "");
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  if (preferencesQuery.isLoading) {
    return <p className="text-sm text-slate-500">Loading workspace defaults...</p>;
  }

  const suites: SuiteSummary[] = suitesQuery.data ?? [];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">My workspace defaults</h2>
      <p className="mt-1 text-sm text-slate-600">
        Choose where this project opens for you, which suite loads in Test Cases, and which saved view applies when no
        filters are in the URL.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block space-y-1 text-sm text-slate-700">
          <span className="font-medium">Default landing page</span>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
        </label>

        <label className="block space-y-1 text-sm text-slate-700">
          <span className="font-medium">Default test suite</span>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
        </label>

        <label className="block space-y-1 text-sm text-slate-700 md:col-span-2">
          <span className="font-medium">Default saved case view</span>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
          {savedViews.length === 0 ? (
            <span className="text-xs text-slate-500">
              Save a view from the Test Cases toolbar to list it here.
            </span>
          ) : null}
        </label>
      </div>

      {updateMutation.isError ? (
        <p className="mt-3 text-sm text-rose-700">Could not save workspace defaults. Try again.</p>
      ) : null}
      {saved ? <p className="mt-3 text-sm text-emerald-700">Workspace defaults saved.</p> : null}
    </section>
  );
}
