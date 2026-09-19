import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { Button, OverflowMenu, SaveFeedback, WorkbenchPage, WorkbenchPageHeader, WorkbenchToolbar } from "../../../shared/ui";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { fetchRuns } from "../../runs/api/runApi";
import { RunPlanProgressBar } from "../../runs/components/RunPlanProgressBar";
import { runKeys, useRunsOverviewQuery } from "../../runs/hooks/useRunsApi";
import { formatRunListWorkSummary } from "../../runs/utils/runListHubModel";
import {
  createPlanEntry,
  createRunByConfiguration,
  createRunFromPlanEntry,
  deletePlanEntry,
  fetchPlan,
  fetchPlanEntries,
  fetchPlanEntryConfigurations,
  fetchPlanMatrix,
  savePlanEntryConfigurations,
  updatePlan,
  updatePlanEntry,
  type PlanEntryRow
} from "../api/advancedApi";
import { fetchProjectMembers } from "../api/settingsApi";
import { useProjectArchived } from "../context/ProjectArchiveContext";
import { parseCaseIdList } from "../utils/planCaseSelection";
import {
  buildPlanExecutionEntries,
  describeGeneratePreview,
  expectedGeneratedRunCount
} from "../utils/planExecutionModel";
import { planDetailHeaderMenuGroups } from "../utils/planHeaderMenu";
import { planMatrixSavePayload, resolvePlanMatrixOwner } from "../utils/planMatrixContext";
import { PlanDefaultsDialog, type PlanDefaultsValues } from "./PlanDefaultsDialog";
import { PlanEntryDialog, type PlanEntryDialogValues } from "./PlanEntryDialog";

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
  const matrixOwner = resolvePlanMatrixOwner(entriesQuery.data ?? [], selectedEntryIds);
  const matrixEntryId = matrixOwner?.id ?? null;
  const runsQuery = useQuery({
    queryKey: runKeys.list(projectId),
    queryFn: () => fetchRuns(projectId),
    enabled: Boolean(projectId)
  });
  const overviewQuery = useRunsOverviewQuery(projectId);
  const matrixQuery = useQuery({
    queryKey: ["plan-matrix", projectId, planId, matrixEntryId ?? "_none"],
    queryFn: () => fetchPlanMatrix(projectId, planId, matrixEntryId ?? undefined),
    enabled: Boolean(projectId && planId && matrixEntryId)
  });
  const selectedEntryConfigurationQuery = useQuery({
    queryKey: ["plan-entry-configurations", projectId, planId, matrixEntryId ?? "_none"],
    queryFn: () => fetchPlanEntryConfigurations(projectId, planId, matrixEntryId ?? ""),
    enabled: Boolean(projectId && planId && matrixEntryId)
  });
  const entries = entriesQuery.data ?? [];
  const entryConfigurationQueries = useQueries({
    queries: entries.map((entry) => ({
      queryKey: ["plan-entry-configurations", projectId, planId, entry.id],
      queryFn: () => fetchPlanEntryConfigurations(projectId, planId, entry.id),
      enabled: Boolean(projectId && planId)
    }))
  });

  const members = membersQuery.data ?? [];
  const configurationsByEntryId = useMemo(() => {
    const map = new Map<string, (typeof entryConfigurationQueries)[number]["data"]>();
    entries.forEach((entry, index) => {
      map.set(entry.id, entryConfigurationQueries[index]?.data);
    });
    return map;
  }, [entries, entryConfigurationQueries]);
  const executionEntries = useMemo(
    () =>
      buildPlanExecutionEntries({
        projectId,
        entries,
        runs: runsQuery.data ?? [],
        overviewItems: overviewQuery.data?.open.items ?? [],
        configurationsByEntryId
      }),
    [configurationsByEntryId, entries, overviewQuery.data, projectId, runsQuery.data]
  );
  const generatedCount = executionEntries.filter((entry) => entry.run).length;
  const untestedOpen = executionEntries.filter(
    (entry) => entry.run && entry.run.status === "open" && (entry.run.untested > 0 || entry.run.totalTests === 0)
  ).length;

  const matrixSavePayload = planMatrixSavePayload(
    matrixEntryId,
    selectedEntryConfigurationQuery.data?.entryId ?? null,
    selectedConfigurationIds
  );
  const selectedEntry = matrixOwner ? entries.find((entry) => entry.id === matrixOwner.id) ?? null : null;
  const selectedExecution = matrixOwner
    ? executionEntries.find((entry) => entry.id === matrixOwner.id) ?? null
    : null;
  const previewConfigurationNames = useMemo(() => {
    if (!matrixQuery.data) return selectedExecution?.configurationNames ?? [];
    return matrixQuery.data.groups.flatMap((group) =>
      group.configurations.filter((cfg) => selectedConfigurationIds.includes(cfg.id)).map((cfg) => cfg.name)
    );
  }, [matrixQuery.data, selectedConfigurationIds, selectedExecution?.configurationNames]);

  const invalidatePlanHub = () => {
    void qc.invalidateQueries({ queryKey: ["plan", projectId, planId] });
    void qc.invalidateQueries({ queryKey: ["plans", projectId] });
    void qc.invalidateQueries({ queryKey: ["plan-entries", projectId, planId] });
    void qc.invalidateQueries({ queryKey: ["plan-entry-configurations", projectId, planId] });
    void qc.invalidateQueries({ queryKey: ["reports", projectId, "plan-summary"] });
    void qc.invalidateQueries({ queryKey: ["runs", projectId] });
    void qc.invalidateQueries({ queryKey: ["runs-overview", projectId] });
  };

  const createEntryMutation = useMutation({
    mutationFn: (input: { name: string; environment?: string }) => createPlanEntry(projectId, planId, input),
    onSuccess: () => {
      setEntryDialog(null);
      invalidatePlanHub();
    }
  });
  const createRunMutation = useMutation({
    mutationFn: async (entryId: string) => {
      if (matrixSavePayload && matrixSavePayload.entryId === entryId && matrixSavePayload.configurationIds.length > 0) {
        return createRunByConfiguration({ projectId, planId, ...matrixSavePayload });
      }
      return createRunFromPlanEntry(projectId, planId, entryId);
    },
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
    mutationFn: (input: { entryId: string; configurationIds: string[] }) =>
      savePlanEntryConfigurations({
        projectId,
        planId,
        entryId: input.entryId,
        configurationIds: input.configurationIds
      }),
    onSuccess: (_result, input) => {
      void qc.invalidateQueries({ queryKey: ["plan-entry-configurations", projectId, planId, input.entryId] });
      void qc.invalidateQueries({ queryKey: ["plan-matrix", projectId, planId] });
      invalidatePlanHub();
    }
  });
  const deleteEntryMutation = useMutation({
    mutationFn: (entryId: string) => deletePlanEntry(projectId, planId, entryId),
    onSuccess: (_result, entryId) => {
      setPendingDelete(null);
      setSelectedEntryIds((current) => current.filter((id) => id !== entryId));
      invalidatePlanHub();
    }
  });

  useEffect(() => {
    setSelectedConfigurationIds([]);
    saveConfigurationsMutation.reset();
    createRunMutation.reset();
  }, [matrixEntryId]);

  useEffect(() => {
    const mapping = selectedEntryConfigurationQuery.data;
    if (mapping && mapping.entryId === matrixEntryId) {
      setSelectedConfigurationIds(mapping.configurationIds);
    }
  }, [matrixEntryId, selectedEntryConfigurationQuery.data]);

  useEffect(() => {
    const rows = entriesQuery.data;
    if (!rows) return;
    const visible = new Set(rows.map((entry) => entry.id));
    setSelectedEntryIds((current) => {
      const next = current.filter((id) => visible.has(id));
      return next.length === current.length ? current : next;
    });
  }, [entriesQuery.data]);

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
    setSelectedEntryIds([entry.id]);
    setEntryDialog("edit");
  };

  const selectEntry = (entryId: string) => {
    setSelectedEntryIds((current) => (current.length === 1 && current[0] === entryId ? [] : [entryId]));
  };

  const entrySaving = createEntryMutation.isPending || updateEntryMutation.isPending;
  const entryFailed = createEntryMutation.isError || updateEntryMutation.isError;
  const entryError =
    (createEntryMutation.error instanceof Error ? createEntryMutation.error.message : undefined) ??
    (updateEntryMutation.error instanceof Error ? updateEntryMutation.error.message : undefined);

  const header = (
    <WorkbenchPageHeader
      title={planQuery.data?.name ?? "Test plan"}
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

  const toolbar =
    entries.length === 0 ? null : (
      <WorkbenchToolbar className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-slate-600">
          <span className="font-medium text-slate-900">{generatedCount}</span> generated runs
          <span className="text-slate-300"> · </span>
          <span className="font-medium text-slate-900">{untestedOpen}</span> still need work
          <span className="text-slate-300"> · </span>
          <span className="font-medium text-slate-900">{entries.length}</span> entries
        </p>
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
      {entries.length === 0 ? (
        <EmptyState title="No plan entries" description="Add an entry to compose this plan." />
      ) : (
        <section>
          <h2 className="border-b border-slate-200 py-1.5 text-sm font-semibold text-slate-900">Runs to execute</h2>
          <ul>
            {executionEntries.map((row) => {
              const selected = selectedEntryIds.length === 1 && selectedEntryIds[0] === row.id;
              const configLabel = row.configurationNames.length > 0 ? row.configurationNames.join(" · ") : "No configuration";
              return (
                <li
                  key={row.id}
                  data-plan-entry-id={row.id}
                  className={`border-b border-slate-200 py-2 last:border-b-0 ${selected ? "bg-sky-50/80" : ""}`}
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{configLabel}</p>
                      <p className="font-medium text-slate-900">{row.name}</p>
                      <p className="text-xs text-slate-500">{row.caseSummary}</p>
                      {row.run ? (
                        <>
                          <Link
                            to={row.run.href}
                            aria-label={`Open run ${row.run.name} (${configLabel})`}
                            className="mt-1 inline-block text-sm font-medium text-slate-900 underline-offset-2 hover:underline"
                          >
                            Open run · {row.run.name}
                          </Link>
                          <p className="text-xs text-slate-600">
                            {row.run.totalTests > 0
                              ? formatRunListWorkSummary({
                                  totalTests: row.run.totalTests,
                                  statusCounts: row.run.statusCounts
                                })
                              : row.run.status === "closed"
                                ? "Closed"
                                : "No tests yet"}
                            {row.run.status === "closed" && row.run.totalTests > 0 ? " · Closed" : ""}
                          </p>
                        </>
                      ) : (
                        <p className="mt-1 text-xs text-slate-500">Not generated yet</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {row.run ? (
                        <p className="text-sm font-semibold tabular-nums text-slate-900">{row.run.percentPassed}%</p>
                      ) : null}
                      <Button
                        variant={selected ? "secondary" : "ghost"}
                        size="sm"
                        aria-pressed={selected}
                        aria-label={`${selected ? "Configuring" : "Configure"} ${row.name}`}
                        onClick={() => selectEntry(row.id)}
                      >
                        {selected ? "Configuring" : "Configure"}
                      </Button>
                    </div>
                  </div>
                  {row.run ? <RunPlanProgressBar compact statusCounts={row.run.statusCounts} className="mt-1.5 max-w-xl" /> : null}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {matrixOwner && selectedEntry && selectedExecution ? (
        <section className="border-t border-slate-200 py-3" data-plan-matrix="" data-plan-matrix-owner={matrixOwner.id}>
          <h2 className="text-sm font-semibold text-slate-900">Configure {matrixOwner.name}</h2>
          <p className="mt-1 text-xs text-slate-600">
            {describeGeneratePreview({
              entryName: matrixOwner.name,
              configurationNames: previewConfigurationNames,
              hasRun: Boolean(selectedEntry.runId)
            })}{" "}
            Expected: {expectedGeneratedRunCount(Boolean(selectedEntry.runId))} run.
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
                  disabled={!matrixSavePayload || saveConfigurationsMutation.isPending}
                  loading={saveConfigurationsMutation.isPending}
                  onClick={() => {
                    createRunMutation.reset();
                    if (matrixSavePayload) void saveConfigurationsMutation.mutateAsync(matrixSavePayload);
                  }}
                >
                  Save configuration
                </Button>
                <Button
                  size="sm"
                  disabled={createRunMutation.isPending || isProjectArchived}
                  loading={createRunMutation.isPending}
                  onClick={() => {
                    saveConfigurationsMutation.reset();
                    void createRunMutation.mutateAsync(matrixOwner.id);
                  }}
                >
                  Generate run
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openEditEntry(selectedEntry)}>
                  Edit entry
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPendingDelete(selectedEntry)}>
                  Delete
                </Button>
                <SaveFeedback
                  status={
                    saveConfigurationsMutation.isPending
                      ? "saving"
                      : saveConfigurationsMutation.isError
                        ? "failed"
                        : saveConfigurationsMutation.isSuccess
                          ? "saved"
                          : createRunMutation.isPending
                            ? "saving"
                            : createRunMutation.isError
                              ? "failed"
                              : createRunMutation.isSuccess
                                ? "saved"
                                : "idle"
                  }
                  message={
                    saveConfigurationsMutation.isPending
                      ? `Saving ${matrixOwner.name}…`
                      : saveConfigurationsMutation.isError
                        ? `Could not save ${matrixOwner.name}`
                        : saveConfigurationsMutation.isSuccess
                          ? `Saved ${matrixOwner.name}`
                          : createRunMutation.isPending
                            ? `Generating run for ${matrixOwner.name}…`
                            : createRunMutation.isError
                              ? `Could not generate a run for ${matrixOwner.name}`
                              : createRunMutation.isSuccess
                                ? selectedExecution.run
                                  ? `Opened the existing run for ${matrixOwner.name}`
                                  : `Generated a run for ${matrixOwner.name}`
                                : undefined
                  }
                  onRetry={
                    saveConfigurationsMutation.isError && matrixSavePayload
                      ? () => void saveConfigurationsMutation.mutateAsync(matrixSavePayload)
                      : createRunMutation.isError
                        ? () => void createRunMutation.mutateAsync(matrixOwner.id)
                        : undefined
                  }
                />
              </div>
            </div>
          ) : matrixQuery.isError ? (
            <ErrorState
              title={`Could not load configurations for ${matrixOwner.name}`}
              onRetry={() => void matrixQuery.refetch()}
            />
          ) : (
            <LoadingState message={`Loading configurations for ${matrixOwner.name}...`} />
          )}
        </section>
      ) : null}
      {dialogs}
    </WorkbenchPage>
  );
}
