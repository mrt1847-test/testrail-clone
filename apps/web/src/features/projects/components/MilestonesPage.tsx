import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { PrintLinkButton } from "../../print/components/PrintLinkButton";
import { buildMilestonePrintPath } from "../../print/api/printApi";
import { createMilestone, deleteMilestone, fetchMilestones, updateMilestone } from "../api/advancedApi";
import { fetchMilestoneSummary } from "../api/milestoneSummaryApi";
import type { MilestoneLifecycleStatus } from "../api/planningApi";
import { reportKeys } from "../hooks/reportKeys";
import { orderMilestonesForHierarchy } from "../utils/milestoneDisplay";
import { MilestoneDashboardPanel } from "./MilestoneDashboardPanel";
import { MilestoneLifecycleBadge } from "./MilestoneLifecycleBadge";
import { MilestoneProgressChip } from "./MilestoneProgressChip";
import { MilestoneScheduleBadge } from "./MilestoneScheduleBadge";

function lifecycleOf(row: { lifecycleStatus?: MilestoneLifecycleStatus; isCompleted: boolean }) {
  return row.lifecycleStatus ?? (row.isCompleted ? "completed" : "open");
}

export function MilestonesPage() {
  const { projectId = "" } = useParams();
  const qc = useQueryClient();
  const [newMilestoneName, setNewMilestoneName] = useState("");
  const [parentMilestoneId, setParentMilestoneId] = useState("");
  const [startDate, setStartDate] = useState("");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["milestones", projectId],
    queryFn: () => fetchMilestones(projectId),
    enabled: Boolean(projectId)
  });
  const summaryQuery = useQuery({
    queryKey: reportKeys.milestoneSummary(projectId),
    queryFn: () => fetchMilestoneSummary(projectId),
    enabled: Boolean(projectId)
  });

  const ordered = useMemo(() => orderMilestonesForHierarchy(data ?? []), [data]);
  const summaryById = useMemo(
    () => new Map((summaryQuery.data?.items ?? []).map((row) => [row.milestoneId, row])),
    [summaryQuery.data?.items]
  );
  const parentOptions = useMemo(() => data ?? [], [data]);

  const createMutation = useMutation({
    mutationFn: () =>
      createMilestone(projectId, {
        name: newMilestoneName.trim(),
        parentMilestoneId: parentMilestoneId ? parentMilestoneId : null,
        startDate: startDate ? new Date(startDate).toISOString() : null
      }),
    onSuccess: () => {
      setNewMilestoneName("");
      setParentMilestoneId("");
      setStartDate("");
      void qc.invalidateQueries({ queryKey: ["milestones", projectId] });
      void qc.invalidateQueries({ queryKey: reportKeys.milestoneSummary(projectId) });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (input: {
      milestoneId: string;
      isCompleted?: boolean;
      startNow?: boolean;
      parentMilestoneId?: string | null;
    }) => updateMilestone({ projectId, ...input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["milestones", projectId] });
      void qc.invalidateQueries({ queryKey: reportKeys.milestoneSummary(projectId) });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (milestoneId: string) => deleteMilestone(projectId, milestoneId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["milestones", projectId] });
      void qc.invalidateQueries({ queryKey: reportKeys.milestoneSummary(projectId) });
    }
  });

  if (isLoading) return <LoadingState message="Loading milestones…" />;
  if (isError) return <ErrorState title="Could not load milestones" onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Create milestone</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm text-slate-700 sm:col-span-2">
            <span>Name</span>
            <input
              className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              placeholder="e.g. Sprint 12 / Release 2.1"
              value={newMilestoneName}
              onChange={(e) => setNewMilestoneName(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm text-slate-700">
            <span>Parent milestone</span>
            <select
              className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              value={parentMilestoneId}
              onChange={(e) => setParentMilestoneId(e.target.value)}
            >
              <option value="">None (top level)</option>
              {parentOptions.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm text-slate-700">
            <span>Start date (optional)</span>
            <input
              type="date"
              className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
        </div>
        <button
          className="mt-3 rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          disabled={!newMilestoneName.trim() || createMutation.isPending}
          onClick={() => void createMutation.mutateAsync()}
        >
          Add milestone
        </button>
      </div>

      {summaryQuery.data?.dashboard ? (
        <MilestoneDashboardPanel
          projectId={projectId}
          dashboard={summaryQuery.data.dashboard}
          itemsById={summaryById}
        />
      ) : null}

      {!data || data.length === 0 ? (
        <EmptyState title="No milestones yet" description="Milestone list will appear here." />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Milestones</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-800">
            {ordered.map((row) => {
              const status = lifecycleOf(row);
              const rollup = summaryById.get(row.id);
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2"
                  style={{ marginLeft: `${row.depth * 1.25}rem` }}
                >
                  <div className="min-w-0">
                    <Link to={`/projects/${projectId}/milestones/${row.id}`} className="font-medium underline">
                      {row.name}
                    </Link>
                    {row.parentMilestoneId ? (
                      <p className="text-xs text-slate-500">Sub-milestone</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {rollup ? (
                      <MilestoneProgressChip
                        progress={rollup.progress}
                        runCount={rollup.runCount}
                        childCount={rollup.childCount}
                        includesSubMilestones={rollup.includesSubMilestones}
                        compact
                      />
                    ) : null}
                    {rollup?.forecast ? (
                      <span title={rollup.forecast.hint}>
                        <MilestoneScheduleBadge status={rollup.forecast.scheduleStatus} />
                      </span>
                    ) : null}
                    <MilestoneLifecycleBadge status={status} />
                    <PrintLinkButton
                      to={buildMilestonePrintPath(projectId, row.id)}
                      label="Print"
                      className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    />
                    {status === "upcoming" ? (
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                        disabled={updateMutation.isPending}
                        onClick={() =>
                          void updateMutation.mutateAsync({ milestoneId: row.id, startNow: true })
                        }
                      >
                        Start now
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                      disabled={updateMutation.isPending}
                      onClick={() =>
                        void updateMutation.mutateAsync({
                          milestoneId: row.id,
                          isCompleted: status !== "completed"
                        })
                      }
                    >
                      {status === "completed" ? "Reopen" : "Complete"}
                    </button>
                    <button
                      type="button"
                      className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700 disabled:opacity-50"
                      disabled={deleteMutation.isPending}
                      onClick={() => void deleteMutation.mutateAsync(row.id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
