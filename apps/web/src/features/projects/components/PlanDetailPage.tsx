import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { workbenchDensity as density } from "../../../shared/ui/density/uiDensity";
import { fetchRuns } from "../../runs/api/runApi";
import { RunPlanProgressBar } from "../../runs/components/RunPlanProgressBar";
import { PrintLinkButton } from "../../print/components/PrintLinkButton";
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
  fetchPlanSummary,
  savePlanEntryConfigurations,
  updatePlan,
  updatePlanEntry,
  type PlanEntryRow,
  type PlanRollupRow
} from "../api/advancedApi";
import { fetchProjectMembers } from "../api/settingsApi";
import { formatCaseIdList, parseCaseIdList } from "../utils/planCaseSelection";
import { ReportSummaryStrip } from "./reports/ReportChrome";

function formatDate(value?: string | null) {
  return value ? value.slice(0, 10) : "Inherited";
}

function statusCountsForRollup(row: PlanRollupRow): Record<string, number> {
  return {
    passed: row.passed,
    failed: row.failed,
    blocked: row.blocked,
    retest: row.retest,
    untested: row.untested
  };
}

function planProgressBar(progress: number) {
  return (
    <div className="flex min-w-36 items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
      </div>
      <span className="w-10 text-right text-xs tabular-nums text-slate-600">{progress}%</span>
    </div>
  );
}

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
  const summaryQuery = useQuery({
    queryKey: ["reports", projectId, "plan-summary"],
    queryFn: () => fetchPlanSummary(projectId),
    enabled: Boolean(projectId && planId)
  });
  const runsQuery = useQuery({
    queryKey: ["runs", projectId],
    queryFn: () => fetchRuns(projectId),
    enabled: Boolean(projectId)
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

  const entries = entriesQuery.data ?? [];
  const planSummary = useMemo(
    () => summaryQuery.data?.find((row) => row.planId === planId) ?? null,
    [planId, summaryQuery.data]
  );
  const runById = useMemo(() => new Map((runsQuery.data ?? []).map((run) => [run.id, run])), [runsQuery.data]);
  const linkedRunCount = entries.filter((entry) => entry.runId).length;
  const openRunCount = planSummary?.openRunCount ?? entries.filter((entry) => entry.runId && runById.get(entry.runId)?.status !== "closed").length;
  const summaryItems = useMemo(
    () => [
      { label: "Entries", value: entries.length, tone: "violet" as const },
      { label: "Generated runs", value: planSummary?.runCount ?? linkedRunCount, tone: "neutral" as const },
      { label: "Open runs", value: openRunCount, tone: "amber" as const },
      { label: "Failed", value: planSummary?.failed ?? 0, tone: "rose" as const },
      { label: "Progress", value: `${planSummary?.progress ?? 0}%`, tone: "emerald" as const }
    ],
    [entries.length, linkedRunCount, openRunCount, planSummary]
  );

  const invalidatePlanHub = () => {
    void qc.invalidateQueries({ queryKey: ["plan", projectId, planId] });
    void qc.invalidateQueries({ queryKey: ["plans", projectId] });
    void qc.invalidateQueries({ queryKey: ["plan-entries", projectId, planId] });
    void qc.invalidateQueries({ queryKey: ["plan-rollup", projectId, planId] });
    void qc.invalidateQueries({ queryKey: ["reports", projectId, "plan-summary"] });
    void qc.invalidateQueries({ queryKey: ["runs", projectId] });
  };

  const createEntryMutation = useMutation({
    mutationFn: (input: { name: string; environment?: string }) => createPlanEntry(projectId, planId, input),
    onSuccess: () => {
      invalidatePlanHub();
      setEntryName("");
      setEntryEnvironment("");
    }
  });
  const createRunMutation = useMutation({
    mutationFn: (entryId?: string) => createRunFromPlanEntry(projectId, planId, entryId),
    onSuccess: () => {
      invalidatePlanHub();
      void qc.invalidateQueries({ queryKey: ["plan-matrix", projectId, planId] });
    }
  });
  const createRunByConfigurationMutation = useMutation({
    mutationFn: (input: { entryId: string; configurationIds: string[] }) =>
      createRunByConfiguration({ projectId, planId, ...input }),
    onSuccess: () => {
      invalidatePlanHub();
      void qc.invalidateQueries({ queryKey: ["plan-matrix", projectId, planId] });
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
    onSuccess: invalidatePlanHub
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
      invalidatePlanHub();
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
      invalidatePlanHub();
    }
  });
  const deleteEntryMutation = useMutation({
    mutationFn: (entryId: string) => deletePlanEntry(projectId, planId, entryId),
    onSuccess: invalidatePlanHub
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

  const startEditingEntry = (entry: PlanEntryRow) => {
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
  };

  if (planQuery.isLoading || entriesQuery.isLoading) return <LoadingState message="Loading test plan detail..." />;
  if (planQuery.isError || entriesQuery.isError || !planQuery.data) {
    return <ErrorState title="Could not load test plan detail" onRetry={() => void Promise.all([planQuery.refetch(), entriesQuery.refetch()])} />;
  }

  return (
    <div className={`grid ${density.pageGap} xl:grid-cols-[minmax(0,1fr)_21rem]`}>
      <main className={density.mainStack}>
        <header className={`${density.panel} px-3 py-2`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Test Plan Hub</p>
              <h2 className="text-lg font-semibold text-slate-900">{planQuery.data.name}</h2>
              <p className="mt-1 text-sm text-slate-600">
                Manage entries, configurations, generated runs, and execution progress in one planning context.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/projects/${projectId}/reports/plans`}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Plan report
              </Link>
              <PrintLinkButton to={`/projects/${projectId}/plans/${planId}/print`} />
            </div>
          </div>
        </header>

        <ReportSummaryStrip items={summaryItems} />

        <section className={`${density.panel} ${density.panelBody}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Execution snapshot</h3>
              <p className="mt-1 text-sm text-slate-600">
                {linkedRunCount} of {entries.length} entries have generated runs.
              </p>
            </div>
            <button
              className="rounded border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              disabled={createRunMutation.isPending || entries.length === 0}
              onClick={() => void createRunMutation.mutateAsync(undefined)}
            >
              Generate next run
            </button>
          </div>
          <div className="mt-3 max-w-xl">{planProgressBar(planSummary?.progress ?? 0)}</div>
        </section>

        {entries.length > 0 ? (
          <section className={`overflow-hidden ${density.panel}`}>
            <div className={`flex flex-wrap items-center justify-between gap-2 ${density.panelHeader}`}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Plan entries</h3>
              <span className="text-xs text-slate-500">{entries.length} entries</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className={density.tableHeaderCell}>Entry</th>
                    <th className={density.tableHeaderCell}>Cases</th>
                    <th className={density.tableHeaderCell}>Dates</th>
                    <th className={density.tableHeaderCell}>Generated run</th>
                    <th className={density.tableHeaderCell}>Progress</th>
                    <th className={`${density.tableHeaderCell} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map((entry) => {
                    const linkedRun = entry.runId ? runById.get(entry.runId) : undefined;
                    return (
                      <tr key={entry.id} className="align-top hover:bg-slate-50">
                        {editingEntryId === entry.id ? (
                          <td colSpan={6} className={density.tableCell}>
                            <div className="grid gap-3 rounded border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
                              <input
                                className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                                value={editingEntryName}
                                onChange={(e) => setEditingEntryName(e.target.value)}
                              />
                              <input
                                className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                                placeholder="Environment (optional)"
                                value={editingEntryEnvironment}
                                onChange={(e) => setEditingEntryEnvironment(e.target.value)}
                              />
                              <select
                                className="rounded border border-slate-300 px-2 py-1.5 text-sm"
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
                                className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                                placeholder="References"
                                value={editingRefs}
                                onChange={(e) => setEditingRefs(e.target.value)}
                              />
                              <input
                                type="date"
                                className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                                value={editingStartDate}
                                onChange={(e) => setEditingStartDate(e.target.value)}
                              />
                              <input
                                type="date"
                                className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                                value={editingDueOn}
                                onChange={(e) => setEditingDueOn(e.target.value)}
                              />
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
                                  className="rounded border border-slate-300 px-2 py-1.5 text-sm md:col-span-2"
                                  rows={2}
                                  placeholder="Include case IDs (comma-separated)"
                                  value={editingIncludeCaseIds}
                                  onChange={(e) => setEditingIncludeCaseIds(e.target.value)}
                                />
                              ) : null}
                              <textarea
                                className="rounded border border-slate-300 px-2 py-1.5 text-sm md:col-span-2"
                                rows={2}
                                placeholder="Exclude case IDs (comma-separated)"
                                value={editingExcludeCaseIds}
                                onChange={(e) => setEditingExcludeCaseIds(e.target.value)}
                              />
                              <div className="flex flex-wrap items-center gap-2 md:col-span-2">
                                <button
                                  className="rounded border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                                  disabled={!editingEntryName.trim() || updateEntryMutation.isPending}
                                  onClick={() => void updateEntryMutation.mutateAsync({ entryId: entry.id })}
                                >
                                  Save entry
                                </button>
                                <button
                                  className="rounded border border-slate-300 px-3 py-1.5 text-xs"
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
                          </td>
                        ) : (
                          <>
                            <td className={density.tableCell}>
                              <p className="font-medium text-slate-900">{entry.name}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {entry.environment || "No environment"} · {entry.isIncluded ? "included" : "excluded"}
                                {entry.refs ? ` · refs ${entry.refs}` : ""}
                              </p>
                            </td>
                            <td className={`${density.tableCell} text-xs text-slate-600`}>
                              {entry.includeAll ? "All cases" : `${entry.includeCaseIds.length} included`}
                              {entry.excludeCaseIds.length > 0 ? (
                                <span className="block text-rose-700">{entry.excludeCaseIds.length} excluded</span>
                              ) : null}
                            </td>
                            <td className={`${density.tableCell} text-xs text-slate-600`}>
                              <span className="block">Start: {formatDate(entry.startDate)}</span>
                              <span className="block">Due: {formatDate(entry.dueOn)}</span>
                            </td>
                            <td className={density.tableCell}>
                              {entry.runId ? (
                                <Link to={`/projects/${projectId}/runs/${entry.runId}`} className="text-xs font-medium text-indigo-800 hover:underline">
                                  Run #{entry.runId}
                                </Link>
                              ) : (
                                <span className="text-xs text-slate-500">No run yet</span>
                              )}
                            </td>
                            <td className={density.tableCell}>
                              {linkedRun ? (
                                <div className="min-w-40">
                                  {planProgressBar(linkedRun.progress)}
                                  {linkedRun.failed > 0 ? <p className="mt-1 text-xs text-rose-700">{linkedRun.failed} failed</p> : null}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-500">Awaiting run</span>
                              )}
                            </td>
                            <td className={`${density.tableCell} text-right`}>
                              <div className="flex flex-wrap justify-end gap-2">
                                {!entry.runId ? (
                                  <button
                                    className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                                    disabled={createRunMutation.isPending}
                                    onClick={() => void createRunMutation.mutateAsync(entry.id)}
                                  >
                                    Generate run
                                  </button>
                                ) : null}
                                <button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => startEditingEntry(entry)}>
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
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <EmptyState title="No plan entries" description="Environment entries will appear here." />
        )}

        <section className={`${density.panel} ${density.panelBody}`}>
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
                <p className="text-xs text-slate-500">Select an entry with Edit, then save or generate a configuration-specific run.</p>
              </div>
              {editingEntryId ? (
                <div className="rounded border border-slate-200 p-2 text-xs text-slate-600">
                  <p className="font-medium">Current entry mapping</p>
                  {selectedEntryConfigurationQuery.data && selectedEntryConfigurationQuery.data.items.length > 0 ? (
                    <ul className="mt-1 space-y-1">
                      {selectedEntryConfigurationQuery.data.items.map((item) => (
                        <li key={item.configurationId}>
                          {item.groupName ?? "Unknown group"}: {item.configurationName}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-slate-500">No configurations are mapped to this entry yet.</p>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No matrix data.</p>
          )}
        </section>

        <section className={`${density.panel} ${density.panelBody}`}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Rollup by configuration</h3>
          {rollupQuery.data && rollupQuery.data.length > 0 ? (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-[760px] w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className={density.tableHeaderCell}>Configuration</th>
                    <th className={density.tableHeaderCell}>Entries</th>
                    <th className={density.tableHeaderCell}>Runs</th>
                    <th className={density.tableHeaderCell}>Result progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rollupQuery.data.map((row) => (
                    <tr key={row.configurationId}>
                      <td className={density.tableCell}>
                        <p className="font-medium text-slate-900">{row.configurationName}</p>
                        <p className="text-xs text-slate-500">{row.groupName}</p>
                      </td>
                      <td className={`${density.tableCell} tabular-nums text-slate-700`}>{row.entryCount}</td>
                      <td className={`${density.tableCell} text-slate-700`}>
                        {row.runCount}
                        {row.openRunCount > 0 ? <span className="ml-1 text-xs text-slate-500">({row.openRunCount} open)</span> : null}
                      </td>
                      <td className={density.tableCell}>
                        <RunPlanProgressBar statusCounts={statusCountsForRollup(row)} className="max-w-md" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No rollup data.</p>
          )}
        </section>
      </main>

      <aside className={density.sidebarStack}>
        <section className={density.sidebarPanel}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Add plan entry</h3>
          <div className={density.formGrid}>
            <input
              className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              placeholder="Entry name"
              value={entryName}
              onChange={(e) => setEntryName(e.target.value)}
            />
            <input
              className="rounded border border-slate-300 px-3 py-1.5 text-sm"
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
          </div>
        </section>

        <section className={density.sidebarPanel}>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Plan defaults</h3>
          <div className={density.formGrid}>
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
            <label className="grid gap-1 text-sm text-slate-700">
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
            <button
              type="button"
              className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              disabled={updatePlanMutation.isPending}
              onClick={() => void updatePlanMutation.mutateAsync()}
            >
              Save defaults
            </button>
          </div>
        </section>
      </aside>
    </div>
  );
}
