import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import type { RunSummary } from "../types";
import { useRunsQuery } from "../hooks/useRunsApi";

const columnHelper = createColumnHelper<RunSummary>();

export function RunListPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const { data = [], isLoading, isError, refetch } = useRunsQuery(projectId);

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Run",
        cell: (info) => (
          <Link
            to={`/projects/${projectId}/runs/${info.row.original.id}`}
            className="font-medium text-slate-900 hover:underline"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor("status", { header: "Status" }),
      columnHelper.accessor("progress", {
        header: "Progress",
        cell: (info) => `${info.getValue()}%`,
      }),
      columnHelper.accessor("failed", { header: "Failed" }),
      columnHelper.accessor("createdAt", { header: "Created" }),
    ],
    [projectId],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) return <LoadingState message="Loading runs…" />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  if (data.length === 0) {
    return (
      <EmptyState
        title="No test runs yet"
        description="Create a run to start executing cases."
        action={
          <button
            type="button"
            onClick={() => navigate(`/projects/${projectId}/runs/new`)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            New run
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Test runs</h2>
        <button
          type="button"
          onClick={() => navigate(`/projects/${projectId}/runs/new`)}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          + New run
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-medium uppercase text-slate-600">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="px-3 py-2">
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/80">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
