import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { WorkbenchPage, WorkbenchPageHeader } from "../../../shared/ui";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import type { ActivityEventRow } from "../api/settingsApi";
import { fetchProjectActivity } from "../api/advancedApi";
import { fetchMilestoneSummary } from "../api/milestoneSummaryApi";
import { fetchPlans } from "../api/planningApi";
import { fetchProjectActivitySeries } from "../api/projectApi";
import { reportKeys } from "../hooks/reportKeys";
import { useProjectOverviewQuery } from "../hooks/useProjectsApi";
import { useRunsOverviewQuery } from "../../runs/hooks/useRunsApi";
import { ProjectActivityFeedPanel } from "./ProjectActivityFeedPanel";
import { ProjectActivityLineChart } from "./ProjectActivityLineChart";
import {
  buildOverviewWorkRows,
  formatOverviewExecution,
  openMilestones,
  overviewAttentionItems
} from "../utils/projectOverviewModel";

const MAX_RECENT_RUNS = 5;
const HISTORY_PAGE_SIZE = 12;

export function ProjectOverviewPage() {
  const { projectId = "" } = useParams();
  const [activityDays, setActivityDays] = useState(30);
  const [feedTab, setFeedTab] = useState<"history" | "changes">("history");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyRows, setHistoryRows] = useState<ActivityEventRow[]>([]);
  const { data, isLoading, isError, refetch } = useProjectOverviewQuery(projectId);
  const overviewQuery = useRunsOverviewQuery(projectId);
  const milestoneSummaryQuery = useQuery({
    queryKey: reportKeys.milestoneSummary(projectId),
    queryFn: () => fetchMilestoneSummary(projectId),
    enabled: Boolean(projectId)
  });
  const plansQuery = useQuery({
    queryKey: ["plans", projectId, "overview"],
    queryFn: () => fetchPlans(projectId),
    enabled: Boolean(projectId)
  });
  const activitySeriesQuery = useQuery({
    queryKey: ["project-activity-series", projectId, activityDays],
    queryFn: () => fetchProjectActivitySeries(projectId, activityDays),
    enabled: Boolean(projectId)
  });
  const historyActivityQuery = useQuery({
    queryKey: ["project-activity", projectId, "overview", "history", historyPage],
    queryFn: () => fetchProjectActivity(projectId, historyPage, HISTORY_PAGE_SIZE, { feed: "history" }),
    enabled: Boolean(projectId)
  });

  const recentRuns = useMemo(() => data?.recentRuns.slice(0, MAX_RECENT_RUNS) ?? [], [data?.recentRuns]);
  const workRows = useMemo(
    () =>
      buildOverviewWorkRows({
        projectId,
        recentRuns,
        plans: plansQuery.data ?? [],
        overviewItems: overviewQuery.data?.open.items ?? []
      }),
    [overviewQuery.data, plansQuery.data, projectId, recentRuns]
  );
  const milestones = openMilestones(milestoneSummaryQuery.data);
  const attention = data
    ? overviewAttentionItems({
        projectId,
        recentFailures: data.recentFailures,
        recentResults: data.recentResults
      })
    : [];

  useEffect(() => {
    setHistoryPage(1);
    setHistoryRows([]);
  }, [projectId]);

  useEffect(() => {
    const pageRows = historyActivityQuery.data?.data;
    if (!pageRows) return;
    setHistoryRows((current) => (historyPage === 1 ? pageRows : [...current, ...pageRows]));
  }, [historyActivityQuery.data, historyPage]);

  const historyHasMore =
    historyActivityQuery.data != null && historyPage < (historyActivityQuery.data.totalPages ?? 1);

  if (isLoading) return <LoadingState message="Loading overview..." />;
  if (isError || !data) return <ErrorState title="Could not load overview" onRetry={() => refetch()} />;

  return (
    <WorkbenchPage>
      <WorkbenchPageHeader title="Overview" />
      <p className="text-sm text-slate-700">{formatOverviewExecution(data.execution)}</p>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link to={`/projects/${projectId}/cases`} className="text-slate-900 hover:underline">
          Cases
        </Link>
        <Link to={`/projects/${projectId}/runs`} className="text-slate-900 hover:underline">
          Runs
        </Link>
        <Link to={`/projects/${projectId}/my-tests`} className="text-slate-900 hover:underline">
          Assigned
        </Link>
        <Link to={`/projects/${projectId}/milestones`} className="text-slate-900 hover:underline">
          Milestones
        </Link>
      </p>

      <ProjectActivityLineChart
        projectId={projectId}
        days={activityDays}
        points={activitySeriesQuery.data?.points ?? []}
        onDaysChange={setActivityDays}
      />

      <section>
        <div className="flex items-baseline justify-between gap-3 border-b border-slate-200 py-1.5">
          <h2 className="text-sm font-semibold text-slate-900">Active work</h2>
          <Link to={`/projects/${projectId}/runs`} className="text-xs text-slate-600 hover:underline">
            View all
          </Link>
        </div>
        {workRows.length === 0 ? (
          <p className="py-3 text-sm text-slate-500">No active runs or plans.</p>
        ) : (
          <ul>
            {workRows.map((row) => (
              <li key={row.id} className="border-b border-slate-200 py-2 last:border-b-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{row.kind}</p>
                <Link to={row.href} className="font-medium text-slate-900 hover:underline">
                  {row.name}
                </Link>
                <p className="text-xs text-slate-600">{row.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-3 border-b border-slate-200 py-1.5">
          <h2 className="text-sm font-semibold text-slate-900">Milestones</h2>
          <Link to={`/projects/${projectId}/milestones`} className="text-xs text-slate-600 hover:underline">
            View all
          </Link>
        </div>
        {milestones.length === 0 ? (
          <p className="py-3 text-sm text-slate-500">No open milestones.</p>
        ) : (
          <ul>
            {milestones.map((row) => (
              <li key={row.milestoneId} className="border-b border-slate-200 py-2 last:border-b-0">
                <Link
                  to={`/projects/${projectId}/milestones/${row.milestoneId}`}
                  className="font-medium text-slate-900 hover:underline"
                >
                  {row.name}
                </Link>
                <p className="text-xs text-slate-600">
                  {row.openRunCount} active runs · {row.progress}% passed
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {attention.length > 0 ? (
        <section>
          <h2 className="border-b border-slate-200 py-1.5 text-sm font-semibold text-slate-900">Needs attention</h2>
          <ul>
            {attention.map((item) => (
              <li key={item.id} className="border-b border-slate-200 py-2 last:border-b-0">
                <Link to={item.href} className="font-medium text-slate-900 hover:underline">
                  {item.label}
                </Link>
                <p className="text-xs text-slate-600">{item.meta}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ProjectActivityFeedPanel
        projectId={projectId}
        tab={feedTab}
        onTabChange={setFeedTab}
        historyRows={historyRows}
        changeRows={data.recentResults}
        historyHasMore={historyHasMore}
        historyLoading={historyActivityQuery.isFetching}
        onLoadMoreHistory={() => setHistoryPage((page) => page + 1)}
      />
    </WorkbenchPage>
  );
}
