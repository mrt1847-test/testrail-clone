import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useAuth } from "../../auth/context/AuthContext";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import type { RunSummary } from "../types";
import { PrintLinkButton } from "../../print/components/PrintLinkButton";
import { buildRunPrintPath } from "../../print/api/printApi";
import { useRunsQuery } from "../hooks/useRunsApi";
import { ProjectContentHeader } from "../../projects/content-header/ProjectContentHeader";
import { contentHeaderActionClass, contentHeaderPrimaryClass } from "../../projects/content-header/contentHeaderStyles";
import { buildRunComparisonPath } from "../utils/runComparisonUrl";

const columnHelper = createColumnHelper<RunSummary>();

export function RunListPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [myRunsOnly, setMyRunsOnly] = useState(searchParams.get("mine") === "1");
  const { data = [], isLoading, isError, refetch } = useRunsQuery(projectId);
  const milestoneFilter = searchParams.get("milestoneId");
  const resultStatusFilter = searchParams.get("resultStatus");
  const hasMilestoneFilter = Boolean(milestoneFilter && milestoneFilter !== "all");
  const hasSegmentFilter =
    resultStatusFilter === "passed" || resultStatusFilter === "failed" || resultStatusFilter === "untested";
  const hasUrlFilters = hasMilestoneFilter || hasSegmentFilter;
  const activityDrilldownOnly = hasSegmentFilter && !hasMilestoneFilter;
  const filteredData = useMemo(() => {
    let rows = myRunsOnly && user ? data.filter((run) => run.assignedTo === user.id) : data;
    if (hasMilestoneFilter) {
      rows = rows.filter((run) => run.milestoneId === milestoneFilter);
    }
    if (resultStatusFilter === "failed") {
      rows = rows.filter((run) => run.failed > 0);
    } else if (resultStatusFilter === "passed") {
      rows = rows.filter((run) => run.progress === 100 && run.failed === 0);
    } else if (resultStatusFilter === "untested") {
      rows = rows.filter((run) => run.progress < 100);
    }
    return rows;
  }, [data, hasMilestoneFilter, milestoneFilter, myRunsOnly, resultStatusFilter, user]);

  const toggleMine = () => {
    const next = !myRunsOnly;
    setMyRunsOnly(next);
    const nextParams = new URLSearchParams(searchParams);
    if (next) nextParams.set("mine", "1");
    else nextParams.delete("mine");
    setSearchParams(nextParams, { replace: true });
  };

  const clearUrlFilters = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("milestoneId");
    nextParams.delete("resultStatus");
    setSearchParams(nextParams, { replace: true });
  };

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
      columnHelper.display({
        id: "print",
        header: "",
        cell: (info) => (
          <PrintLinkButton
            to={buildRunPrintPath(projectId, info.row.original.id)}
            label="Print"
            className="rounded border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          />
        )
      })
    ],
    [projectId],
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const runsHeader = (
    <ProjectContentHeader
      projectId={projectId}
      variant="runs"
      title="Test Runs & Results"
      subtitle="Open and completed runs with progress and drilldown into execution."
      secondaryActions={
        <>
          <button
            type="button"
            onClick={() => toggleMine()}
            className={
              myRunsOnly
                ? "rounded border border-slate-900 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white"
                : contentHeaderActionClass
            }
          >
            My runs
          </button>
          <button type="button" onClick={() => navigate(buildRunComparisonPath(projectId))} className={contentHeaderActionClass}>
            Compare runs
          </button>
          <button
            type="button"
            onClick={() => navigate(`/projects/${projectId}/runs/new`)}
            className={contentHeaderPrimaryClass}
          >
            + New run
          </button>
        </>
      }
    />
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {runsHeader}
        <LoadingState message="Loading runs…" />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="space-y-4">
        {runsHeader}
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  if (filteredData.length === 0) {
    return (
      <div className="space-y-4">
        {runsHeader}
        <EmptyState
        title={myRunsOnly ? "No runs assigned to you" : hasUrlFilters ? "No matching runs" : "No test runs yet"}
        description={
          myRunsOnly
            ? "Try disabling My Runs filter or assign runs to yourself."
            : hasUrlFilters
              ? "Try clearing the milestone filters."
              : "Create a run to start executing cases."
        }
        action={
          hasUrlFilters ? (
            <button
              type="button"
              onClick={() => clearUrlFilters()}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              Clear filters
            </button>
          ) : myRunsOnly ? (
            <button
              type="button"
              onClick={() => toggleMine()}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              Show all runs
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate(`/projects/${projectId}/runs/new`)}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              New run
            </button>
          )
        }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {runsHeader}

      {hasUrlFilters ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          <span>
            {activityDrilldownOnly
              ? `Showing runs with ${resultStatusFilter} coverage (from overview activity)`
              : `Showing runs for milestone ${milestoneFilter}${hasSegmentFilter ? ` with ${resultStatusFilter} coverage` : ""}`}
          </span>
          <button type="button" className="text-sm font-medium text-indigo-800 hover:underline" onClick={clearUrlFilters}>
            Clear filters
          </button>
        </div>
      ) : null}

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
