import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { Button, WorkbenchPage, WorkbenchToolbar } from "../../../shared/ui";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { createMilestone, deleteMilestone, fetchMilestones, updateMilestone } from "../api/advancedApi";
import { fetchMilestoneSummary } from "../api/milestoneSummaryApi";
import type { MilestoneLifecycleStatus, MilestoneRow } from "../api/planningApi";
import { reportKeys } from "../hooks/reportKeys";
import { orderMilestonesForHierarchy } from "../utils/milestoneDisplay";
import { MilestoneDialog } from "./MilestoneDialog";
import type { MilestoneDialogMode, MilestoneDialogValues } from "./MilestoneDialog";
import { MilestonesHeader } from "./MilestonesHeader";
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
  if (typeof window === "undefined") return "medium";
  const value = window.localStorage.getItem("milestoneOverviewDisplay");
  return value === "compact" || value === "medium" || value === "detail" ? value : "medium";
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
  const [dialogState, setDialogState] = useState<{
    mode: MilestoneDialogMode;
    milestone?: MilestoneRow;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MilestoneRow | null>(null);

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
      setDialogState(null);
      void qc.invalidateQueries({ queryKey: ["milestones", projectId] });
      void qc.invalidateQueries({ queryKey: reportKeys.milestoneSummary(projectId) });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (milestoneId: string) => deleteMilestone(projectId, milestoneId),
    onSuccess: () => {
      setPendingDelete(null);
      void qc.invalidateQueries({ queryKey: ["milestones", projectId] });
      void qc.invalidateQueries({ queryKey: reportKeys.milestoneSummary(projectId) });
    }
  });

  const submitDialog = (values: MilestoneDialogValues) => {
    if (!dialogState) return;
    if (dialogState.mode === "create" || dialogState.mode === "add-sub") {
      void createMutation.mutateAsync({
        name: values.name ?? "",
        parentMilestoneId: values.parentMilestoneId ?? dialogState.milestone?.id ?? null,
        startDate: values.startDate,
        dueDate: values.dueDate
      });
      return;
    }

    if (!dialogState.milestone) return;
    void updateMutation.mutateAsync({
      milestoneId: dialogState.milestone.id,
      name: values.name,
      parentMilestoneId: values.parentMilestoneId,
      startDate: values.startDate,
      dueDate: values.dueDate,
      startNow: values.startNow
    });
  };

  const changeDisplay = (next: OverviewDisplay) => {
    setDisplay(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("milestoneOverviewDisplay", next);
    }
  };

  const openCreate = () => {
    createMutation.reset();
    updateMutation.reset();
    setDialogState({ mode: "create" });
  };

  const openDialog = (mode: MilestoneDialogMode, milestone: MilestoneRow) => {
    createMutation.reset();
    updateMutation.reset();
    setDialogState({ mode, milestone });
  };

  const dialogBusy = createMutation.isPending || updateMutation.isPending;
  const dialogFailed = createMutation.isError || updateMutation.isError;
  const dialogError =
    (createMutation.error instanceof Error ? createMutation.error.message : undefined) ??
    (updateMutation.error instanceof Error ? updateMutation.error.message : undefined);

  const header = <MilestonesHeader projectId={projectId} onAddMilestone={openCreate} />;
  const toolbar = (
    <WorkbenchToolbar className="flex flex-wrap items-center gap-2 border border-slate-300 bg-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Milestone display">
        {displayOptions.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={display === option.value ? "primary" : "secondary"}
            aria-pressed={display === option.value}
            onClick={() => changeDisplay(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <p className="ml-auto text-xs text-slate-600">
        <span className="font-medium text-slate-900">{dashboard?.openCount ?? grouped.open.length}</span> open
        <span className="text-slate-300"> · </span>
        <span className="font-medium text-slate-900">{dashboard?.upcomingCount ?? grouped.upcoming.length}</span>{" "}
        upcoming
        <span className="text-slate-300"> · </span>
        <span className="font-medium text-slate-900">{dashboard?.completedCount ?? grouped.completed.length}</span>{" "}
        completed
      </p>
    </WorkbenchToolbar>
  );

  const dialog = (
    <MilestoneDialog
      open={Boolean(dialogState)}
      mode={dialogState?.mode ?? "create"}
      milestone={dialogState?.milestone}
      parentOptions={parentOptions}
      saving={dialogBusy}
      saveStatus={dialogBusy ? "saving" : dialogFailed ? "failed" : "idle"}
      saveError={dialogError}
      onCancel={() => setDialogState(null)}
      onSubmit={submitDialog}
    />
  );

  const deleteDialog = (
    <ConfirmDialog
      open={Boolean(pendingDelete)}
      title="Delete milestone"
      description={
        pendingDelete
          ? `Delete ${pendingDelete.name}? Linked runs stay in the project but lose this milestone.`
          : undefined
      }
      confirmLabel="Delete milestone"
      variant="danger"
      confirmDisabled={deleteMutation.isPending}
      onCancel={() => setPendingDelete(null)}
      onConfirm={() => pendingDelete && void deleteMutation.mutateAsync(pendingDelete.id)}
    />
  );

  const renderSection = (
    title: string,
    rows: Array<MilestoneRow & { depth: number }>,
    description?: string
  ) => {
    if (rows.length === 0) return null;
    return (
      <section className="overflow-hidden border border-slate-300 bg-white">
        <header className="border-b border-slate-200 px-3 py-2">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description ? <p className="text-xs text-slate-500">{description}</p> : null}
        </header>
        <ul className="px-3">
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
                onEdit={(milestone) => openDialog("edit", milestone)}
                onAddSubMilestone={(milestone) => openDialog("add-sub", milestone)}
                onStart={(milestone) => openDialog("start", milestone)}
                onToggleComplete={(milestoneId, isCompleted) =>
                  void updateMutation.mutateAsync({ milestoneId, isCompleted })
                }
                onDelete={(milestone) => setPendingDelete(milestone)}
              />
            );
          })}
        </ul>
      </section>
    );
  };

  if (isLoading) {
    return (
      <WorkbenchPage data-milestones-workbench="">
        {header}
        <LoadingState message="Loading milestones..." />
        {dialog}
      </WorkbenchPage>
    );
  }
  if (isError) {
    return (
      <WorkbenchPage data-milestones-workbench="">
        {header}
        <ErrorState title="Could not load milestones" onRetry={() => refetch()} />
        {dialog}
      </WorkbenchPage>
    );
  }

  const isEmpty = !data || data.length === 0;

  return (
    <WorkbenchPage data-milestones-workbench="">
      {header}
      {toolbar}
      {isEmpty ? (
        <EmptyState
          title="No milestones yet"
          description="Use Add Milestone to plan a release. Reports stay in More actions."
        />
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
      {dialog}
      {deleteDialog}
    </WorkbenchPage>
  );
}
