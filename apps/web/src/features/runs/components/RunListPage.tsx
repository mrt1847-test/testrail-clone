import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { Button, WorkbenchPage, WorkbenchToolbar } from "../../../shared/ui";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import type { CompletedOverviewItem, RunPlanOverviewItem } from "../api/runsOverviewApi";
import { useRunsOverviewQuery } from "../hooks/useRunsApi";
import {
  describeRunListFilters,
  filterRunListOpenItems,
  formatRunListKind,
  parseRunListScope,
  readStoredRunListSearch,
  writeStoredRunListSearch,
  type RunListScope
} from "../utils/runListHubModel";
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const restoredSearchRef = useRef(false);
  const [suiteDialogOpen, setSuiteDialogOpen] = useState(false);
  const myRunsOnly = searchParams.get("mine") === "1";
  const orderBy = searchParams.get("orderBy") === "name" ? "name" : "date";
  const milestoneFilter = searchParams.get("milestoneId");
  const resultStatusFilter = searchParams.get("resultStatus");
  const highlightRunId = searchParams.get("highlightRunId");
  const scope = parseRunListScope(searchParams.get("scope"));
  const completedOpen = searchParams.get("completed") === "1";

  const overviewQuery = useRunsOverviewQuery(projectId, {
    mine: myRunsOnly,
    milestoneId: milestoneFilter,
    orderBy
  });

  const patchSearch = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams);
      mutate(next);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const setHighlightRunId = useCallback(
    (runId: string) => {
      patchSearch((next) => next.set("highlightRunId", runId));
    },
    [patchSearch]
  );

  const hasMilestoneFilter = Boolean(milestoneFilter && milestoneFilter !== "all");
  const hasSegmentFilter =
    resultStatusFilter === "passed" || resultStatusFilter === "failed" || resultStatusFilter === "untested";
  const hasUrlFilters = hasMilestoneFilter || hasSegmentFilter;

  useEffect(() => {
    if (!restoredSearchRef.current) {
      restoredSearchRef.current = true;
      if (!searchParams.toString()) {
        const stored = readStoredRunListSearch(projectId);
        if (stored) {
          setSearchParams(new URLSearchParams(stored), { replace: true });
          return;
        }
      }
    }
    writeStoredRunListSearch(projectId, searchParams.toString());
  }, [projectId, searchParams, setSearchParams]);

  const filteredOpen = useMemo(() => {
    const items = filterRunListOpenItems(overviewQuery.data?.open.items ?? [], scope);
    if (!hasSegmentFilter) return items;
    return items.filter((item) => matchesResultStatusFilter(item, resultStatusFilter));
  }, [hasSegmentFilter, overviewQuery.data?.open.items, resultStatusFilter, scope]);

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
    patchSearch((params) => {
      if (myRunsOnly) params.delete("mine");
      else params.set("mine", "1");
    });
  };

  const setScope = (nextScope: RunListScope) => {
    patchSearch((params) => {
      if (nextScope === "all") params.delete("scope");
      else params.set("scope", nextScope);
    });
  };

  const toggleCompleted = () => {
    patchSearch((params) => {
      if (completedOpen) params.delete("completed");
      else params.set("completed", "1");
    });
  };

  const clearUrlFilters = () => {
    patchSearch((params) => {
      params.delete("milestoneId");
      params.delete("resultStatus");
    });
  };

  const handleOrderByChange = (value: "date" | "name") => {
    patchSearch((params) => {
      if (value === "date") params.delete("orderBy");
      else params.set("orderBy", value);
    });
  };

  const openAddRun = () => setSuiteDialogOpen(true);
  const openAddPlan = () => navigate(`/projects/${projectId}/plans?new=1`);
  const counts = overviewQuery.data?.counts ?? { open: 0, completed: 0 };
  const isEmpty = filteredOpen.length === 0 && completedRows.length === 0;
  const activeFilterLabels = describeRunListFilters({
    scope,
    mine: myRunsOnly,
    milestoneId: milestoneFilter,
    resultStatus: resultStatusFilter
  });

  const toolbar = (
    <WorkbenchToolbar className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1" role="group" aria-label="Show runs or plans">
        {([
          ["all", "All"],
          ["runs", "Runs"],
          ["plans", "Plans"]
        ] as const).map(([value, label]) => (
          <Button
            key={value}
            variant={scope === value ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={scope === value}
            onClick={() => setScope(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      <Button variant={myRunsOnly ? "secondary" : "ghost"} size="sm" aria-pressed={myRunsOnly} onClick={toggleMine}>
        Assigned to me
      </Button>
      <label htmlFor="run-list-order-by" className="ml-auto text-xs font-medium text-slate-600">
        Order
        <select
          id="run-list-order-by"
          className="ml-1.5 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
          value={orderBy}
          onChange={(event) => handleOrderByChange(event.target.value as "date" | "name")}
        >
          <option value="date">Date</option>
          <option value="name">Name</option>
        </select>
      </label>
      {activeFilterLabels.length > 0 ? (
        <p className="w-full text-xs text-slate-600" data-run-list-active-filters="">
          {activeFilterLabels.join(" · ")}
          {hasUrlFilters ? (
            <Button variant="ghost" size="sm" className="ml-2" onClick={clearUrlFilters}>
              Clear filters
            </Button>
          ) : null}
        </p>
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

  const header = (
    <RunListHeader projectId={projectId} onAddRun={openAddRun} onAddPlan={openAddPlan} />
  );

  if (overviewQuery.isLoading) {
    return (
      <WorkbenchPage data-run-list-workbench="">
        {header}
        {toolbar}
        <LoadingState message="Loading runs overview..." />
        {dialog}
      </WorkbenchPage>
    );
  }

  if (overviewQuery.isError) {
    return (
      <WorkbenchPage data-run-list-workbench="">
        {header}
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
        Show all work
      </Button>
    ) : scope !== "all" ? (
      <Button variant="secondary" onClick={() => setScope("all")}>
        Show all work
      </Button>
    ) : null;

    return (
      <WorkbenchPage data-run-list-workbench="">
        {header}
        {toolbar}
        <EmptyState
          title={myRunsOnly ? "No work assigned to you" : hasUrlFilters || scope !== "all" ? "No matching work" : "No test runs yet"}
          description={
            myRunsOnly
              ? "Turn off Assigned to me or assign runs to yourself."
              : hasUrlFilters || scope !== "all"
                ? "Clear the current filters to see other runs and plans."
                : "Use Add Run to start executing cases. Add Plan is next to it."
          }
          action={emptyAction}
        />
        {dialog}
      </WorkbenchPage>
    );
  }

  return (
    <WorkbenchPage data-run-list-workbench="">
      {header}
      {toolbar}
      <section>
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 py-1.5">
          <h2 className="text-sm font-semibold text-slate-900">Active</h2>
          <p className="text-xs text-slate-500">
            {filteredOpen.length} {filteredOpen.length === 1 ? "item" : "items"}
            <span className="text-slate-300"> · </span>
            {counts.completed} completed
          </p>
        </header>
        {filteredOpen.length === 0 ? (
          <p className="py-6 text-sm text-slate-500">No active runs or plans match the current filters.</p>
        ) : (
          <ul>
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
        <div className="border-t border-slate-200 py-2">
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={completedOpen}
            onClick={toggleCompleted}
          >
            Completed ({counts.completed})
          </Button>
          {completedOpen ? (
            completedRows.length === 0 ? (
              <p className="py-4 text-sm text-slate-500">No completed runs or plans yet.</p>
            ) : (
              <ul>
                {completedRows.map((row) => (
                  <li
                    key={`${row.type}-${row.id}`}
                    className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-slate-200 py-2 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                        {formatRunListKind(row.type)}
                      </p>
                      <Link
                        to={`/projects/${projectId}/${row.viewPath}`}
                        className="font-medium text-slate-900 underline-offset-2 hover:underline"
                      >
                        {row.name}
                      </Link>
                      <p className="text-xs text-slate-500">{formatCompletedDate(row.date)}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{row.percentPassed}%</p>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>
      </section>
      {dialog}
    </WorkbenchPage>
  );
}
