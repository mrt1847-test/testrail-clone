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
  savePlanEntryConfigurations,
  updatePlan,
  updatePlanEntry
} from "../api/advancedApi";
import { fetchProjectMembers } from "../api/settingsApi";
import { formatCaseIdList, parseCaseIdList } from "../utils/planCaseSelection";

export function PlanDetailPage() {
  const { projectId = "", planId = "" } = useParams();
  const qc = useQueryClient();
  const [entryName, setEntryName] = useState("");
  const [entryEnvironment, setEntryEnvironment] = useState("");
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingEntryName, setEditingEntryName] = useState("");
  const [editingEntryEnvironment, setEditingEntryEnvironment] = useState("");
  const [editingAssignedTo, setEditingAssignedTo] = useState("");
  const [editingRefs, setEditingRefs] = useState("");
  const [editingStartDate, setEditingStartDate] = useState("");
  const [editingDueOn, setEditingDueOn] = useState("");
  const [editingIncludeAll, setEditingIncludeAll] = useState(true);
  const [editingIncludeCaseIds, setEditingIncludeCaseIds] = useState("");
  const [editingExcludeCaseIds, setEditingExcludeCaseIds] = useState("");
  const [editingIsIncluded, setEditingIsIncluded] = useState(true);
  const [planAssignedTo, setPlanAssignedTo] = useState("");
  const [planRefs, setPlanRefs] = useState("");
  const [planStartDate, setPlanStartDate] = useState("");
  const [planDueOn, setPlanDueOn] = useState("");
  const [selectedConfigurationIds, setSelectedConfigurationIds] = useState<string[]>([]);
  const planQuery = useQuery({
    queryKey: ["plan", projectId, planId],
    queryFn: () => fetchPlan(projectId, planId),
    enabled: Boolean(projectId && planId)
  });
  const membersQuery = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: () => fetchProjectMembers(projectId),
    enabled: Boolean(projectId)
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
  const updatePlanMutation = useMutation({
    mutationFn: () =>
      updatePlan(projectId, planId, {
        assignedTo: planAssignedTo ? planAssignedTo : null,
        refs: planRefs.trim() ? planRefs.trim() : null,
        startDate: planStartDate ? new Date(planStartDate).toISOString() : null,
        dueOn: planDueOn ? new Date(planDueOn).toISOString() : null
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["plan", projectId, planId] });
    }
  });
  const updateEntryMutation = useMutation({
    mutationFn: (input: { entryId: string }) =>
      updatePlanEntry(projectId, planId, input.entryId, {
        name: editingEntryName.trim(),
        environment: editingEntryEnvironment.trim() || null,
        assignedTo: editingAssignedTo ? editingAssignedTo : null,
        refs: editingRefs.trim() ? editingRefs.trim() : null,
        startDate: editingStartDate ? new Date(editingStartDate).toISOString() : null,
        dueOn: editingDueOn ? new Date(editingDueOn).toISOString() : null,
        includeAll: editingIncludeAll,
        includeCaseIds: editingIncludeAll ? [] : parseCaseIdList(editingIncludeCaseIds),
        excludeCaseIds: parseCaseIdList(editingExcludeCaseIds),
        isIncluded: editingIsIncluded
      }),
    onSuccess: () => {
      setEditingEntryId(null);
      void qc.invalidateQueries({ queryKey: ["plan-entries", projectId, planId] });
    }
  });
  const saveConfigurationsMutation = useMutation({
    mutationFn: () =>
      savePlanEntryConfigurations({
        projectId,
        planId,
        entryId: editingEntryId ?? "",
        configurationIds: selectedConfigurationIds
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["plan-entry-configurations", projectId, planId, editingEntryId ?? "_none"] });
      void qc.invalidateQueries({ queryKey: ["plan-matrix", projectId, planId] });
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

  useEffect(() => {
    if (!planQuery.data) return;
    setPlanAssignedTo(planQuery.data.assignedTo ?? "");
    setPlanRefs(planQuery.data.refs ?? "");
    setPlanStartDate(planQuery.data.startDate ? planQuery.data.startDate.slice(0, 10) : "");
    setPlanDueOn(planQuery.data.dueOn ? planQuery.data.dueOn.slice(0, 10) : "");
  }, [planQuery.data]);

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
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Plan defaults</h3>
        <p className="mt-1 text-xs text-slate-500">Assignee, refs, and dates inherit to entries unless overridden.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm text-slate-700">
            <span>Assignee</span>
            <select
              className="rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={planAssignedTo}
              onChange={(e) => setPlanAssignedTo(e.target.value)}
            >
              <option value="">Unassigned</option>
              {(membersQuery.data ?? []).map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name || member.email}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm text-slate-700 sm:col-span-2">
            <span>References</span>
            <input
              className="rounded border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="REQ-1, JIRA-42"
              value={planRefs}
              onChange={(e) => setPlanRefs(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm text-slate-700">
            <span>Start date</span>
            <input
              type="date"
              className="rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={planStartDate}
              onChange={(e) => setPlanStartDate(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm text-slate-700">
            <span>Due date</span>
            <input
              type="date"
              className="rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={planDueOn}
              onChange={(e) => setPlanDueOn(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          className="mt-3 rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          disabled={updatePlanMutation.isPending}
          onClick={() => void updatePlanMutation.mutateAsync()}
        >
          Save plan defaults
        </button>
      </section>

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
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!editingEntryId || saveConfigurationsMutation.isPending}
                className="rounded border border-indigo-300 px-3 py-1.5 text-sm text-indigo-900 disabled:opacity-50"
                onClick={() => editingEntryId && void saveConfigurationsMutation.mutateAsync()}
              >
                Save combination
              </button>
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
              <p className="text-xs text-slate-500">엔트리를 Edit로 선택한 뒤 조합을 저장하거나 run을 생성하세요.</p>
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
                    <select
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      value={editingAssignedTo}
                      onChange={(e) => setEditingAssignedTo(e.target.value)}
                    >
                      <option value="">Assignee: inherit plan</option>
                      {(membersQuery.data ?? []).map((member) => (
                        <option key={member.userId} value={member.userId}>
                          {member.name || member.email}
                        </option>
                      ))}
                    </select>
                    <input
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      placeholder="References"
                      value={editingRefs}
                      onChange={(e) => setEditingRefs(e.target.value)}
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        type="date"
                        className="rounded border border-slate-300 px-2 py-1 text-sm"
                        value={editingStartDate}
                        onChange={(e) => setEditingStartDate(e.target.value)}
                      />
                      <input
                        type="date"
                        className="rounded border border-slate-300 px-2 py-1 text-sm"
                        value={editingDueOn}
                        onChange={(e) => setEditingDueOn(e.target.value)}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={editingIsIncluded}
                        onChange={(e) => setEditingIsIncluded(e.target.checked)}
                      />
                      Include entry in run generation
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={editingIncludeAll}
                        onChange={(e) => setEditingIncludeAll(e.target.checked)}
                      />
                      Include all suite cases
                    </label>
                    {!editingIncludeAll ? (
                      <textarea
                        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                        rows={2}
                        placeholder="Include case IDs (comma-separated)"
                        value={editingIncludeCaseIds}
                        onChange={(e) => setEditingIncludeCaseIds(e.target.value)}
                      />
                    ) : null}
                    <textarea
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      rows={2}
                      placeholder="Exclude case IDs (comma-separated)"
                      value={editingExcludeCaseIds}
                      onChange={(e) => setEditingExcludeCaseIds(e.target.value)}
                    />
                    <div className="flex items-center gap-1">
                      <button
                        className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                        disabled={!editingEntryName.trim() || updateEntryMutation.isPending}
                        onClick={() => void updateEntryMutation.mutateAsync({ entryId: entry.id })}
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
                            setEditingAssignedTo(entry.assignedTo ?? "");
                            setEditingRefs(entry.refs ?? "");
                            setEditingStartDate(entry.startDate ? entry.startDate.slice(0, 10) : "");
                            setEditingDueOn(entry.dueOn ? entry.dueOn.slice(0, 10) : "");
                            setEditingIncludeAll(entry.includeAll);
                            setEditingIncludeCaseIds(formatCaseIdList(entry.includeCaseIds));
                            setEditingExcludeCaseIds(formatCaseIdList(entry.excludeCaseIds));
                            setEditingIsIncluded(entry.isIncluded);
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
                    <p className="text-xs text-slate-500">
                      environment: {entry.environment || "n/a"} ·{" "}
                      {entry.isIncluded ? "included" : "excluded"} ·{" "}
                      {entry.includeAll ? "all cases" : `${entry.includeCaseIds.length} included`}
                      {entry.excludeCaseIds.length > 0 ? ` · ${entry.excludeCaseIds.length} excluded` : ""}
                    </p>
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
