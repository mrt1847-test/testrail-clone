import { Link, useParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { AutomationCoverageCard } from "./AutomationCoverageCard";
import { ProjectSummaryCards } from "./ProjectSummaryCards";
import { RecentFailureTable } from "./RecentFailureTable";
import { RecentResultList } from "./RecentResultList";
import { RecentRunList } from "./RecentRunList";
import { useProjectOverviewQuery } from "../hooks/useProjectsApi";

export function ProjectOverviewPage() {
  const { projectId = "" } = useParams();
  const { data, isLoading, isError, refetch } = useProjectOverviewQuery(projectId);

  if (isLoading) return <LoadingState message="Loading overview…" />;
  if (isError || !data)
    return <ErrorState title="Could not load overview" onRetry={() => refetch()} />;

  return (
    <div className="space-y-8">
      <ProjectSummaryCards stats={data.stats} />

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Recent runs</h2>
            <Link to={`/projects/${projectId}/runs`} className="text-sm font-medium text-slate-700 hover:underline">
              View all
            </Link>
          </div>
          <RecentRunList projectId={projectId} runs={data.recentRuns} />
        </div>
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Automation</h2>
          <AutomationCoverageCard pct={data.stats.automationCoveragePct} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Recent failures</h2>
          <RecentFailureTable rows={data.recentFailures} />
        </div>
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Recent results</h2>
          <RecentResultList rows={data.recentResults} />
        </div>
      </section>
    </div>
  );
}
