import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { fetchMilestones } from "../../projects/api/planningApi";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { FilterBar } from "../../../shared/ui/FilterBar";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { StatusBadge } from "../../../shared/ui/StatusBadge";
import { defaultAssignmentListFilters, formatRunDueOn } from "../assignmentListFilters";
import { useAssignedToMeQuery } from "../hooks/useRunsApi";
import { AssignmentAgingBadge, assignmentRowAgingClass } from "./AssignmentAgingBadge";
import { AssignmentWorkloadSummary } from "./AssignmentWorkloadSummary";
import { buildAssignmentWorkloadFilterFields } from "./AssignmentWorkloadFilters";

const activeStatuses = new Set(["untested", "failed", "blocked", "retest"]);

export function MyTestsPage() {
  const { projectId = "" } = useParams();
  const [filters, setFilters] = useState(defaultAssignmentListFilters);

  const milestonesQuery = useQuery({
    queryKey: ["milestones", projectId, "assignment-list"],
    queryFn: () => fetchMilestones(projectId),
    enabled: Boolean(projectId)
  });

  const assignedQuery = useAssignedToMeQuery(projectId, filters);
  const data = assignedQuery.data ?? [];

  const runOptions = useMemo(
    () =>
      Array.from(new Map(data.map((row) => [row.runId, row.runName])).entries()).sort((a, b) =>
        a[1].localeCompare(b[1])
      ),
    [data]
  );

  const activeCount = data.filter((row) => activeStatuses.has(row.status)).length;

  const filterFields = buildAssignmentWorkloadFilterFields({
    filters,
    onChange: (patch) => setFilters((current) => ({ ...current, ...patch })),
    runOptions,
    milestones: milestonesQuery.data ?? []
  });

  if (assignedQuery.isLoading || milestonesQuery.isLoading) {
    return <LoadingState message="Loading assigned tests..." />;
  }
  if (assignedQuery.isError) {
    return <ErrorState title="Could not load assigned tests" onRetry={() => void assignedQuery.refetch()} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="My Tests"
        title="Assigned to me"
        description={`${activeCount} active of ${data.length} assigned tests.`}
      />

      <AssignmentWorkloadSummary levels={data.map((row) => row.agingLevel)} />

      <FilterBar fields={filterFields} ariaLabel="Filter assigned tests" variant="card" />
      {filters.dueFilter === "due_by" ? (
        <label className="flex w-full max-w-xs flex-col gap-0.5 text-xs font-medium text-slate-600">
          Due on or before
          <input
            type="date"
            value={filters.dueBy}
            onChange={(e) => setFilters((current) => ({ ...current, dueBy: e.target.value }))}
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal text-slate-900"
          />
        </label>
      ) : null}

      {data.length === 0 ? (
        <EmptyState
          title="No matching tests"
          description="Adjust filters or wait for new assignments on runs with due dates or milestones."
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Case</th>
                <th className="px-4 py-3">Run</th>
                <th className="px-4 py-3">Milestone</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Aging</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((row) => (
                <tr key={row.testId} className={`hover:bg-slate-50 ${assignmentRowAgingClass(row.agingLevel)}`.trim()}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">C{row.caseId}</p>
                    <p className="mt-0.5 text-slate-600">{row.title}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.runName}</td>
                  <td className="px-4 py-3 text-slate-700">{row.milestoneName ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{formatRunDueOn(row.runDueOn)}</td>
                  <td className="px-4 py-3">
                    <AssignmentAgingBadge level={row.agingLevel} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/projects/${projectId}/runs/${row.runId}?testId=${encodeURIComponent(row.testId)}`}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
