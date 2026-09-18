import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  Button,
  DataTable,
  OverflowMenu,
  SelectionActionBar,
  WorkbenchPage,
  WorkbenchPageHeader,
  WorkbenchToolbar
} from "../../../shared/ui";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { fetchRuns } from "../../runs/api/runApi";
import { RunPlanProgressBar } from "../../runs/components/RunPlanProgressBar";
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
import { useProjectArchived } from "../context/ProjectArchiveContext";
import { parseCaseIdList } from "../utils/planCaseSelection";
import { planDetailHeaderMenuGroups } from "../utils/planHeaderMenu";
import { PlanDefaultsDialog, type PlanDefaultsValues } from "./PlanDefaultsDialog";
import { PlanEntryDialog, type PlanEntryDialogValues } from "./PlanEntryDialog";

function statusCountsForRollup(row: PlanRollupRow): Record<string, number> {
  return {
    passed: row.passed,
    failed: row.failed,
    blocked: row.blocked,
    retest: row.retest,
    untested: row.untested
  };
}

function isoOrNull(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function PlanDetailPage() {
  const { projectId = "", planId = "" } = useParams();
  const qc = useQueryClient();
  const isProjectArchived = useProjectArchived();
  const [entryDialog, setEntryDialog] = useState<"create" | "edit" | null>(null);
  const [editingEntry, setEditingEntry] = useState<PlanEntryRow | null>(null);
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PlanEntryRow | null>(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [matrixEntryId, setMatrixEntryId] = useState<string | null>(null);
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
    queryKey: ["plan-matrix", projectId, planId, matrixEntryId ?? "_none"],
    queryFn: () => fetchPlanMatrix(projectId, planId, matrixEntryId ?? undefined),
    enabled: Boolean(projectId && planId)
  });
  const rollupQuery = useQuery({
    queryKey: ["plan-rollup", projectId, planId],
    queryFn: () => fetchPlanRollupByConfiguration(projectId, planId),
    enabled: Boolean(projectId && planId)
  });
  const selectedEntryConfigurationQuery = useQuery({
    queryKey: ["plan-entry-configurations", projectId, planId, matrixEntryId ?? "_none"],
    queryFn: () => fetchPlanEntryConfigurations(projectId, planId, matrixEntryId ?? ""),
    enabled: Boolean(projectId && planId && matrixEntryId)
  });

  const entries = entriesQuery.data ?? [];
  const members = membersQuery.data ?? [];
  const planSummary = useMemo(
    () => summaryQuery.data?.find((row) => row.planId === planId) ?? null,
    [planId, summaryQuery.data]
  );
  const runById = useMemo(() => new Map((runsQuery.data ?? []).map((run) => [run.id, run])), [runsQuery.data]);
  const linkedRunCount = entries.filter((entry) => entry.runId).length;
  const openRunCount =
    planSummary?.openRunCount ??
    entries.filter((entry) => entry.runId && runById.get(entry.runId)?.status !== "closed").length;

  const selectedRows = entries.filter((entry) => selectedEntryIds.includes(entry.id));
  const generateTargets = selectedRows.filter((entry) => !entry.runId);

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
      setEntryDialog(null);
      invalidatePlanHub();
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
    mutationFn: (values: PlanDefaultsValues) =>
      updatePlan(projectId, planId, {
        assignedTo: values.assignedTo ? values.assignedTo : null,
        refs: values.refs.trim() ? values.refs.trim() : null,
        startDate: isoOrNull(values.startDate),
        dueOn: isoOrNull(values.dueOn)
      }),
    onSuccess: () => {
      setDefaultsOpen(false);
      invalidatePlanHub();
    }
  });
  const updateEntryMutation = useMutation({
    mutationFn: (input: { entryId: string; values: PlanEntryDialogValues }) =>
      updatePlanEntry(projectId, planId, input.entryId, {
        name: input.values.name.trim(),
        environment: input.values.environment.trim() || null,
        assignedTo: input.values.assignedTo ? input.values.assignedTo : null,
        refs: input.values.refs.trim() ? input.values.refs.trim() : null,
        startDate: isoOrNull(input.values.startDate),
        dueOn: isoOrNull(input.values.dueOn),
        includeAll: input.values.includeAll,
        includeCaseIds: input.values.includeAll ? [] : parseCaseIdList(input.values.includeCaseIds),
        excludeCaseIds: parseCaseIdList(input.values.excludeCaseIds),
        isIncluded: input.values.isIncluded
      }),
    onSuccess: () => {
      setEntryDialog(null);
      setEditingEntry(null);
      invalidatePlanHub();
    }
  });
  const saveConfigurationsMutation = useMutation({
    mutationFn: () =>
      savePlanEntryConfigurations({
        projectId,
        planId,
        entryId: matrixEntryId ?? "",
        configurationIds: selectedConfigurationIds
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["plan-entry-configurations", projectId, planId, matrixEntryId ?? "_none"] });
      void qc.invalidateQueries({ queryKey: ["plan-matrix", projectId, planId] });
      invalidatePlanHub();
    }
  });
  const deleteEntryMutation = useMutation({
    mutationFn: (entryId: string) => deletePlanEntry(projectId, planId, entryId),
    onSuccess: (_result, entryId) => {
      setPendingDelete(null);
      setSelectedEntryIds((current) => current.filter((id) => id !== entryId));
      if (matrixEntryId === entryId) setMatrixEntryId(null);
      invalidatePlanHub();
    }
  });

  useEffect(() => {
    if (selectedEntryConfigurationQuery.data) {
      setSelectedConfigurationIds(selectedEntryConfigurationQuery.data.configurationIds);
    }
  }, [selectedEntryConfigurationQuery.data]);

  const overflowGroups = useMemo(
    () =>
      planDetailHeaderMenuGroups(projectId, planId, {
        onPlanDefaults: () => {
          updatePlanMutation.reset();
          setDefaultsOpen(true);
        }
      }),
    [planId, projectId, updatePlanMutation]
  );

  const openCreateEntry = () => {
    createEntryMutation.reset();
    updateEntryMutation.reset();
    setEditingEntry(null);
    setEntryDialog("create");
  };

  const openEditEntry = (entry: PlanEntryRow) => {
    createEntryMutation.reset();
    updateEntryMutation.reset();
    setEditingEntry(entry);
    setMatrixEntryId(entry.id);
    setEntryDialog("edit");
  };

  const toggleSelected = (entryId: string, checked: boolean) => {
    setSelectedEntryIds((current) =>
      checked ? Array.from(new Set([...current, entryId])) : current.filter((id) => id !== entryId)
    );
  };

  const allSelected = entries.length > 0 && selectedEntryIds.length === entries.length;
  const entrySaving = createEntryMutation.isPending || updateEntryMutation.isPending;
  const entryFailed = createEntryMutation.isError || updateEntryMutation.isError;
  const entryError =
    (createEntryMutation.error instanceof Error ? createEntryMutation.error.message : undefined) ??
    (updateEntryMutation.error instanceof Error ? updateEntryMutation.error.message : undefined);

  const header = (
    <WorkbenchPageHeader
      title={planQuery.data?.name ?? "Test plan"}
      description="Compose entries, then generate runs. Plan settings stay in More actions."
      primaryAction={
        <Button
          size="md"
          disabled={isProjectArchived}
          title={isProjectArchived ? "Archived projects are read-only" : "Add a plan entry"}
          onClick={openCreateEntry}
        >
          Add entry
        </Button>
      }
      utilityAction={<OverflowMenu groups={overflowGroups} />}
    />
  );

  const toolbar = (
    <WorkbenchToolbar className="flex flex-wrap items-center gap-2 border border-slate-300 bg-white px-3 py-2">
      <p className="text-xs text-slate-600">
        <span className="font-medium text-slate-900">{entries.length}</span> entries
        <span className="text-slate-300"> · </span>
        <span className="font-medium text-slate-900">{planSummary?.runCount ?? linkedRunCount}</span> generated runs
        <span className="text-slate-300"> · </span>
        <span className="font-medium text-slate-900">{openRunCount}</span> open
        <span className="text-slate-300"> · </span>
        <span className="font-medium text-slate-900">{planSummary?.progress ?? 0}%</span> complete
      </p>
      <div className="ml-auto">
        <Button
          size="sm"
          variant="secondary"
          disabled={createRunMutation.isPending || entries.length === 0 || isProjectArchived}
          loading={createRunMutation.isPending}
          onClick={() => void createRunMutation.mutateAsync(undefined)}
        >
          Generate next run
        </Button>
      </div>
    </WorkbenchToolbar>
  );

  const dialogs = (
    <>
      <PlanEntryDialog
        open={entryDialog !== null}
        mode={entryDialog ?? "create"}
        entry={editingEntry}
        members={members}
        saving={entrySaving}
        saveStatus={entrySaving ? "saving" : entryFailed ? "failed" : "idle"}
        saveError={entryError}
        onCancel={() => {
          setEntryDialog(null);
          setEditingEntry(null);
        }}
        onSubmit={(values) => {
          if (entryDialog === "edit" && editingEntry) {
            void updateEntryMutation.mutateAsync({ entryId: editingEntry.id, values });
            return;
          }
          void createEntryMutation.mutateAsync({
            name: values.name.trim(),
            environment: values.environment.trim() || undefined
          });
        }}
      />
      <PlanDefaultsDialog
        open={defaultsOpen}
        plan={planQuery.data}
        members={members}
        saving={updatePlanMutation.isPending}
        saveStatus={updatePlanMutation.isPending ? "saving" : updatePlanMutation.isError ? "failed" : "idle"}
        saveError={updatePlanMutation.error instanceof Error ? updatePlanMutation.error.message : undefined}
        onCancel={() => setDefaultsOpen(false)}
        onSubmit={(values) => void updatePlanMutation.mutateAsync(values)}
      />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete entry"
        description={pendingDelete ? `Delete ${pendingDelete.name} from this plan?` : undefined}
        confirmLabel="Delete entry"
        variant="danger"
        confirmDisabled={deleteEntryMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && void deleteEntryMutation.mutateAsync(pendingDelete.id)}
      />
    </>
  );

  if (planQuery.isLoading || entriesQuery.isLoading) {
    return (
      <WorkbenchPage data-plan-hub-workbench="">
        {header}
        <LoadingState message="Loading test plan detail..." />
        {dialogs}
      </WorkbenchPage>
    );
  }
  if (planQuery.isError || entriesQuery.isError || !planQuery.data) {
    return (
      <WorkbenchPage data-plan-hub-workbench="">
        {header}
        <ErrorState
          title="Could not load test plan detail"
          onRetry={() => void Promise.all([planQuery.refetch(), entriesQuery.refetch()])}
        />
        {dialogs}
      </WorkbenchPage>
    );
  }

  return (
    <WorkbenchPage data-plan-hub-workbench="">
      {header}
      {toolbar}
      <SelectionActionBar selectedCount={selectedRows.length} aria-label="Selected plan entries">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="whitespace-nowrap text-sm text-sky-950">{selectedRows.length} selected</strong>
          <Button
            size="sm"
            disabled={generateTargets.length === 0 || createRunMutation.isPending || isProjectArchived}
            loading={createRunMutation.isPending}
            onClick={() => {
              void (async () => {
                for (const entry of generateTargets) {
                  await createRunMutation.mutateAsync(entry.id);
                }
              })();
            }}
          >
            Generate run
          </Button>
          <div className="ml-auto">
            <Button variant="ghost" size="sm" onClick={() => setSelectedEntryIds([])}>
              Clear selection
            </Button>
          </div>
        </div>
      </SelectionActionBar>

      {entries.length === 0 ? (
        <EmptyState
          title="No plan entries"
          description="Use Add entry to compose this plan. Plan defaults and reports stay in More actions."
        />
      ) : (
        <section className="overflow-hidden border border-slate-300 bg-white">
          <header className="border-b border-slate-200 px-3 py-2">
            <h2 className="text-sm font-semibold text-slate-900">Plan entries</h2>
            <p className="text-xs text-slate-500">
              {linkedRunCount} of {entries.length} entries have generated runs.
            </p>
          </header>
          <DataTable
            dense
            className="rounded-none border-0"
            rowKey={(row) => row.id}
            rows={entries}
            columns={[
              {
                key: "select",
                header: (
                  <input
                    type="checkbox"
                    aria-label="Select all plan entries"
                    checked={allSelected}
                    ref={(element) => {
                      if (element) element.indeterminate = selectedRows.length > 0 && !allSelected;
                    }}
                    onChange={(event) =>
                      setSelectedEntryIds(event.target.checked ? entries.map((entry) => entry.id) : [])
                    }
                  />
                ),
                cell: (row) => (
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.name}`}
                    checked={selectedEntryIds.includes(row.id)}
                    onChange={(event) => toggleSelected(row.id, event.target.checked)}
                  />
                )
              },
              {
                key: "entry",
                header: "Entry",
                cell: (row) => (
                  <div>
                    <p className="font-medium text-slate-900">{row.name}</p>
                    <p className="text-xs text-slate-500">
                      {row.environment || "No environment"} · {row.isIncluded ? "included" : "excluded"}
                      {row.refs ? ` · refs ${row.refs}` : ""}
                    </p>
                  </div>
                )
              },
              {
                key: "cases",
                header: "Cases",
                headerClassName: "hidden md:table-cell",
                cellClassName: "hidden md:table-cell text-xs text-slate-600",
                cell: (row) => (
                  <>
                    {row.includeAll ? "All cases" : `${row.includeCaseIds.length} included`}
                    {row.excludeCaseIds.length > 0 ? (
                      <span className="block text-rose-700">{row.excludeCaseIds.length} excluded</span>
                    ) : null}
                  </>
                )
              },
              {
                key: "run",
                header: "Generated run",
                cell: (row) =>
                  row.runId ? (
                    <Link
                      to={`/projects/${projectId}/runs/${row.runId}`}
                      className="text-xs font-medium text-slate-800 underline-offset-2 hover:underline"
                    >
                      Run #{row.runId}
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-500">No run yet</span>
                  )
              },
              {
                key: "actions",
                header: "Action",
                align: "right",
                cell: (row) => (
                  <div className="flex flex-wrap justify-end gap-1">
                    {!row.runId ? (
                      <Button
                        size="sm"
                        disabled={createRunMutation.isPending || isProjectArchived}
                        onClick={() => void createRunMutation.mutateAsync(row.id)}
                      >
                        Generate run
                      </Button>
                    ) : null}
                    <Button variant="secondary" size="sm" onClick={() => openEditEntry(row)}>
                      Edit
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

      <section className="border border-slate-300 bg-white px-3 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Configuration matrix</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {matrixEntryId
            ? `Mapped to ${entries.find((entry) => entry.id === matrixEntryId)?.name ?? "the selected entry"}.`
            : "Edit an entry to choose its configurations."}
        </p>
        {matrixQuery.data ? (
          <div className="mt-3 space-y-3">
            {matrixQuery.data.groups.map((group) => (
              <div key={group.id}>
                <p className="text-xs font-medium text-slate-600">{group.name}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {group.configurations.map((cfg) => {
                    const selected = selectedConfigurationIds.includes(cfg.id);
                    return (
                      <Button
                        key={cfg.id}
                        type="button"
                        size="sm"
                        variant={selected ? "primary" : "secondary"}
                        aria-pressed={selected}
                        disabled={!matrixEntryId}
                        onClick={() =>
                          setSelectedConfigurationIds((prev) =>
                            selected
                              ? prev.filter((id) => id !== cfg.id)
                              : [...prev.filter((id) => !group.configurations.some((item) => item.id === id)), cfg.id]
                          )
                        }
                      >
                        {cfg.name}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={!matrixEntryId || saveConfigurationsMutation.isPending}
                loading={saveConfigurationsMutation.isPending}
                onClick={() => matrixEntryId && void saveConfigurationsMutation.mutateAsync()}
              >
                Save combination
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!matrixEntryId || createRunByConfigurationMutation.isPending || isProjectArchived}
                loading={createRunByConfigurationMutation.isPending}
                onClick={() =>
                  matrixEntryId &&
                  void createRunByConfigurationMutation.mutateAsync({
                    entryId: matrixEntryId,
                    configurationIds: selectedConfigurationIds
                  })
                }
              >
                Generate run by configuration
              </Button>
            </div>
            {matrixEntryId ? (
              <div className="text-xs text-slate-600">
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

      <section className="overflow-hidden border border-slate-300 bg-white">
        <header className="border-b border-slate-200 px-3 py-2">
          <h2 className="text-sm font-semibold text-slate-900">Rollup by configuration</h2>
        </header>
        {rollupQuery.data && rollupQuery.data.length > 0 ? (
          <DataTable
            dense
            className="rounded-none border-0"
            rowKey={(row) => row.configurationId}
            rows={rollupQuery.data}
            columns={[
              {
                key: "name",
                header: "Configuration",
                cell: (row) => (
                  <div>
                    <p className="font-medium text-slate-900">{row.configurationName}</p>
                    <p className="text-xs text-slate-500">{row.groupName}</p>
                  </div>
                )
              },
              {
                key: "entries",
                header: "Entries",
                cell: (row) => row.entryCount
              },
              {
                key: "runs",
                header: "Runs",
                cell: (row) => (
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
                header: "Result progress",
                cell: (row) => <RunPlanProgressBar statusCounts={statusCountsForRollup(row)} className="max-w-md" />
              }
            ]}
          />
        ) : (
          <p className="px-3 py-3 text-sm text-slate-500">No rollup data.</p>
        )}
      </section>
      {dialogs}
    </WorkbenchPage>
  );
}
