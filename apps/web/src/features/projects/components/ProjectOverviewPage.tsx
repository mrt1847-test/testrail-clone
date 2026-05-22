import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { workbenchDensity as density } from "../../../shared/ui/density/uiDensity";
import type { ActivityEventRow } from "../api/settingsApi";
import { fetchProjectActivity } from "../api/advancedApi";
import { fetchMilestoneSummary } from "../api/milestoneSummaryApi";
import { fetchPlans } from "../api/planningApi";
import { fetchProjectActivitySeries } from "../api/projectApi";
import { reportKeys } from "../hooks/reportKeys";
import { useProjectOverviewQuery } from "../hooks/useProjectsApi";
import { ProjectActivityFeedPanel } from "./ProjectActivityFeedPanel";
import { ProjectActivityLineChart } from "./ProjectActivityLineChart";
import { ProjectContentHeader } from "../content-header/ProjectContentHeader";
import { ProjectOverviewColumns } from "./ProjectOverviewColumns";
import { ProjectOverviewSidebar } from "./ProjectOverviewSidebar";
import { ProjectSummaryCards } from "./ProjectSummaryCards";

const MAX_RECENT_RUNS = 5;
const HISTORY_PAGE_SIZE = 12;

export function ProjectOverviewPage() {
  const { projectId = "" } = useParams();
  const [activityDays, setActivityDays] = useState(60);
  const [feedTab, setFeedTab] = useState<"history" | "changes">("history");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyRows, setHistoryRows] = useState<ActivityEventRow[]>([]);
  const { data, isLoading, isError, refetch } = useProjectOverviewQuery(projectId);
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
    <div className={`grid ${density.pageGap} lg:grid-cols-[minmax(0,1fr)_20rem]`}>
      <main className={density.mainStack}>
        <ProjectContentHeader
          projectId={projectId}
          variant="overview"
          title="Overview"
          subtitle="Project activity, milestones, and recent execution."
        />

        <ProjectActivityLineChart
          projectId={projectId}
          days={activityDays}
          points={activitySeriesQuery.data?.points ?? []}
          onDaysChange={setActivityDays}
        />

        <section className={`${density.panel} ${density.panelBody}`}>
          <ProjectSummaryCards projectId={projectId} stats={data.stats} />
        </section>

        <ProjectOverviewColumns
          projectId={projectId}
          milestones={milestoneSummaryQuery.data}
          recentRuns={recentRuns}
          plans={plansQuery.data ?? []}
        />

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
      </main>

      <ProjectOverviewSidebar
        projectId={projectId}
        stats={data.stats}
        recentFailures={data.recentFailures}
      />
    </div>
  );
}
