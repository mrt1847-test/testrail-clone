import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Button, DataTable, WorkbenchPage, WorkbenchToolbar } from "../../../shared/ui";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { createPlan, deletePlan, fetchPlans, fetchPlanSummary, updatePlan, type PlanRow } from "../api/advancedApi";
import { PlanNameDialog } from "./PlanNameDialog";
import { PlansHeader } from "./PlansHeader";

type PlanListRow = PlanRow & {
  entryCount: number | null;
  runCount: number | null;
  openRunCount: number;
  progress: number | null;
};

function progressBar(progress: number) {
  return (
    <div className="flex min-w-28 items-center gap-2">
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
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingPlan, setEditingPlan] = useState<PlanRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PlanRow | null>(null);

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
  const openRunCount = (summaryQuery.data ?? []).reduce((acc, row) => acc + row.openRunCount, 0);

  const rows = useMemo<PlanListRow[]>(
    () =>
      (data ?? []).map((plan) => {
        const summary = summaryById.get(plan.id);
        return {
          ...plan,
          entryCount: summary?.entryCount ?? null,
          runCount: summary?.runCount ?? null,
          openRunCount: summary?.openRunCount ?? 0,
          progress: summary?.progress ?? null
        };
      }),
    [data, summaryById]
  );

  const createPlanMutation = useMutation({
    mutationFn: (name: string) => createPlan(projectId, { name }),
    onSuccess: () => {
      setDialogMode(null);
      void qc.invalidateQueries({ queryKey: ["plans", projectId] });
      void qc.invalidateQueries({ queryKey: ["reports", projectId, "plan-summary"] });
    }
  });
  const updatePlanMutation = useMutation({
    mutationFn: (input: { planId: string; name: string }) => updatePlan(projectId, input.planId, { name: input.name }),
    onSuccess: () => {
      setDialogMode(null);
      setEditingPlan(null);
      void qc.invalidateQueries({ queryKey: ["plans", projectId] });
      void qc.invalidateQueries({ queryKey: ["reports", projectId, "plan-summary"] });
    }
  });
  const deletePlanMutation = useMutation({
    mutationFn: (planId: string) => deletePlan(projectId, planId),
    onSuccess: () => {
      setPendingDelete(null);
      void qc.invalidateQueries({ queryKey: ["plans", projectId] });
      void qc.invalidateQueries({ queryKey: ["reports", projectId, "plan-summary"] });
    }
  });

  const nameSaving = createPlanMutation.isPending || updatePlanMutation.isPending;
  const nameFailed = createPlanMutation.isError || updatePlanMutation.isError;
  const nameError =
    (createPlanMutation.error instanceof Error ? createPlanMutation.error.message : undefined) ??
    (updatePlanMutation.error instanceof Error ? updatePlanMutation.error.message : undefined);

  const openCreate = () => {
    createPlanMutation.reset();
    updatePlanMutation.reset();
    setEditingPlan(null);
    setDialogMode("create");
  };

  const header = <PlansHeader projectId={projectId} onAddPlan={openCreate} />;
  const toolbar = (
    <WorkbenchToolbar className="flex flex-wrap items-center gap-2 border border-slate-300 bg-white px-3 py-2">
      <p className="text-xs text-slate-600">
        <span className="font-medium text-slate-900">{data?.length ?? 0}</span> plans
        <span className="text-slate-300"> · </span>
        <span className="font-medium text-slate-900">{openRunCount}</span> open runs
      </p>
    </WorkbenchToolbar>
  );

  const dialogs = (
    <>
      <PlanNameDialog
        open={dialogMode !== null}
        mode={dialogMode ?? "create"}
        initialName={editingPlan?.name}
        saving={nameSaving}
        saveStatus={nameSaving ? "saving" : nameFailed ? "failed" : "idle"}
        saveError={nameError}
        onCancel={() => {
          setDialogMode(null);
          setEditingPlan(null);
        }}
        onSubmit={(name) => {
          if (dialogMode === "edit" && editingPlan) {
            void updatePlanMutation.mutateAsync({ planId: editingPlan.id, name });
            return;
          }
          void createPlanMutation.mutateAsync(name);
        }}
      />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete plan"
        description={
          pendingDelete ? `Delete ${pendingDelete.name}? Generated runs stay in the project.` : undefined
        }
        confirmLabel="Delete plan"
        variant="danger"
        confirmDisabled={deletePlanMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && void deletePlanMutation.mutateAsync(pendingDelete.id)}
      />
    </>
  );

  if (isLoading) {
    return (
      <WorkbenchPage data-plans-workbench="">
        {header}
        <LoadingState message="Loading test plans..." />
        {dialogs}
      </WorkbenchPage>
    );
  }
  if (isError) {
    return (
      <WorkbenchPage data-plans-workbench="">
        {header}
        <ErrorState title="Could not load test plans" onRetry={() => refetch()} />
        {dialogs}
      </WorkbenchPage>
    );
  }

  return (
    <WorkbenchPage data-plans-workbench="">
      {header}
      {toolbar}
      {rows.length === 0 ? (
        <EmptyState
          title="No plans yet"
          description="Use Add Plan to compose entries and generate runs. Reports stay in More actions."
        />
      ) : (
        <section className="overflow-hidden border border-slate-300 bg-white">
          <DataTable
            dense
            className="rounded-none border-0"
            rowKey={(row) => row.id}
            rows={rows}
            columns={[
              {
                key: "name",
                header: "Plan",
                cell: (row) => (
                  <Link
                    to={`/projects/${projectId}/plans/${row.id}`}
                    className="font-medium text-slate-900 underline-offset-2 hover:underline"
                  >
                    {row.name}
                  </Link>
                )
              },
              {
                key: "entries",
                header: "Entries",
                headerClassName: "hidden sm:table-cell",
                cellClassName: "hidden sm:table-cell tabular-nums text-slate-700",
                cell: (row) => row.entryCount ?? "—"
              },
              {
                key: "runs",
                header: "Runs",
                headerClassName: "hidden md:table-cell",
                cellClassName: "hidden md:table-cell text-slate-700",
                cell: (row) =>
                  row.runCount == null ? (
                    "—"
                  ) : (
                    <>
                      {row.runCount}
                      {row.openRunCount > 0 ? (
                        <span className="ml-1 text-xs text-slate-500">({row.openRunCount} open)</span>
                      ) : null}
                    </>
                  )
              },
              {
                key: "progress",
                header: "Progress",
                headerClassName: "hidden md:table-cell",
                cellClassName: "hidden md:table-cell",
                cell: (row) => (row.progress == null ? "—" : progressBar(row.progress))
              },
              {
                key: "actions",
                header: "Action",
                align: "right",
                cell: (row) => (
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        createPlanMutation.reset();
                        updatePlanMutation.reset();
                        setEditingPlan(row);
                        setDialogMode("edit");
                      }}
                    >
                      Rename
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setPendingDelete(row)}>
                      Delete
                    </Button>
                  </div>
                )
              }
            ]}
          />
        </section>
      )}
      {dialogs}
    </WorkbenchPage>
  );
}
