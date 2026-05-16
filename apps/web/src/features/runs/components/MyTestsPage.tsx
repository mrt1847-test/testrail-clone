import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { FilterBar, type FilterField } from "../../../shared/ui/FilterBar";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { StatusBadge } from "../../../shared/ui/StatusBadge";
import { useAssignedToMeQuery } from "../hooks/useRunsApi";

const statusOptions = ["all", "untested", "failed", "blocked", "retest", "passed"] as const;
const activeStatuses = new Set(["untested", "failed", "blocked", "retest"]);

export function MyTestsPage() {
  const { projectId = "" } = useParams();
  const { data = [], isLoading, isError, refetch } = useAssignedToMeQuery(projectId);
  const [statusFilter, setStatusFilter] = useState<(typeof statusOptions)[number]>("all");
  const [runFilter, setRunFilter] = useState("all");
  const [search, setSearch] = useState("");

  const runOptions = useMemo(
    () =>
      Array.from(new Map(data.map((row) => [row.runId, row.runName])).entries()).sort((a, b) =>
        a[1].localeCompare(b[1])
      ),
    [data]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: data.length };
    for (const status of statusOptions) counts[status] = status === "all" ? data.length : 0;
    for (const row of data) counts[row.status] = (counts[row.status] ?? 0) + 1;
    return counts;
  }, [data]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (runFilter !== "all" && row.runId !== runFilter) return false;
      if (!q) return true;
      return `${row.title} ${row.caseId} ${row.runName}`.toLowerCase().includes(q);
    });
  }, [data, runFilter, search, statusFilter]);

  const activeCount = data.filter((row) => activeStatuses.has(row.status)).length;

  const filterFields: FilterField[] = [
    {
      kind: "search",
      id: "search",
      label: "Search",
      value: search,
      onChange: setSearch,
      placeholder: "Search cases or runs"
    },
    {
      kind: "select",
      id: "status",
      label: "Status",
      value: statusFilter,
      onChange: (value) => setStatusFilter(value as (typeof statusOptions)[number]),
      options: statusOptions.map((status) => ({
        value: status,
        label: status === "all" ? `All (${statusCounts[status] ?? 0})` : `${status} (${statusCounts[status] ?? 0})`
      }))
    },
    {
      kind: "select",
      id: "run",
      label: "Run",
      value: runFilter,
      onChange: setRunFilter,
      options: [
        { value: "all", label: "All runs" },
        ...runOptions.map(([runId, runName]) => ({ value: runId, label: runName }))
      ]
    }
  ];

  if (isLoading) return <LoadingState message="Loading assigned tests..." />;
  if (isError) return <ErrorState title="Could not load assigned tests" onRetry={() => refetch()} />;
  if (data.length === 0) {
    return <EmptyState title="No assigned tests" description="Tests assigned to you will appear here." />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="My Tests"
        title="Assigned to me"
        description={`${activeCount} active of ${data.length} assigned tests.`}
      />

      <FilterBar fields={filterFields} ariaLabel="Filter assigned tests" variant="card" />

      {filteredRows.length === 0 ? (
        <EmptyState title="No matching tests" description="Adjust the filters to widen the list." />
      ) : (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Case</th>
                <th className="px-4 py-3">Run</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row) => (
                <tr key={row.testId} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">C{row.caseId}</p>
                    <p className="mt-0.5 text-slate-600">{row.title}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.runName}</td>
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
