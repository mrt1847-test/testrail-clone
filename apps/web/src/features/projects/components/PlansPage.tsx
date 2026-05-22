import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { workbenchDensity as density } from "../../../shared/ui/density/uiDensity";
import { PrintLinkButton } from "../../print/components/PrintLinkButton";
import { buildPlanPrintPath } from "../../print/api/printApi";
import { createPlan, deletePlan, fetchPlans, fetchPlanSummary, updatePlan } from "../api/advancedApi";
import { ReportSummaryStrip } from "./reports/ReportChrome";

function progressBar(progress: number) {
  return (
    <div className="flex min-w-36 items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
      </div>
      <span className="w-10 text-right text-xs tabular-nums text-slate-600">{progress}%</span>
    </div>
  );
}

export function PlansPage() {
  const { projectId = "" } = useParams();
  const qc = useQueryClient();
  const [newPlanName, setNewPlanName] = useState("");
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editingPlanName, setEditingPlanName] = useState("");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["plans", projectId],
    queryFn: () => fetchPlans(projectId),
    enabled: Boolean(projectId)
  });
  const summaryQuery = useQuery({
    queryKey: ["reports", projectId, "plan-summary"],
    queryFn: () => fetchPlanSummary(projectId),
    enabled: Boolean(projectId)
  });
  const summaryById = useMemo(
    () => new Map((summaryQuery.data ?? []).map((row) => [row.planId, row])),
    [summaryQuery.data]
  );
  const summaryItems = useMemo(() => {
    const rows = summaryQuery.data ?? [];
    const entries = rows.reduce((acc, row) => acc + row.entryCount, 0);
    const runs = rows.reduce((acc, row) => acc + row.runCount, 0);
    const openRuns = rows.reduce((acc, row) => acc + row.openRunCount, 0);
    const failed = rows.reduce((acc, row) => acc + row.failed, 0);
    return [
      { label: "Plans", value: rows.length, tone: "neutral" as const },
      { label: "Entries", value: entries, tone: "violet" as const },
      { label: "Runs", value: runs, tone: "neutral" as const },
      { label: "Open runs", value: openRuns, tone: "amber" as const },
      { label: "Failed", value: failed, tone: "rose" as const }
    ];
  }, [summaryQuery.data]);

  const createPlanMutation = useMutation({
    mutationFn: (name: string) => createPlan(projectId, { name }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["plans", projectId] });
      void qc.invalidateQueries({ queryKey: ["reports", projectId, "plan-summary"] });
      setNewPlanName("");
    }
  });
  const updatePlanMutation = useMutation({
    mutationFn: (input: { planId: string; name: string }) => updatePlan(projectId, input.planId, { name: input.name }),
    onSuccess: () => {
      setEditingPlanId(null);
      setEditingPlanName("");
      void qc.invalidateQueries({ queryKey: ["plans", projectId] });
      void qc.invalidateQueries({ queryKey: ["reports", projectId, "plan-summary"] });
    }
  });
  const deletePlanMutation = useMutation({
    mutationFn: (planId: string) => deletePlan(projectId, planId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["plans", projectId] });
      void qc.invalidateQueries({ queryKey: ["reports", projectId, "plan-summary"] });
    }
  });

  if (isLoading) return <LoadingState message="Loading test plans..." />;
  if (isError) return <ErrorState title="Could not load test plans" onRetry={() => refetch()} />;
  return (
    <div className={`grid ${density.pageGap} lg:grid-cols-[minmax(0,1fr)_20rem]`}>
      <main className={density.mainStack}>
        <header className={`${density.panel} px-3 py-2`}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Test Plans</p>
          <h2 className="text-lg font-semibold text-slate-900">Plan hub</h2>
          <p className="mt-1 text-sm text-slate-600">
            Entries, generated runs, and execution progress for configuration-based testing.
          </p>
        </header>

        <ReportSummaryStrip items={summaryItems} />

        {!data || data.length === 0 ? (
          <EmptyState title="No plans yet" description="Environment matrix plans will appear here." />
        ) : (
          <div className={`overflow-hidden ${density.panel}`}>
            <div className={density.panelHeader}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Test Plans</h2>
            </div>
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className={density.tableHeaderCell}>Plan</th>
                  <th className={density.tableHeaderCell}>Entries</th>
                  <th className={density.tableHeaderCell}>Runs</th>
                  <th className={density.tableHeaderCell}>Progress</th>
                  <th className={`${density.tableHeaderCell} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((row) => {
                  const summary = summaryById.get(row.id);
                  return (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className={density.tableCell}>
                        {editingPlanId === row.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              className="min-w-44 flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                              value={editingPlanName}
                              onChange={(e) => setEditingPlanName(e.target.value)}
                            />
                            <button
                              className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                              disabled={!editingPlanName.trim() || updatePlanMutation.isPending}
                              onClick={() =>
                                void updatePlanMutation.mutateAsync({ planId: row.id, name: editingPlanName.trim() })
                              }
                            >
                              Save
                            </button>
                            <button
                              className="rounded border border-slate-300 px-2 py-1 text-xs"
                              onClick={() => {
                                setEditingPlanId(null);
                                setEditingPlanName("");
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <Link to={`/projects/${projectId}/plans/${row.id}`} className="font-medium text-slate-900 hover:underline">
                            {row.name}
                          </Link>
                        )}
                      </td>
                      <td className={`${density.tableCell} tabular-nums text-slate-700`}>{summary?.entryCount ?? "-"}</td>
                      <td className={`${density.tableCell} text-slate-700`}>
                        {summary ? (
                          <>
                            {summary.runCount}
                            {summary.openRunCount > 0 ? (
                              <span className="ml-1 text-xs text-slate-500">({summary.openRunCount} open)</span>
                            ) : null}
                          </>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className={density.tableCell}>{summary ? progressBar(summary.progress) : "-"}</td>
                      <td className={`${density.tableCell} text-right`}>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Link
                            to={`/projects/${projectId}/plans/${row.id}`}
                            className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700"
                          >
                            Open hub
                          </Link>
                          <PrintLinkButton
                            to={buildPlanPrintPath(projectId, row.id)}
                            label="Print"
                            className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          />
                          <button
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                            onClick={() => {
                              setEditingPlanId(row.id);
                              setEditingPlanName(row.name);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700 disabled:opacity-50"
                            disabled={deletePlanMutation.isPending}
                            onClick={() => void deletePlanMutation.mutateAsync(row.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <aside className={density.sidebarStack}>
        <section className={density.sidebarPanel}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Add Plan</h2>
          <div className={density.formGrid}>
            <input
              className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              placeholder="e.g. Release 1.2 matrix"
              value={newPlanName}
              onChange={(e) => setNewPlanName(e.target.value)}
            />
            <button
              className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              disabled={!newPlanName.trim() || createPlanMutation.isPending}
              onClick={() => void createPlanMutation.mutateAsync(newPlanName.trim())}
            >
              Add plan
            </button>
          </div>
        </section>

        <section className={density.sidebarPanel}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Plan Count</h2>
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-semibold text-slate-900">{data?.length ?? 0}</span> plans with{" "}
            <span className="font-semibold text-slate-900">
              {(summaryQuery.data ?? []).reduce((acc, row) => acc + row.openRunCount, 0)}
            </span>{" "}
            open runs.
          </p>
          <Link to={`/projects/${projectId}/reports/plans`} className="mt-3 inline-block text-sm font-medium text-indigo-800 hover:underline">
            Plan summary report
          </Link>
        </section>
      </aside>
    </div>
  );
}
