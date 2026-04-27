import { useState } from "react";
import { useParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import type { TestInstanceRow } from "../types";
import { useRunDetailQuery } from "../hooks/useRunsApi";

export function RunDetailPage() {
  const { projectId = "", runId = "" } = useParams();
  const { data, isLoading, isError, refetch } = useRunDetailQuery(projectId, runId);
  const [selected, setSelected] = useState<TestInstanceRow | null>(null);

  if (isLoading) return <LoadingState message="Loading run…" />;
  if (isError || !data) return <ErrorState title="Run not found" onRetry={() => refetch()} />;

  const { run, instances, counts } = data;

  return (
    <div className="space-y-4">
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium uppercase text-slate-500">Run</p>
        <h2 className="text-xl font-semibold text-slate-900">{run.name}</h2>
        <p className="text-sm text-slate-600">
          {run.status} {run.environment ? `· ${run.environment}` : ""}
        </p>
      </header>

      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm">
        <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-900">Passed {counts.passed}</span>
        <span className="rounded-md bg-red-50 px-2 py-1 text-red-900">Failed {counts.failed}</span>
        <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-900">Blocked {counts.blocked}</span>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-800">Retest {counts.retest}</span>
        <span className="rounded-md bg-slate-50 px-2 py-1 text-slate-700">Untested {counts.untested}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-medium uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2">Case</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {instances.map((row) => (
                <tr
                  key={row.id}
                  className={selected?.id === row.id ? "bg-slate-100" : "cursor-pointer hover:bg-slate-50"}
                  onClick={() => setSelected(row)}
                >
                  <td className="px-3 py-2 font-mono text-xs">{row.caseCode}</td>
                  <td className="px-3 py-2">{row.title}</td>
                  <td className="px-3 py-2">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Result entry</h3>
          {selected ? (
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-mono text-xs">{selected.caseCode}</span> — {selected.title}
              </p>
              <p className="text-xs text-slate-500">
                MVP placeholder: status, comment, defects, and step results wire to{" "}
                <code className="rounded bg-slate-100 px-1">POST /runs/:runId/results</code>.
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Select a test instance to enter results.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
