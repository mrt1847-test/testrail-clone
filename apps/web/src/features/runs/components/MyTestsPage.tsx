import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import {
  Button,
  DataTable,
  FormField,
  OverflowMenu,
  SelectionActionBar,
  WorkbenchPage,
  WorkbenchPageHeader,
  WorkbenchToolbar,
  buttonClassName
} from "../../../shared/ui";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { FilterBar } from "../../../shared/ui/FilterBar";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { StatusBadge } from "../../../shared/ui/StatusBadge";
import { fetchMilestones } from "../../projects/api/planningApi";
import { defaultAssignmentListFilters, formatRunDueOn } from "../assignmentListFilters";
import { useAssignedToMeQuery } from "../hooks/useRunsApi";
import { AssignmentAgingBadge } from "./AssignmentAgingBadge";
import { AssignmentWorkloadSummary } from "./AssignmentWorkloadSummary";
import { buildAssignmentWorkloadFilterFields } from "./AssignmentWorkloadFilters";
import { myTestsHeaderMenuGroups } from "../utils/myTestsHeaderMenu";
import { flattenMyTestsQueue, myTestsResultPath } from "../utils/myTestsQueue";

const activeStatuses = new Set(["untested", "failed", "blocked", "retest"]);
const compactHide = "hidden sm:table-cell";
const desktopOnly = "hidden md:table-cell";

