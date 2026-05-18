import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { createMilestone, deleteMilestone, fetchMilestones, updateMilestone } from "../api/advancedApi";
import { fetchMilestoneSummary } from "../api/milestoneSummaryApi";
import type { MilestoneLifecycleStatus, MilestoneRow } from "../api/planningApi";
import { reportKeys } from "../hooks/reportKeys";
import { orderMilestonesForHierarchy } from "../utils/milestoneDisplay";
import { ProjectContentHeader } from "../content-header/ProjectContentHeader";
import { MilestoneDashboardPanel } from "./MilestoneDashboardPanel";
import { MilestoneDialog } from "./MilestoneDialog";
import type { MilestoneDialogMode, MilestoneDialogValues } from "./MilestoneDialog";
import { MilestoneSummaryRow } from "./MilestoneSummaryRow";

type OverviewDisplay = "compact" | "medium" | "detail";

const displayOptions: Array<{ value: OverviewDisplay; label: string }> = [
  { value: "compact", label: "Compact" },
  { value: "medium", label: "Medium" },
  { value: "detail", label: "Detail" }
];

function lifecycleOf(row: { lifecycleStatus?: MilestoneLifecycleStatus; isCompleted: boolean }) {
  return row.lifecycleStatus ?? (row.isCompleted ? "completed" : "open");
}

function displayFromStorage(): OverviewDisplay {
  if (typeof window === "undefined") return "detail";
  const value = window.localStorage.getItem("milestoneOverviewDisplay");
  return value === "compact" || value === "medium" || value === "detail" ? value : "detail";
}

function groupMilestones(rows: Array<MilestoneRow & { depth: number }>) {
  return rows.reduce(
    (groups, row) => {
      groups[lifecycleOf(row)].push(row);
      return groups;
    },
    {
      open: [] as Array<MilestoneRow & { depth: number }>,
      upcoming: [] as Array<MilestoneRow & { depth: number }>,
      completed: [] as Array<MilestoneRow & { depth: number }>
    }
  );
}

