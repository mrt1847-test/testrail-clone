import { Fragment, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { fetchMilestones } from "../../projects/api/planningApi";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { FilterBar } from "../../../shared/ui/FilterBar";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { StatusBadge } from "../../../shared/ui/StatusBadge";
import { workbenchDensity as density } from "../../../shared/ui/density/uiDensity";
import type { AssignedTestRow } from "../api/runApi";
import { defaultAssignmentListFilters, formatRunDueOn } from "../assignmentListFilters";
import { useAssignedToMeQuery } from "../hooks/useRunsApi";
import { AssignmentAgingBadge, assignmentRowAgingClass } from "./AssignmentAgingBadge";
import { AssignmentWorkloadSummary } from "./AssignmentWorkloadSummary";
import { buildAssignmentWorkloadFilterFields } from "./AssignmentWorkloadFilters";

const activeStatuses = new Set(["untested", "failed", "blocked", "retest"]);
const attentionStatuses = new Set(["failed", "blocked", "retest"]);

type QueueGroup = {
  id: string;
  label: string;
  description: string;
  rows: AssignedTestRow[];
};

function runTestPath(projectId: string, row: AssignedTestRow) {
  return `/projects/${projectId}/runs/${row.runId}?testId=${encodeURIComponent(row.testId)}`;
}

function buildQueueGroups(rows: AssignedTestRow[]): QueueGroup[] {
  const assigned = new Set<string>();
  const take = (predicate: (row: AssignedTestRow) => boolean) => {
    const groupRows = rows.filter((row) => !assigned.has(row.testId) && predicate(row));
    for (const row of groupRows) assigned.add(row.testId);
    return groupRows;
  };

  return [
    {
      id: "overdue",
      label: "Overdue",
      description: "Runs past due date.",
      rows: take((row) => row.agingLevel === "overdue")
    },
    {
      id: "due-soon",
      label: "Due soon",
      description: "Runs due in the next few days.",
      rows: take((row) => row.agingLevel === "due_soon")
    },
    {
      id: "attention",
      label: "Failed, blocked, or retest",
      description: "Work that likely needs follow-up before completion.",
      rows: take((row) => attentionStatuses.has(row.status))
    },
    {
      id: "untested",
      label: "Untested",
      description: "Ready for first execution.",
      rows: take((row) => row.status === "untested")
    },
    {
      id: "other",
      label: "Other assignments",
      description: "Completed or lower-priority assigned work.",
      rows: take(() => true)
    }
  ].filter((group) => group.rows.length > 0);
}

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
  const queueGroups = useMemo(() => buildQueueGroups(data), [data]);
  const queueSummary = useMemo(
    () => ({
      overdue: data.filter((row) => row.agingLevel === "overdue").length,
      dueSoon: data.filter((row) => row.agingLevel === "due_soon").length,
      attention: data.filter((row) => attentionStatuses.has(row.status)).length,
      untested: data.filter((row) => row.status === "untested").length
    }),
    [data]
  );

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
    <div className={density.mainStack}>
      <PageHeader
        eyebrow="My Tests"
        title="Assigned to me"
        description={`${activeCount} active of ${data.length} assigned tests.`}
      />

      <AssignmentWorkloadSummary levels={data.map((row) => row.agingLevel)} />

      <div className="grid gap-2 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => setFilters((current) => ({ ...current, dueFilter: "overdue", status: "all" }))}
          className="rounded border border-rose-200 bg-rose-50 px-3 py-1.5 text-left text-xs text-rose-900 hover:bg-rose-100"
        >
          <span className="block text-lg font-semibold tabular-nums">{queueSummary.overdue}</span>
          Overdue
        </button>
        <button
          type="button"
          onClick={() => {
            const dueBy = new Date();
            dueBy.setDate(dueBy.getDate() + 3);
            setFilters((current) => ({
              ...current,
              dueFilter: "due_by",
              dueBy: dueBy.toISOString().slice(0, 10),
              status: "all"
            }));
          }}
          className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-left text-xs text-amber-900 hover:bg-amber-100"
        >
          <span className="block text-lg font-semibold tabular-nums">{queueSummary.dueSoon}</span>
          Due soon
        </button>
        <button
          type="button"
          onClick={() => setFilters((current) => ({ ...current, status: "failed", dueFilter: "all" }))}
          className="rounded border border-slate-200 bg-white px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
        >
          <span className="block text-lg font-semibold tabular-nums text-slate-900">{queueSummary.attention}</span>
          Failed / blocked / retest
        </button>
        <button
          type="button"
          onClick={() => setFilters((current) => ({ ...current, status: "untested", dueFilter: "all" }))}
          className="rounded border border-sky-200 bg-sky-50 px-3 py-1.5 text-left text-xs text-sky-900 hover:bg-sky-100"
        >
          <span className="block text-lg font-semibold tabular-nums">{queueSummary.untested}</span>
          Untested
        </button>
      </div>

      <div className={`overflow-hidden ${density.panel}`}>
        <FilterBar fields={filterFields} ariaLabel="Filter assigned tests" variant="toolbar" />
      </div>
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
        <div className={`overflow-hidden ${density.panel}`}>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className={density.tableHeaderCell}>Case</th>
                <th className={density.tableHeaderCell}>Run</th>
                <th className={density.tableHeaderCell}>Milestone</th>
                <th className={density.tableHeaderCell}>Due</th>
                <th className={density.tableHeaderCell}>Aging</th>
                <th className={density.tableHeaderCell}>Status</th>
                <th className={`${density.tableHeaderCell} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {queueGroups.map((group) => (
                <Fragment key={group.id}>
                  <tr className="bg-slate-100/70">
                    <td colSpan={7} className={density.tableHeaderCell}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                          {group.label}
                        </span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                          {group.rows.length}
                        </span>
                        <span className="text-xs text-slate-500">{group.description}</span>
                      </div>
                    </td>
                  </tr>
                  {group.rows.map((row) => (
                    <tr
                      key={row.testId}
                      className={`hover:bg-slate-50 ${assignmentRowAgingClass(row.agingLevel)}`.trim()}
                    >
                      <td className={density.tableCell}>
                        <Link to={runTestPath(projectId, row)} className="font-medium text-slate-900 hover:underline">
                          C{row.caseId}
                        </Link>
                        <p className="mt-0.5 text-slate-600">{row.title}</p>
                      </td>
                      <td className={`${density.tableCell} text-slate-700`}>
                        <Link to={runTestPath(projectId, row)} className="hover:underline">
                          {row.runName}
                        </Link>
                      </td>
                      <td className={`${density.tableCell} text-slate-700`}>{row.milestoneName ?? "-"}</td>
                      <td className={`${density.tableCell} text-slate-700`}>{formatRunDueOn(row.runDueOn)}</td>
                      <td className={density.tableCell}>
                        <AssignmentAgingBadge level={row.agingLevel} />
                      </td>
                      <td className={density.tableCell}>
                        <StatusBadge status={row.status} />
                      </td>
                      <td className={`${density.tableCell} text-right`}>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Link
                            to={runTestPath(projectId, row)}
                            className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
                          >
                            Add result
                          </Link>
                          <Link
                            to={`/projects/${projectId}/runs/${row.runId}`}
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Run
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