export function MyTestsPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const [filters, setFilters] = useState(defaultAssignmentListFilters);
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);

  const milestonesQuery = useQuery({
    queryKey: ["milestones", projectId, "assignment-list"],
    queryFn: () => fetchMilestones(projectId),
    enabled: Boolean(projectId)
  });

  const assignedQuery = useAssignedToMeQuery(projectId, filters);
  const data = assignedQuery.data ?? [];
  const queuedRows = useMemo(() => flattenMyTestsQueue(data), [data]);
  const hasAging = data.some((row) => row.agingLevel !== "none");

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

  const selectedRows = queuedRows.filter((row) => selectedTestIds.includes(row.testId));
  const selectedCount = selectedRows.length;
  const resultTarget = selectedRows[0] ?? null;
  const allSelected = queuedRows.length > 0 && selectedCount === queuedRows.length;

  function toggleSelected(testId: string, checked: boolean) {
    setSelectedTestIds((current) =>
      checked ? Array.from(new Set([...current, testId])) : current.filter((id) => id !== testId)
    );
  }

  function togglePageSelection(checked: boolean) {
    setSelectedTestIds(checked ? queuedRows.map((row) => row.testId) : []);
  }

  const header = (
    <WorkbenchPageHeader
      title="My Tests"
      description={`${activeCount} active of ${data.length} assigned tests. Record results in the run workbench.`}
      utilityAction={<OverflowMenu groups={myTestsHeaderMenuGroups(projectId)} />}
    />
  );

  const toolbar = (
    <WorkbenchToolbar className="border border-slate-300 bg-white">
      <FilterBar fields={filterFields} ariaLabel="Filter assigned tests" variant="toolbar" />
      {filters.dueFilter === "due_by" ? (
        <div className="border-t border-slate-200 px-3 py-2">
          <FormField label="Due on or before" className="max-w-xs">
            {(control) => (
              <input
                {...control}
                type="date"
                value={filters.dueBy}
                onChange={(event) => setFilters((current) => ({ ...current, dueBy: event.target.value }))}
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
              />
            )}
          </FormField>
        </div>
      ) : null}
      {hasAging ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-1.5">
          <AssignmentWorkloadSummary levels={data.map((row) => row.agingLevel)} />
        </div>
      ) : null}
    </WorkbenchToolbar>
  );

  const selectionBar = (
    <SelectionActionBar selectedCount={selectedCount} aria-label="Selected test actions">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="mr-1 whitespace-nowrap text-sm text-sky-950">{selectedCount} selected</strong>
        <Button
          size="sm"
          disabled={!resultTarget}
          onClick={() => {
            if (!resultTarget) return;
            navigate(myTestsResultPath(projectId, resultTarget));
          }}
        >
          Add result
        </Button>
        {selectedCount > 1 ? (
          <span className="text-xs text-sky-900">Opens the first selected test in Run Execution.</span>
        ) : null}
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={() => setSelectedTestIds([])}>
            Clear selection
          </Button>
        </div>
      </div>
    </SelectionActionBar>
  );

  if (assignedQuery.isLoading || milestonesQuery.isLoading) {
    return (
      <WorkbenchPage data-my-tests-workbench="">
        {header}
        <LoadingState message="Loading assigned tests..." />
      </WorkbenchPage>
    );
  }
  if (assignedQuery.isError) {
    return (
      <WorkbenchPage data-my-tests-workbench="">
        {header}
        <ErrorState title="Could not load assigned tests" onRetry={() => void assignedQuery.refetch()} />
      </WorkbenchPage>
    );
  }

  return (
    <WorkbenchPage data-my-tests-workbench="">
      {header}
      {toolbar}
      {selectionBar}
      {queuedRows.length === 0 ? (
        <EmptyState
          title="No matching tests"
          description="Adjust filters or wait for new assignments on runs with due dates or milestones."
        />
      ) : (
        <section className="overflow-hidden border border-slate-300 bg-white">
          <DataTable
            dense
            className="rounded-none border-0"
            rowKey={(row) => row.testId}
            rows={queuedRows}
            columns={[
              {
                key: "select",
                header: (
                  <input
                    type="checkbox"
                    aria-label="Select all assigned tests"
                    checked={allSelected}
                    ref={(element) => {
                      if (element) element.indeterminate = selectedCount > 0 && !allSelected;
                    }}
                    onChange={(event) => togglePageSelection(event.target.checked)}
                  />
                ),
                cell: (row) => (
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.title}`}
                    checked={selectedTestIds.includes(row.testId)}
                    onChange={(event) => toggleSelected(row.testId, event.target.checked)}
                  />
                )
              },
              {
                key: "queue",
                header: "Queue",
                headerClassName: compactHide,
                cellClassName: compactHide,
                cell: (row) => row.queueLabel
              },
              {
                key: "case",
                header: "Case",
                cell: (row) => (
                  <div>
                    <Link
                      to={myTestsResultPath(projectId, row)}
                      className="font-medium text-slate-900 underline-offset-2 hover:underline"
                    >
                      C{row.caseId}
                    </Link>
                    <p className="text-slate-600">{row.title}</p>
                  </div>
                )
              },
              {
                key: "run",
                header: "Run",
                headerClassName: compactHide,
                cellClassName: compactHide,
                cell: (row) => (
                  <Link
                    to={myTestsResultPath(projectId, row)}
                    className="text-slate-700 underline-offset-2 hover:underline"
                  >
                    {row.runName}
                  </Link>
                )
              },
              {
                key: "milestone",
                header: "Milestone",
                headerClassName: desktopOnly,
                cellClassName: desktopOnly,
                cell: (row) => row.milestoneName ?? "—"
              },
              {
                key: "due",
                header: "Due",
                headerClassName: desktopOnly,
                cellClassName: desktopOnly,
                cell: (row) => formatRunDueOn(row.runDueOn)
              },
              {
                key: "aging",
                header: "Aging",
                headerClassName: desktopOnly,
                cellClassName: desktopOnly,
                cell: (row) => <AssignmentAgingBadge level={row.agingLevel} />
              },
              {
                key: "status",
                header: "Status",
                cell: (row) => <StatusBadge status={row.status} />
              },
              {
                key: "action",
                header: "Action",
                align: "right",
                headerClassName: "whitespace-nowrap",
                cellClassName: "whitespace-nowrap",
                cell: (row) => (
                  <Link className={buttonClassName({ size: "sm" })} to={myTestsResultPath(projectId, row)}>
                    Add result
                  </Link>
                )
              }
            ]}
          />
        </section>
      )}
    </WorkbenchPage>
  );
}
