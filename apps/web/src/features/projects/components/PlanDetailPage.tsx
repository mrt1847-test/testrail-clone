import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import {
  createPlanEntry,
  createRunByConfiguration,
  createRunFromPlanEntry,
  deletePlanEntry,
  fetchPlan,
  fetchPlanEntries,
  fetchPlanEntryConfigurations,
  fetchPlanMatrix,
  fetchPlanRollupByConfiguration,
  updatePlanEntry
} from "../api/advancedApi";

export function PlanDetailPage() {
  const { projectId = "", planId = "" } = useParams();
  const qc = useQueryClient();
  const [entryName, setEntryName] = useState("");
  const [entryEnvironment, setEntryEnvironment] = useState("");
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingEntryName, setEditingEntryName] = useState("");
  const [editingEntryEnvironment, setEditingEntryEnvironment] = useState("");
  const [selectedConfigurationIds, setSelectedConfigurationIds] = useState<string[]>([]);
  const planQuery = useQuery({
    queryKey: ["plan", projectId, planId],
    queryFn: () => fetchPlan(projectId, planId),
    enabled: Boolean(projectId && planId)
  });
  const entriesQuery = useQuery({
    queryKey: ["plan-entries", projectId, planId],
    queryFn: () => fetchPlanEntries(projectId, planId),
    enabled: Boolean(projectId && planId)
  });
  const matrixQuery = useQuery({
    queryKey: ["plan-matrix", projectId, planId, editingEntryId ?? "_none"],
    queryFn: () => fetchPlanMatrix(projectId, planId, editingEntryId ?? undefined),
    enabled: Boolean(projectId && planId)
  });
  const rollupQuery = useQuery({
    queryKey: ["plan-rollup", projectId, planId],
    queryFn: () => fetchPlanRollupByConfiguration(projectId, planId),
    enabled: Boolean(projectId && planId)
  });
  const selectedEntryConfigurationQuery = useQuery({
    queryKey: ["plan-entry-configurations", projectId, planId, editingEntryId ?? "_none"],
    queryFn: () => fetchPlanEntryConfigurations(projectId, planId, editingEntryId ?? ""),
    enabled: Boolean(projectId && planId && editingEntryId)
  });
  const createEntryMutation = useMutation({
    mutationFn: (input: { name: string; environment?: string }) => createPlanEntry(projectId, planId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["plan-entries", projectId, planId] });
      setEntryName("");
      setEntryEnvironment("");
    }
  });
  const createRunMutation = useMutation({
    mutationFn: (entryId?: string) => createRunFromPlanEntry(projectId, planId, entryId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["plan-entries", projectId, planId] });
    }
  });
  const createRunByConfigurationMutation = useMutation({
    mutationFn: (input: { entryId: string; configurationIds: string[] }) =>
      createRunByConfiguration({ projectId, planId, ...input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["plan-entries", projectId, planId] });
      void qc.invalidateQueries({ queryKey: ["plan-matrix", projectId, planId] });
      void qc.invalidateQueries({ queryKey: ["plan-rollup", projectId, planId] });
    }
  });
  const updateEntryMutation = useMutation({
    mutationFn: (input: { entryId: string; name: string; environment?: string | null }) =>
      updatePlanEntry(projectId, planId, input.entryId, { name: input.name, environment: input.environment }),
    onSuccess: () => {
      setEditingEntryId(null);
      setEditingEntryName("");
      setEditingEntryEnvironment("");
      void qc.invalidateQueries({ queryKey: ["plan-entries", projectId, planId] });
    }
  });
  const deleteEntryMutation = useMutation({
    mutationFn: (entryId: string) => deletePlanEntry(projectId, planId, entryId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["plan-entries", projectId, planId] });
    }
  });

  useEffect(() => {
    if (selectedEntryConfigurationQuery.data) {
      setSelectedConfigurationIds(selectedEntryConfigurationQuery.data.configurationIds);
    }
  }, [selectedEntryConfigurationQuery.data]);

  if (planQuery.isLoading || entriesQuery.isLoading) return <LoadingState message="Loading test plan detail…" />;
  if (planQuery.isError || entriesQuery.isError || !planQuery.data) {
    return <ErrorState title="Could not load test plan detail" onRetry={() => void Promise.all([planQuery.refetch(), entriesQuery.refetch()])} />;
  }

  return (
    <div className="space-y-4">
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">Test Plan</p>
        <h2 className="text-xl font-semibold text-slate-900">{planQuery.data.name}</h2>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Add plan entry</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="min-w-48 flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm"
            placeholder="Entry name"
            value={entryName}
            onChange={(e) => setEntryName(e.target.value)}
          />
          <input
            className="min-w-40 flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm"
            placeholder="Environment (optional)"
            value={entryEnvironment}
            onChange={(e) => setEntryEnvironment(e.target.value)}
          />
          <button
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            disabled={!entryName.trim() || createEntryMutation.isPending}
            onClick={() =>
              void createEntryMutation.mutateAsync({
                name: entryName.trim(),
                environment: entryEnvironment.trim() || undefined
              })
            }
          >
            Add entry
          </button>
          <button
            className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
            disabled={createRunMutation.isPending || !entriesQuery.data || entriesQuery.data.length === 0}
            onClick={() => void createRunMutation.mutateAsync(undefined)}
          >
            Generate run (first entry)
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Configuration matrix</h3>
        {matrixQuery.data ? (
          <div className="mt-3 space-y-3">
            {matrixQuery.data.groups.map((group) => (
              <div key={group.id}>
                <p className="text-xs font-medium text-slate-600">{group.name}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {group.configurations.map((cfg) => {
                    const selected = selectedConfigurationIds.includes(cfg.id);
                    return (
                      <button
                        key={cfg.id}
                        type="button"
                        className={`rounded border px-2 py-1 text-xs ${selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"}`}
                        onClick={() =>
                          setSelectedConfigurationIds((prev) =>
                            selected
                              ? prev.filter((id) => id !== cfg.id)
                              : [...prev.filter((id) => !group.configurations.some((g) => g.id === id)), cfg.id]
                          )
                        }
                      >
                        {cfg.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!editingEntryId || createRunByConfigurationMutation.isPending}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
                onClick={() =>
                  editingEntryId &&
                  void createRunByConfigurationMutation.mutateAsync({
                    entryId: editingEntryId,
                    configurationIds: selectedConfigurationIds
                  })
                }
              >
                Generate run by configuration
              </button>
              <p className="text-xs text-slate-500">먼저 엔트리를 Edit로 선택한 뒤 구성값을 고르세요.</p>
            </div>
            {editingEntryId ? (
              <div className="rounded border border-slate-200 p-2 text-xs text-slate-600">
                <p className="font-medium">현재 엔트리 매핑</p>
                {selectedEntryConfigurationQuery.data && selectedEntryConfigurationQuery.data.items.length > 0 ? (
                  <ul className="mt-1 space-y-1">
                    {selectedEntryConfigurationQuery.data.items.map((item) => (
                      <li key={item.configurationId}>
                        {item.groupName ?? "Unknown group"}: {item.configurationName}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-slate-500">아직 매핑된 configuration이 없습니다.</p>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No matrix data.</p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Rollup by configuration</h3>
        {rollupQuery.data && rollupQuery.data.length > 0 ? (
          <ul className="mt-3 space-y-2 text-xs text-slate-700">
            {rollupQuery.data.map((row) => (
              <li key={row.configurationId} className="rounded border border-slate-200 px-2 py-2">
                {row.groupName} / {row.configurationName} · entries {row.entryCount} · runs {row.runCount} (open{" "}
                {row.openRunCount}, closed {row.closedRunCount}) · failed {row.failed}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No rollup data.</p>
        )}
      </section>

      {entriesQuery.data && entriesQuery.data.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Plan Entries</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {entriesQuery.data.map((entry) => (
              <li key={entry.id} className="rounded border border-slate-200 px-3 py-2">
                {editingEntryId === entry.id ? (
                  <div className="space-y-2">
                    <input
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      value={editingEntryName}
                      onChange={(e) => setEditingEntryName(e.target.value)}
                    />
                    <input
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      placeholder="Environment (optional)"
                      value={editingEntryEnvironment}
                      onChange={(e) => setEditingEntryEnvironment(e.target.value)}
                    />
                    <div className="flex items-center gap-1">
                      <button
                        className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                        disabled={!editingEntryName.trim() || updateEntryMutation.isPending}
                        onClick={() =>
                          void updateEntryMutation.mutateAsync({
                            entryId: entry.id,
                            name: editingEntryName.trim(),
                            environment: editingEntryEnvironment.trim() || null
                          })
                        }
                      >
                        Save
                      </button>
                      <button
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                        onClick={() => {
                          setEditingEntryId(null);
                          setEditingEntryName("");
                          setEditingEntryEnvironment("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-800">{entry.name}</p>
                      <div className="flex items-center gap-1">
                        <button
                          className="rounded border border-slate-300 px-2 py-1 text-xs"
                          onClick={() => {
                            setEditingEntryId(entry.id);
                            setEditingEntryName(entry.name);
                            setEditingEntryEnvironment(entry.environment ?? "");
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700 disabled:opacity-50"
                          disabled={deleteEntryMutation.isPending}
                          onClick={() => void deleteEntryMutation.mutateAsync(entry.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">environment: {entry.environment || "n/a"}</p>
                    {!entry.runId ? (
                      <button
                        className="mt-1 rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                        disabled={createRunMutation.isPending}
                        onClick={() => void createRunMutation.mutateAsync(entry.id)}
                      >
                        Generate run for this entry
                      </button>
                    ) : null}
                    {entry.runId ? (
                      <Link to={`/projects/${projectId}/runs/${entry.runId}`} className="text-xs text-slate-700 underline">
                        linked run #{entry.runId}
                      </Link>
                    ) : (
                      <p className="text-xs text-slate-500">no linked run</p>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <EmptyState title="No plan entries" description="Environment entries will appear here." />
      )}
    </div>
  );
}
