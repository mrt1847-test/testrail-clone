import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { workbenchDensity as density } from "../../../shared/ui/density/uiDensity";
import { ProjectContentHeader } from "../../projects/content-header/ProjectContentHeader";
import { contentHeaderActionClass } from "../../projects/content-header/contentHeaderStyles";
import type { CompletedOverviewItem, RunPlanOverviewItem } from "../api/runsOverviewApi";
import { useRunsOverviewQuery } from "../hooks/useRunsApi";
import { ChooseSuiteForRunDialog } from "./ChooseSuiteForRunDialog";
import { RunPlanSummaryRow } from "./RunPlanSummaryRow";
import { RunsOverviewSidebar } from "./RunsOverviewSidebar";

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

  const counts = overviewQuery.data?.counts ?? { open: 0, completed: 0 };
  const completedGroups = overviewQuery.data?.completed.groups ?? [];

  const runsHeader = (
    <ProjectContentHeader
      projectId={projectId}
      variant="runs"
      title="Test Runs & Results"
      subtitle="Open and completed runs and plans with progress bars and drilldown into execution."
      secondaryActions={
        <button
          type="button"
          onClick={() => toggleMine()}
          className={
            myRunsOnly
              ? "rounded border border-slate-900 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white"
              : contentHeaderActionClass
          }
        >
          My runs
        </button>
      }
    />
  );

  if (overviewQuery.isLoading) {
    return (
      <div className={density.mainStack}>
        {runsHeader}
        <LoadingState message="Loading runs overview..." />
      </div>
    );
  }

  if (overviewQuery.isError) {
    return (
      <div className={density.mainStack}>
        {runsHeader}
        <ErrorState onRetry={() => overviewQuery.refetch()} />
      </div>
    );
  }

  const isEmpty = filteredOpen.length === 0 && completedGroups.length === 0;

  if (isEmpty) {
    return (
      <div className={density.mainStack}>
        {runsHeader}
        <EmptyState
          title={myRunsOnly ? "No runs assigned to you" : hasUrlFilters ? "No matching runs" : "No test runs yet"}
          description={
            myRunsOnly
              ? "Try disabling My Runs filter or assign runs to yourself."
              : hasUrlFilters
                ? "Try clearing the milestone filters."
                : "Create a run or plan to start executing cases."
          }
          action={
            hasUrlFilters ? (
              <button
                type="button"
                onClick={() => clearUrlFilters()}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              >
                Clear filters
              </button>
            ) : myRunsOnly ? (
              <button
                type="button"
                onClick={() => toggleMine()}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              >
                Show all runs
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSuiteDialogOpen(true)}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                New run
              </button>
            )
          }
        />
        <ChooseSuiteForRunDialog
          projectId={projectId}
          open={suiteDialogOpen}
          onClose={() => setSuiteDialogOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className={density.mainStack}>
      {runsHeader}

      {hasUrlFilters ? (
        <div className={`${density.toolbar} justify-between text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300`}>
          <span>
            {activityDrilldownOnly
              ? `Showing items with ${resultStatusFilter} coverage (from overview activity)`
              : `Showing items for milestone ${milestoneFilter}${hasSegmentFilter ? ` with ${resultStatusFilter} coverage` : ""}`}
          </span>
          <button type="button" className="text-sm font-medium text-indigo-800 hover:underline" onClick={clearUrlFilters}>
            Clear filters
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-3">
          <section className={`${density.panel} dark:border-slate-700 dark:bg-slate-900`}>
            <header className={`${density.panelHeader} dark:border-slate-700`}>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Open</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {filteredOpen.length} active {filteredOpen.length === 1 ? "run or plan" : "runs and plans"}
              </p>
            </header>
            {filteredOpen.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">No open runs or plans match the current filters.</p>
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
          </section>

          <section className={`${density.panel} dark:border-slate-700 dark:bg-slate-900`}>
            <header className={`${density.panelHeader} dark:border-slate-700`}>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Completed</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {counts.completed} completed {counts.completed === 1 ? "item" : "items"}
              </p>
            </header>
            {completedGroups.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">No completed runs or plans yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {completedGroups.map((group: { date: string; items: CompletedOverviewItem[] }) => (
                  <div key={group.date} className="px-4 py-3">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {formatCompletedDate(group.date)}
                    </h3>
                    <table className="mt-2 w-full text-left text-sm">
                      <tbody>
                        {group.items.map((item: CompletedOverviewItem) => (
                          <tr key={`${item.type}-${item.id}`} className="border-t border-slate-100 first:border-t-0">
                            <td className="py-2 pr-3">
                              <span
                                className={`mr-2 inline-flex h-6 w-6 items-center justify-center rounded text-xs font-semibold ${
                                  item.type === "plan"
                                    ? "bg-indigo-100 text-indigo-800"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {item.type === "plan" ? "P" : "R"}
                              </span>
                              <Link
                                to={`/projects/${projectId}/${item.viewPath}`}
                                className="font-medium text-slate-900 hover:underline dark:text-slate-100"
                              >
                                {item.name}
                              </Link>
                            </td>
                            <td className="py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">
                              {item.percentPassed}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <RunsOverviewSidebar
          projectId={projectId}
          openCount={counts.open}
          completedCount={counts.completed}
          orderBy={orderBy}
          onOrderByChange={handleOrderByChange}
          onAddRun={() => setSuiteDialogOpen(true)}
        />
      </div>

      <ChooseSuiteForRunDialog
        projectId={projectId}
        open={suiteDialogOpen}
        onClose={() => setSuiteDialogOpen(false)}
      />
    </div>
  );
}
