import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { PrintLinkButton } from "../../print/components/PrintLinkButton";
import {
  createMilestone,
  deleteMilestone,
  fetchMilestone,
  fetchMilestoneRuns,
  fetchMilestones,
  updateMilestone
} from "../api/advancedApi";
import { fetchMilestoneSummary } from "../api/milestoneSummaryApi";
import type { MilestoneLifecycleStatus, MilestoneRow } from "../api/planningApi";
import { reportKeys } from "../hooks/reportKeys";
import { ExecutionSummaryChart } from "./ExecutionSummaryChart";
import { MilestoneForecastPanel } from "./MilestoneForecastPanel";
import { MilestoneDialog } from "./MilestoneDialog";
import type { MilestoneDialogMode, MilestoneDialogValues } from "./MilestoneDialog";
import { MilestoneLifecycleBadge } from "./MilestoneLifecycleBadge";
import { MilestoneProgressBar } from "./MilestoneProgressBar";
import { MilestoneProgressChip } from "./MilestoneProgressChip";
import { MilestoneSummaryRow } from "./MilestoneSummaryRow";
import { EntityCopyActions } from "../../../shared/ui/EntityCopyActions";
import { useEntityContextMenu } from "../../../shared/ui/EntityContextMenu";
import { useRecordRecentlyViewed } from "../hooks/useRecordRecentlyViewed";
import { ReportSummaryStrip } from "./reports/ReportChrome";

function lifecycleOf(row: { lifecycleStatus?: MilestoneLifecycleStatus; isCompleted: boolean }) {
  return row.lifecycleStatus ?? (row.isCompleted ? "completed" : "open");
}

