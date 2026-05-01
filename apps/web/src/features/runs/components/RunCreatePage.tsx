import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "../../../shared/api/http";
import type { Paged } from "../../../shared/api/types";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { fetchMilestones } from "../../projects/api/planningApi";
import { useCreateRunMutation } from "../hooks/useRunsApi";

export function RunCreatePage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [suiteId, setSuiteId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [environment, setEnvironment] = useState("");
  const [includeAll, setIncludeAll] = useState(true);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [excludedCaseIds, setExcludedCaseIds] = useState<string[]>([]);
  const mutation = useCreateRunMutation(projectId);
  const suitesQuery = useQuery({
    queryKey: ["run-create-suites", projectId],
    queryFn: async () => apiFetch<Paged<{ id: string; name: string }>>(`/api/projects/${projectId}/suites?page=1&pageSize=100`),
    enabled: Boolean(projectId)
  });
  const casesQuery = useQuery({
    queryKey: ["run-create-cases", projectId, suiteId],
    queryFn: async () =>
      apiFetch<Paged<{ id: string; title: string }>>(
        `/api/projects/${projectId}/cases?page=1&pageSize=200${suiteId ? `&suiteId=${encodeURIComponent(suiteId)}` : ""}`
      ),
    enabled: Boolean(projectId && suiteId)
  });
  const milestonesQuery = useQuery({
    queryKey: ["run-create-milestones", projectId],
    queryFn: () => fetchMilestones(projectId),
    enabled: Boolean(projectId)
  });

  const suites = suitesQuery.data?.data ?? [];
  const cases = casesQuery.data?.data ?? [];
  const milestones = milestonesQuery.data ?? [];

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !suiteId) return;
    mutation.mutate(
      {
        suiteId,
        name: name.trim(),
        includeAll,
        caseIds: includeAll ? undefined : selectedCaseIds,
        excludedCaseIds: includeAll ? excludedCaseIds : undefined,
        milestoneId: milestoneId || null,
        environment: environment.trim() || undefined
      },
      {
      onSuccess: (run) => navigate(`/projects/${projectId}/runs/${run.id}`),
      }
    );
  };

  if (suitesQuery.isLoading || casesQuery.isLoading || milestonesQuery.isLoading) {
    return <LoadingState message="Loading run create dependencies…" />;
  }
  if (suitesQuery.isError || casesQuery.isError || milestonesQuery.isError) {
    return (
      <ErrorState
        title="Could not load suite/case data"
        onRetry={() => {
          void suitesQuery.refetch();
          void casesQuery.refetch();
          void milestonesQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">New test run</h2>
      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
            placeholder="e.g. Smoke — nightly"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Suite
          <select
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={suiteId}
            onChange={(e) => {
              setSuiteId(e.target.value);
              setSelectedCaseIds([]);
              setExcludedCaseIds([]);
            }}
          >
            <option value="">Select suite</option>
            {suites.map((suite) => (
              <option key={suite.id} value={String(suite.id)}>
                {suite.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Milestone (optional)
          <select
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={milestoneId}
            onChange={(e) => setMilestoneId(e.target.value)}
          >
            <option value="">No milestone</option>
            {milestones.map((milestone) => (
              <option key={milestone.id} value={String(milestone.id)}>
                {milestone.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Environment
          <input
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
            placeholder="e.g. staging / chrome"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={includeAll}
            onChange={(e) => {
              const nextIncludeAll = e.target.checked;
              setIncludeAll(nextIncludeAll);
              if (nextIncludeAll) {
                setSelectedCaseIds([]);
              } else {
                setExcludedCaseIds([]);
              }
            }}
          />
          Include all cases in suite
        </label>
        {includeAll ? (
          <div className="rounded border border-slate-200 p-3">
            <p className="text-xs font-medium text-slate-600">Exclude cases (optional)</p>
            <p className="mt-1 text-xs text-slate-500">
              Leave unchecked to include all cases in this suite.
            </p>
            <div className="mt-2 max-h-48 space-y-1 overflow-auto">
              {!suiteId ? (
                <p className="text-xs text-slate-500">Select a suite first.</p>
              ) : null}
              {cases.map((c) => {
                const id = String(c.id);
                return (
                  <label key={id} className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={excludedCaseIds.includes(id)}
                      onChange={(e) => {
                        setExcludedCaseIds((prev) =>
                          e.target.checked ? [...prev, id] : prev.filter((value) => value !== id)
                        );
                      }}
                    />
                    {c.title}
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
        {!includeAll ? (
          <div className="rounded border border-slate-200 p-3">
            <p className="text-xs font-medium text-slate-600">Select cases</p>
            <div className="mt-2 max-h-48 space-y-1 overflow-auto">
              {!suiteId ? (
                <p className="text-xs text-slate-500">Select a suite first.</p>
              ) : null}
              {cases.map((c) => {
                const id = String(c.id);
                return (
                  <label key={id} className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedCaseIds.includes(id)}
                      onChange={(e) => {
                        setSelectedCaseIds((prev) =>
                          e.target.checked ? [...prev, id] : prev.filter((value) => value !== id)
                        );
                      }}
                    />
                    {c.title}
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}
        {mutation.isError ? <ErrorState title="Could not create run" /> : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate(`/projects/${projectId}/runs`)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || !suiteId || mutation.isPending || (!includeAll && selectedCaseIds.length === 0)}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {mutation.isPending ? "Creating…" : "Create run"}
          </button>
        </div>
      </form>
    </div>
  );
}
