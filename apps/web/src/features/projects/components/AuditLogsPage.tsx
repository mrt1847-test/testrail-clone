import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { fetchAuditLogFilterOptions, fetchAuditLogs, type AuditLogQuery } from "../api/advancedApi";

type AuditFilterForm = {
  q: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUserId: string;
  createdFrom: string;
  createdTo: string;
  pageSize: number;
};

const initialFilters: AuditFilterForm = {
  q: "",
  action: "",
  entityType: "",
  entityId: "",
  actorUserId: "",
  createdFrom: "",
  createdTo: "",
  pageSize: 25
};

function toStartIso(value: string) {
  return value ? `${value}T00:00:00.000Z` : undefined;
}

function toEndIso(value: string) {
  return value ? `${value}T23:59:59.999Z` : undefined;
}

function toQuery(form: AuditFilterForm, page: number): AuditLogQuery {
  return {
    page,
    pageSize: form.pageSize,
    q: form.q,
    action: form.action,
    entityType: form.entityType,
    entityId: form.entityId,
    actorUserId: form.actorUserId,
    createdFrom: toStartIso(form.createdFrom),
    createdTo: toEndIso(form.createdTo)
  };
}

export function AuditLogsPage() {
  const { projectId = "" } = useParams();
  const [form, setForm] = useState<AuditFilterForm>(initialFilters);
  const [applied, setApplied] = useState<AuditFilterForm>(initialFilters);
  const [page, setPage] = useState(1);
  const query = useMemo(() => toQuery(applied, page), [applied, page]);

  const optionsQuery = useQuery({
    queryKey: ["audit-log-filter-options", projectId],
    queryFn: () => fetchAuditLogFilterOptions(projectId),
    enabled: Boolean(projectId)
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["audit-logs", projectId, query],
    queryFn: () => fetchAuditLogs(projectId, query),
    enabled: Boolean(projectId)
  });

  if (isLoading) return <LoadingState message="Loading audit logs..." />;
  if (isError) return <ErrorState title="Could not load audit logs" onRetry={() => refetch()} />;

  const rows = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Audit Logs</h1>
        <p className="text-sm text-slate-600">Query auditable project events by actor, entity, action, and date.</p>
      </div>

      <form
        className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-6"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setApplied(form);
        }}
      >
        <label className="md:col-span-2">
          <span className="text-xs font-medium uppercase text-slate-500">Search</span>
          <input
            value={form.q}
            onChange={(event) => setForm((current) => ({ ...current, q: event.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="action, entity type, or entity id"
          />
        </label>
        <label>
          <span className="text-xs font-medium uppercase text-slate-500">Action</span>
          <input
            list="audit-actions"
            value={form.action}
            onChange={(event) => setForm((current) => ({ ...current, action: event.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <datalist id="audit-actions">
            {(optionsQuery.data?.actions ?? []).map((action) => (
              <option key={action} value={action} />
            ))}
          </datalist>
        </label>
        <label>
          <span className="text-xs font-medium uppercase text-slate-500">Entity type</span>
          <input
            list="audit-entity-types"
            value={form.entityType}
            onChange={(event) => setForm((current) => ({ ...current, entityType: event.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <datalist id="audit-entity-types">
            {(optionsQuery.data?.entityTypes ?? []).map((entityType) => (
              <option key={entityType} value={entityType} />
            ))}
          </datalist>
        </label>
        <label>
          <span className="text-xs font-medium uppercase text-slate-500">Entity ID</span>
          <input
            value={form.entityId}
            onChange={(event) => setForm((current) => ({ ...current, entityId: event.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="text-xs font-medium uppercase text-slate-500">Actor ID</span>
          <input
            value={form.actorUserId}
            onChange={(event) => setForm((current) => ({ ...current, actorUserId: event.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="text-xs font-medium uppercase text-slate-500">From</span>
          <input
            type="date"
            value={form.createdFrom}
            onChange={(event) => setForm((current) => ({ ...current, createdFrom: event.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="text-xs font-medium uppercase text-slate-500">To</span>
          <input
            type="date"
            value={form.createdTo}
            onChange={(event) => setForm((current) => ({ ...current, createdTo: event.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="text-xs font-medium uppercase text-slate-500">Page size</span>
          <select
            value={form.pageSize}
            onChange={(event) => setForm((current) => ({ ...current, pageSize: Number(event.target.value) }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
        <div className="flex items-end justify-end gap-2 md:col-span-3">
          <button
            type="button"
            onClick={() => {
              setForm(initialFilters);
              setApplied(initialFilters);
              setPage(1);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Reset
          </button>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Apply
          </button>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No audit logs" description="No project events matched the current query." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 text-sm text-slate-600">
            <span>
              {data?.total ?? 0} events · page {data?.page ?? 1} of {data?.totalPages ?? 1}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= (data?.totalPages ?? 1)}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
          <ul className="divide-y divide-slate-200 text-sm text-slate-800">
            {rows.map((row) => (
              <li key={row.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{row.action}</p>
                    <p className="text-xs text-slate-600">
                      {row.entityType}:{row.entityId}
                      {row.actorUserId ? ` | actor=${row.actorUserId}` : ""}
                      {" | "}
                      {new Date(row.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                {row.changes ? (
                  <pre className="mt-2 max-h-44 overflow-auto rounded bg-slate-50 p-2 text-[11px] text-slate-700">
                    {JSON.stringify(row.changes, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