export function MilestoneDetailPage() {
  const { projectId = "", milestoneId = "" } = useParams();
  const qc = useQueryClient();
  const [dialogState, setDialogState] = useState<{
    mode: MilestoneDialogMode;
    milestone: MilestoneRow;
  } | null>(null);
  const milestoneQuery = useQuery({
    queryKey: ["milestone", projectId, milestoneId],
    queryFn: () => fetchMilestone(projectId, milestoneId),
    enabled: Boolean(projectId && milestoneId)
  });

  useRecordRecentlyViewed(
    projectId,
    milestoneQuery.data
      ? { kind: "milestone", id: milestoneId, title: milestoneQuery.data.name }
      : null
  );
  const runsQuery = useQuery({
    queryKey: ["milestone-runs", projectId, milestoneId],
    queryFn: () => fetchMilestoneRuns(projectId, milestoneId),
    enabled: Boolean(projectId && milestoneId)
  });
  const milestonesQuery = useQuery({
    queryKey: ["milestones", projectId],
    queryFn: () => fetchMilestones(projectId),
    enabled: Boolean(projectId)
  });
  const summaryQuery = useQuery({
    queryKey: reportKeys.milestoneSummary(projectId),
    queryFn: () => fetchMilestoneSummary(projectId),
    enabled: Boolean(projectId)
  });

  const rollup = useMemo(
    () => summaryQuery.data?.items.find((row) => row.milestoneId === milestoneId) ?? null,
    [summaryQuery.data, milestoneId]
  );
  const childRollups = useMemo(() => {
    const items = summaryQuery.data?.items ?? [];
    return items.filter((row) => row.parentMilestoneId === milestoneId);
  }, [summaryQuery.data, milestoneId]);

  const execution = useMemo(() => {
    if (!rollup) return { total: 0, passed: 0, failed: 0, remaining: 0 };
    const remaining = Math.max(0, rollup.total - rollup.passed - rollup.failed);
    return { total: rollup.total, passed: rollup.passed, failed: rollup.failed, remaining };
  }, [rollup]);

  const parentOptions = useMemo(
    () => milestonesQuery.data ?? (milestoneQuery.data ? [milestoneQuery.data] : []),
    [milestoneQuery.data, milestonesQuery.data]
  );

  const invalidateMilestoneQueries = () => {
    void qc.invalidateQueries({ queryKey: ["milestone", projectId, milestoneId] });
    void qc.invalidateQueries({ queryKey: ["milestones", projectId] });
    void qc.invalidateQueries({ queryKey: reportKeys.milestoneSummary(projectId) });
  };

  const createMutation = useMutation({
    mutationFn: (input: {
      name: string;
      parentMilestoneId?: string | null;
      startDate?: string | null;
      dueDate?: string | null;
    }) => createMilestone(projectId, input),
    onSuccess: () => {
      setDialogState(null);
      invalidateMilestoneQueries();
    }
  });

  const updateMutation = useMutation({
    mutationFn: (input: {
      milestoneId?: string;
      name?: string;
      isCompleted?: boolean;
      startNow?: boolean;
      parentMilestoneId?: string | null;
      startDate?: string | null;
      dueDate?: string | null;
    }) =>
      updateMilestone({ projectId, milestoneId, ...input }),
    onSuccess: () => {
      setDialogState(null);
      invalidateMilestoneQueries();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (targetMilestoneId: string) => deleteMilestone(projectId, targetMilestoneId),
    onSuccess: () => {
      invalidateMilestoneQueries();
    }
  });

  const submitDialog = (values: MilestoneDialogValues) => {
    if (!dialogState) return;
    if (dialogState.mode === "add-sub") {
      void createMutation.mutateAsync({
        name: values.name ?? "",
        parentMilestoneId: values.parentMilestoneId ?? dialogState.milestone.id,
        startDate: values.startDate,
        dueDate: values.dueDate
      });
      return;
    }

    void updateMutation.mutateAsync({
      milestoneId: dialogState.milestone.id,
      name: values.name,
      parentMilestoneId: values.parentMilestoneId,
      startDate: values.startDate,
      dueDate: values.dueDate,
      startNow: values.startNow
    });
  };

  const milestone = milestoneQuery.data;
  const lifecycleStatus = milestone?.lifecycleStatus ?? (milestone?.isCompleted ? "completed" : "open");
  const { openEntityContextMenu } = useEntityContextMenu();

  const summaryItems = useMemo(() => {
    if (!rollup) return [];
    return [
      { label: "Linked runs", value: rollup.runCount, tone: "neutral" as const },
      ...(rollup.includesSubMilestones
        ? [{ label: "Direct runs", value: rollup.directRunCount, tone: "neutral" as const }]
        : []),
      { label: "Open runs", value: rollup.openRunCount, tone: "amber" as const },
      { label: "Progress", value: `${rollup.progress}%`, tone: "violet" as const },
      { label: "Passed", value: rollup.passed, tone: "emerald" as const },
      { label: "Failed", value: rollup.failed, tone: "rose" as const }
    ];
  }, [rollup]);

  if (milestoneQuery.isLoading || runsQuery.isLoading) {
    return <LoadingState message="Loading milestone detail..." />;
  }
  if (milestoneQuery.isError || runsQuery.isError || !milestoneQuery.data) {
    return (
      <ErrorState
        title="Could not load milestone detail"
        onRetry={() => void Promise.all([milestoneQuery.refetch(), runsQuery.refetch(), summaryQuery.refetch()])}
      />
    );
  }

  return (
    <div className="space-y-4">
      <header
        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        onContextMenu={(event) =>
          openEntityContextMenu(event, { projectId, kind: "milestone", entityId: milestoneId })
        }
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Milestone</p>
            <h2 className="text-xl font-semibold text-slate-900">{milestoneQuery.data.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <MilestoneLifecycleBadge status={lifecycleStatus} />
              {milestone?.parentMilestoneId ? (
                <Link
                  to={`/projects/${projectId}/milestones/${milestone.parentMilestoneId}`}
                  className="text-xs text-slate-600 underline"
                >
                  View parent milestone
                </Link>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <EntityCopyActions projectId={projectId} kind="milestone" entityId={milestoneId} compact />
              {lifecycleStatus === "upcoming" ? (
                <button
                  type="button"
                  className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                  disabled={updateMutation.isPending}
                  onClick={() => setDialogState({ mode: "start", milestone: milestoneQuery.data })}
                >
                  Start now
                </button>
              ) : null}
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                disabled={updateMutation.isPending}
                onClick={() => setDialogState({ mode: "edit", milestone: milestoneQuery.data })}
              >
                Edit
              </button>
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                disabled={createMutation.isPending}
                onClick={() => setDialogState({ mode: "add-sub", milestone: milestoneQuery.data })}
              >
                Add sub-milestone
              </button>
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                disabled={updateMutation.isPending}
                onClick={() =>
                  void updateMutation.mutateAsync({
                    isCompleted: lifecycleStatus !== "completed"
                  })
                }
              >
                {lifecycleStatus === "completed" ? "Reopen" : "Complete"}
              </button>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <PrintLinkButton to={`/projects/${projectId}/milestones/${milestoneId}/print`} />
            <Link to={`/projects/${projectId}/reports/milestones`} className="text-sm font-medium text-slate-700 underline">
              Milestone summary report
            </Link>
          </div>
        </div>
      </header>

      {rollup ? (
        <>
          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <MilestoneProgressChip
                progress={rollup.progress}
                runCount={rollup.runCount}
                childCount={rollup.childCount}
                includesSubMilestones={rollup.includesSubMilestones}
              />
              {rollup.includesSubMilestones ? (
                <span className="text-xs text-slate-600">
                  Includes sub-milestone runs ({rollup.directRunCount} direct / {rollup.runCount} total runs)
                </span>
              ) : null}
            </div>
            <MilestoneProgressBar
              projectId={projectId}
              milestoneId={milestoneId}
              total={rollup.total}
              passed={rollup.passed}
              failed={rollup.failed}
              className="max-w-3xl"
            />
          </div>
          <ReportSummaryStrip items={summaryItems} />
          <MilestoneForecastPanel forecast={rollup.forecast} />
          <ExecutionSummaryChart projectId={projectId} execution={execution} />
        </>
      ) : null}

      {runsQuery.data && runsQuery.data.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Linked runs</h3>
          <ul className="mt-3 space-y-2">
            {runsQuery.data.map((run) => (
              <li key={run.runId} className="rounded border border-slate-200 px-3 py-2 text-sm">
                <Link to={`/projects/${projectId}/runs/${run.runId}`} className="font-medium text-slate-800 underline">
                  {run.runName}
                </Link>
                <span className="ml-2 text-xs text-slate-500">
                  {run.status} / {run.progress}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <EmptyState title="No linked runs" description="Runs connected to this milestone will appear here." />
      )}

      {milestone?.children && milestone.children.length > 0 ? (
        <section className="border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Sub-milestones</h3>
          </div>
          <ul className="px-4">
            {milestone.children.map((child) => {
              const childRollup = childRollups.find((row) => row.milestoneId === child.id);
              return (
                <MilestoneSummaryRow
                  key={child.id}
                  projectId={projectId}
                  row={{ ...child, depth: 0 }}
                  status={lifecycleOf(child)}
                  rollup={childRollup}
                  display="detail"
                  isMutating={createMutation.isPending || updateMutation.isPending || deleteMutation.isPending}
                  onEdit={(row) => setDialogState({ mode: "edit", milestone: row })}
                  onAddSubMilestone={(row) => setDialogState({ mode: "add-sub", milestone: row })}
                  onStart={(row) => setDialogState({ mode: "start", milestone: row })}
                  onToggleComplete={(targetMilestoneId, isCompleted) =>
                    void updateMutation.mutateAsync({ milestoneId: targetMilestoneId, isCompleted })
                  }
                  onDelete={(targetMilestoneId) => void deleteMutation.mutateAsync(targetMilestoneId)}
                />
              );
            })}
          </ul>
        </section>
      ) : null}

      {dialogState ? (
        <MilestoneDialog
          open
          mode={dialogState.mode}
          milestone={dialogState.milestone}
          parentOptions={parentOptions}
          saving={createMutation.isPending || updateMutation.isPending}
          onCancel={() => setDialogState(null)}
          onSubmit={submitDialog}
        />
      ) : null}
    </div>
  );
}
