import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { Button, DataTable, WorkbenchPage, WorkbenchToolbar } from "../../../shared/ui";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import type { CompletedOverviewItem, RunPlanOverviewItem } from "../api/runsOverviewApi";
import { useRunsOverviewQuery } from "../hooks/useRunsApi";
import { ChooseSuiteForRunDialog } from "./ChooseSuiteForRunDialog";
import { RunListHeader } from "./RunListHeader";
import { RunPlanSummaryRow } from "./RunPlanSummaryRow";

function formatCompletedDate(isoDay: string) {
  return new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(
    new Date(`${isoDay}T12:00:00`)
  );
}

function matchesResultStatusFilter(item: RunPlanOverviewItem, filter: string | null) {
  if (!filter) return true;
  const failed = item.statusCounts.failed ?? 0;
  const untested = item.statusCounts.untested ?? 0;
  if (filter === "failed") return failed > 0;
  if (filter === "passed") return item.percentComplete === 100 && failed === 0;
  if (filter === "untested") return untested > 0 && item.percentComplete < 100;
  return true;
}

type CompletedRow = CompletedOverviewItem & { date: string };

export function RunListPage() {
  const { projectId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [myRunsOnly, setMyRunsOnly] = useState(searchParams.get("mine") === "1");
  const [orderBy, setOrderBy] = useState<"date" | "name">(
    searchParams.get("orderBy") === "name" ? "name" : "date"
  );
  const [suiteDialogOpen, setSuiteDialogOpen] = useState(false);
  const milestoneFilter = searchParams.get("milestoneId");
  const resultStatusFilter = searchParams.get("resultStatus");
  const highlightRunId = searchParams.get("highlightRunId");

  const overviewQuery = useRunsOverviewQuery(projectId, {
    mine: myRunsOnly,
    milestoneId: milestoneFilter,
    orderBy
  });

  const setHighlightRunId = useCallback(
    (runId: string) => {
      const next = new URLSearchParams(searchParams);
      next.set("highlightRunId", runId);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const hasMilestoneFilter = Boolean(milestoneFilter && milestoneFilter !== "all");
  const hasSegmentFilter =
    resultStatusFilter === "passed" || resultStatusFilter === "failed" || resultStatusFilter === "untested";
  const hasUrlFilters = hasMilestoneFilter || hasSegmentFilter;
  const activityDrilldownOnly = hasSegmentFilter && !hasMilestoneFilter;

  const filteredOpen = useMemo(() => {
    const items = overviewQuery.data?.open.items ?? [];
    if (!hasSegmentFilter) return items;
    return items.filter((item: RunPlanOverviewItem) => matchesResultStatusFilter(item, resultStatusFilter));
  }, [hasSegmentFilter, overviewQuery.data?.open.items, resultStatusFilter]);

  const completedRows = useMemo<CompletedRow[]>(
    () =>
      (overviewQuery.data?.completed.groups ?? []).flatMap((group: { date: string; items: CompletedOverviewItem[] }) =>
        group.items.map((item) => ({ ...item, date: group.date }))
      ),
    [overviewQuery.data?.completed.groups]
  );

  useEffect(() => {
    if (!highlightRunId || filteredOpen.length === 0) return;
    document
      .querySelector(`[data-run-row-id="${highlightRunId}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [filteredOpen.length, highlightRunId]);

  const toggleMine = () => {
    const next = !myRunsOnly;
    setMyRunsOnly(next);
    const nextParams = new URLSearchParams(searchParams);
    if (next) nextParams.set("mine", "1");
    else nextParams.delete("mine");
    setSearchParams(nextParams, { replace: true });
  };

  const clearUrlFilters = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("milestoneId");
    nextParams.delete("resultStatus");
    setSearchParams(nextParams, { replace: true });
  };

  const handleOrderByChange = (value: "date" | "name") => {
    setOrderBy(value);
    const nextParams = new URLSearchParams(searchParams);
    if (value === "date") nextParams.delete("orderBy");
    else nextParams.set("orderBy", value);
    setSearchParams(nextParams, { replace: true });
  };

  const openAddRun = () => setSuiteDialogOpen(true);
  const counts = overviewQuery.data?.counts ?? { open: 0, completed: 0 };
  const isEmpty = filteredOpen.length === 0 && completedRows.length === 0;

  const toolbar = (
    <WorkbenchToolbar className="flex flex-wrap items-center gap-2 border border-slate-300 bg-white px-3 py-2">
      <Button
        variant={myRunsOnly ? "primary" : "secondary"}
        size="sm"
        aria-pressed={myRunsOnly}
        onClick={toggleMine}
      >
        My runs
      </Button>
      <div className="flex items-center gap-1.5">
        <label htmlFor="run-list-order-by" className="text-xs font-medium text-slate-600">
          Order by
        </label>
        <select
          id="run-list-order-by"
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
          value={orderBy}
          onChange={(event) => handleOrderByChange(event.target.value as "date" | "name")}
        >
          <option value="date">Date</option>
          <option value="name">Name</option>
        </select>
      </div>
      {hasUrlFilters ? (
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 text-xs text-slate-600">
          <span>
            {activityDrilldownOnly
              ? `Showing items with ${resultStatusFilter} coverage`
              : `Showing items for milestone ${milestoneFilter}${hasSegmentFilter ? ` with ${resultStatusFilter} coverage` : ""}`}
          </span>
          <Button variant="secondary" size="sm" onClick={clearUrlFilters}>
            Clear filters
          </Button>
        </div>
      ) : null}
    </WorkbenchToolbar>
  );

  const dialog = (
    <ChooseSuiteForRunDialog
      projectId={projectId}
      open={suiteDialogOpen}
      onClose={() => setSuiteDialogOpen(false)}
    />
  );

  if (overviewQuery.isLoading) {
    return (
      <WorkbenchPage data-run-list-workbench="">
        <RunListHeader projectId={projectId} onAddRun={openAddRun} />
        {toolbar}
        <LoadingState message="Loading runs overview..." />
        {dialog}
      </WorkbenchPage>
    );
  }

  if (overviewQuery.isError) {
    return (
      <WorkbenchPage data-run-list-workbench="">
        <RunListHeader projectId={projectId} onAddRun={openAddRun} />
        {toolbar}
        <ErrorState onRetry={() => overviewQuery.refetch()} />
        {dialog}
      </WorkbenchPage>
    );
  }

  if (isEmpty) {
    const emptyAction = hasUrlFilters ? (
      <Button variant="secondary" onClick={clearUrlFilters}>
        Clear filters
      </Button>
    ) : myRunsOnly ? (
      <Button variant="secondary" onClick={toggleMine}>
        Show all runs
      </Button>
    ) : null;

    return (
      <WorkbenchPage data-run-list-workbench="">
        <RunListHeader projectId={projectId} onAddRun={openAddRun} />
        {toolbar}
        <EmptyState
          title={myRunsOnly ? "No runs assigned to you" : hasUrlFilters ? "No matching runs" : "No test runs yet"}
          description={
            myRunsOnly
              ? "Turn off My runs or assign runs to yourself."
              : hasUrlFilters
                ? "Clear the current filters to see other runs and plans."
                : "Use Add Run to start executing cases. Plans and reports stay in More actions."
          }
          action={emptyAction}
        />
        {dialog}
      </WorkbenchPage>
    );
  }

  return (
    <WorkbenchPage data-run-list-workbench="">
      <RunListHeader projectId={projectId} onAddRun={openAddRun} />
      {toolbar}
      <section className="overflow-hidden border border-slate-300 bg-white">
        <header className="border-b border-slate-200 px-3 py-2">
          <h2 className="text-sm font-semibold text-slate-900">Open</h2>
          <p className="text-xs text-slate-500">
            {filteredOpen.length} active {filteredOpen.length === 1 ? "run or plan" : "runs and plans"}
            <span className="text-slate-300"> · </span>
            {counts.completed} completed
          </p>
        </header>
        {filteredOpen.length === 0 ? (
          <p className="px-3 py-6 text-sm text-slate-500">No open runs or plans match the current filters.</p>
        ) : (
          <ul className="px-3">
            {filteredOpen.map((item: RunPlanOverviewItem) => (
              <RunPlanSummaryRow
                key={`${item.type}-${item.id}`}
                projectId={projectId}
                item={item}
                highlight={item.type === "run" && highlightRunId === item.id}
                listSearch={searchParams.toString()}
                onHighlight={() => {
                  if (item.type === "run") setHighlightRunId(item.id);
                }}
              />
            ))}
          </ul>
        )}
        <div className="border-t border-slate-200 px-3 py-2">
          <h2 className="text-sm font-semibold text-slate-900">Completed</h2>
          <p className="mb-2 text-xs text-slate-500">
            {counts.completed} completed {counts.completed === 1 ? "item" : "items"}
          </p>
          <DataTable
            dense
            className="rounded-none border-0"
            emptyMessage="No completed runs or plans yet."
            rowKey={(row) => `${row.type}-${row.id}`}
            rows={completedRows}
            columns={[
              {
                key: "date",
                header: "Closed",
                cell: (row) => formatCompletedDate(row.date)
              },
              {
                key: "type",
                header: "Type",
                cell: (row) => (row.type === "plan" ? "Plan" : "Run")
              },
              {
                key: "name",
                header: "Name",
                cell: (row) => (
                  <Link
                    to={`/projects/${projectId}/${row.viewPath}`}
                    className="font-medium text-slate-900 underline-offset-2 hover:underline"
                  >
                    {row.name}
                  </Link>
                )
              },
              {
                key: "passed",
                header: "Passed",
                align: "right",
                cell: (row) => `${row.percentPassed}%`
              }
            ]}
          />
        </div>
      </section>
      {dialog}
    </WorkbenchPage>
  );
}