export function MilestonesPage() {
  const { projectId = "" } = useParams();
  const qc = useQueryClient();
  const [display, setDisplay] = useState<OverviewDisplay>(() => displayFromStorage());
  const [newMilestoneName, setNewMilestoneName] = useState("");
  const [parentMilestoneId, setParentMilestoneId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dialogState, setDialogState] = useState<{
    mode: MilestoneDialogMode;
    milestone: MilestoneRow & { depth?: number };
  } | null>(null);

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
  const grouped = useMemo(() => groupMilestones(ordered), [ordered]);
  const summaryById = useMemo(
    () => new Map((summaryQuery.data?.items ?? []).map((row) => [row.milestoneId, row])),
    [summaryQuery.data?.items]
  );
  const parentOptions = useMemo(() => data ?? [], [data]);
  const dashboard = summaryQuery.data?.dashboard;

  const createMutation = useMutation({
    mutationFn: (input: {
      name: string;
      parentMilestoneId?: string | null;
      startDate?: string | null;
      dueDate?: string | null;
    }) => createMilestone(projectId, input),
    onSuccess: () => {
      setDialogState(null);
      void qc.invalidateQueries({ queryKey: ["milestones", projectId] });
      void qc.invalidateQueries({ queryKey: reportKeys.milestoneSummary(projectId) });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (input: {
      milestoneId: string;
      name?: string;
      isCompleted?: boolean;
      startNow?: boolean;
      parentMilestoneId?: string | null;
      startDate?: string | null;
      dueDate?: string | null;
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

  const submitSidebarCreate = () => {
    void createMutation
      .mutateAsync({
        name: newMilestoneName.trim(),
        parentMilestoneId: parentMilestoneId ? parentMilestoneId : null,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null
      })
      .then(() => {
        setNewMilestoneName("");
        setParentMilestoneId("");
        setStartDate("");
        setDueDate("");
      });
  };

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

    void updateMutation
      .mutateAsync({
        milestoneId: dialogState.milestone.id,
        name: values.name,
        parentMilestoneId: values.parentMilestoneId,
        startDate: values.startDate,
        dueDate: values.dueDate,
        startNow: values.startNow
      })
      .then(() => setDialogState(null));
  };

  const changeDisplay = (next: OverviewDisplay) => {
    setDisplay(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("milestoneOverviewDisplay", next);
    }
  };

  const renderSection = (
    title: string,
    rows: Array<MilestoneRow & { depth: number }>,
    description?: string
  ) => {
    if (rows.length === 0) return null;
    return (
      <section className="border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        <ul className="px-4">
          {rows.map((row) => {
            const status = lifecycleOf(row);
            return (
              <MilestoneSummaryRow
                key={row.id}
                projectId={projectId}
                row={row}
                status={status}
                rollup={summaryById.get(row.id)}
                display={display}
                isMutating={updateMutation.isPending || deleteMutation.isPending}
                onEdit={(milestone) => setDialogState({ mode: "edit", milestone })}
                onAddSubMilestone={(milestone) => setDialogState({ mode: "add-sub", milestone })}
                onStart={(milestone) => setDialogState({ mode: "start", milestone })}
                onToggleComplete={(milestoneId, isCompleted) =>
                  void updateMutation.mutateAsync({ milestoneId, isCompleted })
                }
                onDelete={(milestoneId) => void deleteMutation.mutateAsync(milestoneId)}
              />
            );
          })}
        </ul>
      </section>
    );
  };

  if (isLoading) return <LoadingState message="Loading milestones..." />;
  if (isError) return <ErrorState title="Could not load milestones" onRetry={() => refetch()} />;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <main className="space-y-4">
        <ProjectContentHeader
          projectId={projectId}
          variant="milestones"
          title="Milestones"
          subtitle="Release progress grouped by lifecycle status."
          secondaryActions={
            <div className="inline-flex rounded border border-slate-300 bg-white p-0.5" aria-label="Milestone display">
              {displayOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={
                    display === option.value
                      ? "rounded bg-slate-900 px-3 py-1 text-xs font-medium text-white"
                      : "rounded px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  }
                  onClick={() => changeDisplay(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          }
        />

        {!data || data.length === 0 ? (
          <EmptyState title="No milestones yet" description="Milestone list will appear here." />
        ) : (
          <>
            {renderSection("Open", grouped.open)}
            {renderSection(
              "Upcoming",
              grouped.upcoming,
              "Upcoming milestones have a future start date and can be started when work begins."
            )}
            {renderSection("Completed", grouped.completed)}
          </>
        )}

        {dashboard ? (
          <MilestoneDashboardPanel projectId={projectId} dashboard={dashboard} itemsById={summaryById} compact />
        ) : null}
      </main>

      <aside className="space-y-4">
        <section className="border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Add Milestone</h2>
          <div className="mt-3 grid gap-3">
            <label className="grid gap-1 text-sm text-slate-700">
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
              <span>Start date</span>
              <input
                type="date"
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm text-slate-700">
              <span>Due date</span>
              <input
                type="date"
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>
          </div>
          <button
            className="mt-3 w-full rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            disabled={!newMilestoneName.trim() || createMutation.isPending}
            onClick={submitSidebarCreate}
          >
            Add milestone
          </button>
        </section>

        <section className="border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Milestone Count</h2>
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-semibold text-slate-900">{dashboard?.openCount ?? grouped.open.length}</span> open and{" "}
            <span className="font-semibold text-slate-900">
              {dashboard?.completedCount ?? grouped.completed.length}
            </span>{" "}
            completed
          </p>
          <Link
            to={`/projects/${projectId}/reports/milestones`}
            className="mt-3 inline-block text-sm font-medium text-indigo-800 hover:underline"
          >
            Milestone summary report
          </Link>
        </section>
      </aside>

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
