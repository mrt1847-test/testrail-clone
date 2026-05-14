import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
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

  if (isLoading) return <LoadingState message="Loading assigned tests..." />;
  if (isError) return <ErrorState title="Could not load assigned tests" onRetry={() => refetch()} />;
  if (data.length === 0) {
    return <EmptyState title="No assigned tests" description="Tests assigned to you will appear here." />;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Assigned to me</h1>
            <p className="mt-1 text-sm text-slate-500">
              {activeCount} active of {data.length} assigned tests.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={
                  statusFilter === status
                    ? "rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                    : "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                }
              >
                {status === "all" ? "All" : status} {statusCounts[status] ?? 0}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_220px]">
          <input
            aria-label="Search assigned tests"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search cases or runs"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          />
          <select
            aria-label="Filter assigned tests by run"
            value={runFilter}
            onChange={(event) => setRunFilter(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="all">All runs</option>
            {runOptions.map(([runId, runName]) => (
              <option key={runId} value={runId}>
                {runName}
              </option>
            ))}
          </select>
        </div>
      </div>

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
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                      {row.status}
                    </span>
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
