import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { fetchCustomFieldsForUse } from "../../projects/api/settingsApi";
import { fetchProjectResultExplorer } from "../api/runApi";

export function ResultExplorerPage() {
  const { projectId = "", runId } = useParams();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [query, setQuery] = useState("");
  const [caseId, setCaseId] = useState("");
  const [testId, setTestId] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [customFilters, setCustomFilters] = useState<Record<string, string>>({});
  const pageSize = 50;
  const customFilterKey = useMemo(() => JSON.stringify(customFilters), [customFilters]);
  const queryKey = useMemo(
    () => ["result-explorer", projectId, runId ?? "", page, pageSize, status, source, query, caseId, testId, createdFrom, createdTo, customFilterKey],
    [projectId, runId, page, pageSize, status, source, query, caseId, testId, createdFrom, createdTo, customFilterKey]
  );
  const customFieldsQuery = useQuery({
    queryKey: ["custom-fields", projectId, "result"],
    queryFn: () => fetchCustomFieldsForUse(projectId, "result"),
    enabled: Boolean(projectId),
    refetchInterval: false,
    refetchIntervalInBackground: false
  });
  const activeResultFields = (customFieldsQuery.data ?? []).filter((field) => field.isActive);
  const explorerQuery = useQuery({
    queryKey,
    queryFn: () =>
      fetchProjectResultExplorer({
        projectId,
        runId,
        caseId,
        testId,
        page,
        pageSize,
        status,
        source,
        createdFrom,
        createdTo,
        q: query,
        customFilters
      }),
    enabled: Boolean(projectId),
    refetchInterval: false,
    refetchIntervalInBackground: false
  });
  const rows = explorerQuery.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Result Explorer</h2>
        <p className="mt-2 text-sm text-slate-700">
          Scope: {runId ? `Run ${runId}` : "Project-wide"} / filters: status, source, case, run.
        </p>
      </div>
      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2 text-xs">
          <select
            className="rounded border border-slate-300 px-2 py-1"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All status</option>
            <option value="passed">passed</option>
            <option value="failed">failed</option>
            <option value="blocked">blocked</option>
            <option value="retest">retest</option>
            <option value="untested">untested</option>
          </select>
          <select
            className="rounded border border-slate-300 px-2 py-1"
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All source</option>
            <option value="manual">manual</option>
            <option value="automation">automation</option>
            <option value="api">api</option>
          </select>
          <input
            className="min-w-52 flex-1 rounded border border-slate-300 px-2 py-1"
            placeholder="Search case code/title"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
          <input
            className="w-24 rounded border border-slate-300 px-2 py-1"
            placeholder="caseId"
            value={caseId}
            onChange={(e) => {
              setCaseId(e.target.value);
              setPage(1);
            }}
          />
          <input
            className="w-24 rounded border border-slate-300 px-2 py-1"
            placeholder="testId"
            value={testId}
            onChange={(e) => {
              setTestId(e.target.value);
              setPage(1);
            }}
          />
          <input
            type="datetime-local"
            className="rounded border border-slate-300 px-2 py-1"
            value={createdFrom ? new Date(createdFrom).toISOString().slice(0, 16) : ""}
            onChange={(e) => {
              setCreatedFrom(e.target.value ? new Date(e.target.value).toISOString() : "");
              setPage(1);
            }}
          />
          <input
            type="datetime-local"
            className="rounded border border-slate-300 px-2 py-1"
            value={createdTo ? new Date(createdTo).toISOString().slice(0, 16) : ""}
            onChange={(e) => {
              setCreatedTo(e.target.value ? new Date(e.target.value).toISOString() : "");
              setPage(1);
            }}
          />
          {activeResultFields.map((field) =>
            field.fieldType === "select" ? (
              <select
                key={field.systemName}
                className="rounded border border-slate-300 px-2 py-1"
                value={customFilters[field.systemName] ?? ""}
                onChange={(e) => {
                  setCustomFilters((current) => ({ ...current, [field.systemName]: e.target.value }));
                  setPage(1);
                }}
              >
                <option value="">{field.name}</option>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : field.fieldType === "boolean" ? (
              <select
                key={field.systemName}
                className="rounded border border-slate-300 px-2 py-1"
                value={customFilters[field.systemName] ?? ""}
                onChange={(e) => {
                  setCustomFilters((current) => ({ ...current, [field.systemName]: e.target.value }));
                  setPage(1);
                }}
              >
                <option value="">{field.name}</option>
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            ) : (
              <input
                key={field.systemName}
                className="w-32 rounded border border-slate-300 px-2 py-1"
                placeholder={field.name}
                type={field.fieldType === "number" ? "number" : "text"}
                value={customFilters[field.systemName] ?? ""}
                onChange={(e) => {
                  setCustomFilters((current) => ({ ...current, [field.systemName]: e.target.value }));
                  setPage(1);
                }}
              />
            )
          )}
        </div>

        {explorerQuery.isLoading ? (
          <LoadingState message="Loading results..." />
        ) : explorerQuery.isError ? (
          <ErrorState title="Could not load result explorer" onRetry={() => void explorerQuery.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No results yet"
            description="Result rows will appear here when data matches the selected filters."
          />
        ) : (
          <div className="space-y-2">
            <div className="overflow-auto rounded border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Result</th>
                    <th className="px-3 py-2">Run</th>
                    <th className="px-3 py-2">Case</th>
                    <th className="px-3 py-2">Refs</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Custom values</th>
                    <th className="px-3 py-2">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const values = Object.entries(row.customValues ?? {}).filter(([, value]) => value !== null && value !== "");
                    return (
                      <tr key={row.id}>
                        <td className="px-3 py-2 font-mono text-xs">{row.id}</td>
                        <td className="px-3 py-2">
                          <Link to={`/projects/${projectId}/runs/${row.runId}`} className="underline">
                            {row.runName}
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          C{row.caseId} - {row.title}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600">{row.refs?.trim() ? row.refs : "-"}</td>
                        <td className="px-3 py-2">{row.status}</td>
                        <td className="px-3 py-2">{row.source}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">
                          {values.length > 0
                            ? values.map(([key, value]) => `${key}=${String(value)}`).join(", ")
                            : "-"}
                        </td>
                        <td className="px-3 py-2">{new Date(row.createdAt).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600">
              <p>
                page {explorerQuery.data?.page ?? page} / {explorerQuery.data?.totalPages ?? 1} - total{" "}
                {explorerQuery.data?.total ?? 0}
              </p>
              <div className="flex gap-2">
                <button
                  className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <button
                  className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
                  disabled={page >= (explorerQuery.data?.totalPages ?? 1)}
                  onClick={() => setPage((p) => Math.min(explorerQuery.data?.totalPages ?? 1, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
