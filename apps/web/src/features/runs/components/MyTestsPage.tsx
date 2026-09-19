import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
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
import {
  appendAssignmentListQueryParams,
  assignmentFiltersAreDefault,
  countActiveAssignmentFilters,
  defaultAssignmentListFilters,
  describeActiveAssignmentFilters,
  formatRunDueOn,
  parseAssignmentListFilters,
  type AssignmentListFilterState
} from "../assignmentListFilters";
import { useAssignedToMeQuery } from "../hooks/useRunsApi";
import { AssignmentAgingBadge } from "./AssignmentAgingBadge";
import { buildAssignmentWorkloadFilterFields } from "./AssignmentWorkloadFilters";
import { myTestsHeaderMenuGroups } from "../utils/myTestsHeaderMenu";
import {
  MY_TESTS_ASSIGNMENT_TITLE,
  flattenMyTestsQueue,
  formatMyTestsDueContext,
  formatMyTestsMatchCount,
  formatMyTestsRunContext,
  myTestsFiltersStorageKey,
  myTestsResultPath,
  setMyTestsSelection,
  visibleMyTestsSelection
} from "../utils/myTestsQueue";

const compactHide = "hidden sm:table-cell";

function readStoredFilters(projectId: string): AssignmentListFilterState | null {
  try {
    const raw = sessionStorage.getItem(myTestsFiltersStorageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AssignmentListFilterState;
    return { ...defaultAssignmentListFilters, ...parsed };
  } catch {
    return null;
  }
}

function persistFilters(projectId: string, filters: AssignmentListFilterState) {
  try {
    if (assignmentFiltersAreDefault(filters)) {
      sessionStorage.removeItem(myTestsFiltersStorageKey(projectId));
      return;
    }
    sessionStorage.setItem(myTestsFiltersStorageKey(projectId), JSON.stringify(filters));
  } catch {
    /* ignore quota / private mode */
  }
}

function initialMyTestsFilters(projectId: string, search: URLSearchParams) {
  const fromUrl = parseAssignmentListFilters(search);
  if (!assignmentFiltersAreDefault(fromUrl)) return fromUrl;
  return readStoredFilters(projectId) ?? defaultAssignmentListFilters;
}

export function MyTestsPage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<AssignmentListFilterState>(() =>
    initialMyTestsFilters(projectId, searchParams)
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);

  const milestonesQuery = useQuery({
    queryKey: ["milestones", projectId, "assignment-list"],
    queryFn: () => fetchMilestones(projectId),
    enabled: Boolean(projectId)
  });

  const assignedCatalogQuery = useAssignedToMeQuery(projectId, defaultAssignmentListFilters);
  const assignedQuery = useAssignedToMeQuery(projectId, filters);
  const assignedRows = assignedCatalogQuery.data ?? [];
  const data = assignedQuery.data ?? [];
  const queuedRows = useMemo(() => flattenMyTestsQueue(data), [data]);

  const runOptions = useMemo(
    () =>
      Array.from(new Map(assignedRows.map((row) => [row.runId, row.runName])).entries()).sort((a, b) =>
        a[1].localeCompare(b[1])
      ),
    [assignedRows]
  );

  const activeFilterCount = countActiveAssignmentFilters(filters);
  const activeFilterLabels = describeActiveAssignmentFilters(filters, {
    runName: runOptions.find(([id]) => id === filters.runId)?.[1],
    milestoneName: (milestonesQuery.data ?? []).find((row) => String(row.id) === filters.milestoneId)?.name
  });
  const matchCount = formatMyTestsMatchCount(queuedRows.length, assignedRows.length);
  const hasDue = queuedRows.some((row) => Boolean(row.runDueOn));

  const filterFields = buildAssignmentWorkloadFilterFields({
    filters,
    onChange: (patch) => setFilters((current) => ({ ...current, ...patch })),
    runOptions,
    milestones: milestonesQuery.data ?? [],
    includeSearch: false
  });

  const visibleTestIds = useMemo(() => queuedRows.map((row) => row.testId), [queuedRows]);
  const visibleSelectedId = visibleMyTestsSelection(selectedTestId, visibleTestIds);
  const resultTarget = queuedRows.find((row) => row.testId === visibleSelectedId) ?? null;
  const selectedCount = resultTarget ? 1 : 0;

  useEffect(() => {
    if (selectedTestId !== visibleSelectedId) setSelectedTestId(visibleSelectedId);
  }, [selectedTestId, visibleSelectedId]);

  useEffect(() => {
    persistFilters(projectId, filters);
    const next = new URLSearchParams();
    appendAssignmentListQueryParams(next, filters);
    if (searchParams.toString() !== next.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [filters, projectId, searchParams, setSearchParams]);

  function toggleSelected(testId: string, checked: boolean) {
    setSelectedTestId((current) => setMyTestsSelection(current, testId, checked));
  }

  function clearFilters() {
    setFilters(defaultAssignmentListFilters);
  }

  const header = (
    <WorkbenchPageHeader
      title={MY_TESTS_ASSIGNMENT_TITLE}
      utilityAction={<OverflowMenu groups={myTestsHeaderMenuGroups(projectId)} />}
    />
  );

  const toolbar = (
    <WorkbenchToolbar>
      <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
        <label className="min-w-[10rem] flex-1 sm:max-w-md">
          <span className="sr-only">Search assigned tests</span>
          <input
            type="search"
            aria-label="Search assigned tests"
            placeholder="Search cases or runs"
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
          />
        </label>
        <Button
          variant={filtersOpen || activeFilterCount > 0 ? "secondary" : "ghost"}
          size="sm"
          aria-expanded={filtersOpen}
          aria-controls="myTestsFilters"
          aria-label={activeFilterCount > 0 ? `Filter, ${activeFilterCount} active` : "Filter assigned tests"}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </Button>
        <p className="text-xs text-slate-500" data-my-tests-match-count="">
          {matchCount}
        </p>
        {activeFilterCount > 0 ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>
      {activeFilterLabels.length > 0 ? (
        <p className="w-full text-xs text-slate-600" data-my-tests-active-filters="">
          {activeFilterLabels.join(" · ")}
        </p>
      ) : null}
      {filtersOpen ? (
        <div id="myTestsFilters" className="w-full">
          <FilterBar fields={filterFields} ariaLabel="Filter assigned tests" variant="toolbar" />
          {filters.dueFilter === "due_by" ? (
            <FormField label="Due on or before" className="max-w-xs px-0 py-2">
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
          ) : null}
        </div>
      ) : null}
    </WorkbenchToolbar>
  );

  const selectionBar = (
    <SelectionActionBar selectedCount={selectedCount} aria-label="Selected test actions">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="mr-1 text-sm text-sky-950">
          {resultTarget
            ? `C${resultTarget.caseId} · ${formatMyTestsRunContext(resultTarget)}`
            : "1 selected"}
        </strong>
        <Button
          size="sm"
          disabled={!resultTarget}
          onClick={() => {
            if (!resultTarget) return;
            navigate(myTestsResultPath(projectId, resultTarget));
          }}
        >
          Open selected test
        </Button>
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={() => setSelectedTestId(null)}>
            Clear selection
          </Button>
        </div>
      </div>
    </SelectionActionBar>
  );

  if (assignedQuery.isLoading || assignedCatalogQuery.isLoading || milestonesQuery.isLoading) {
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
          title={assignedRows.length === 0 ? "No assigned tests" : "No matching tests"}
          description={
            assignedRows.length === 0
              ? "Tests assigned to you on a run appear here."
              : "Clear filters to see every assigned test, including completed or blocked work."
          }
          action={
            assignedRows.length > 0 ? (
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null
          }
        />
      ) : (
        <DataTable
          dense
          className="rounded-none"
          rowKey={(row) => row.testId}
          rows={queuedRows}
          columns={[
            {
              key: "select",
              header: <span className="sr-only">Select</span>,
              cell: (row) => (
                <input
                  type="checkbox"
                  aria-label={`Select C${row.caseId} ${row.title} in ${formatMyTestsRunContext(row)}`}
                  checked={visibleSelectedId === row.testId}
                  onChange={(event) => toggleSelected(row.testId, event.target.checked)}
                />
              )
            },
            {
              key: "case",
              header: "Test",
              cell: (row) => (
                <div data-my-tests-row={row.testId} data-my-tests-run={row.runId}>
                  <Link
                    to={myTestsResultPath(projectId, row)}
                    className="font-medium text-slate-900 underline-offset-2 hover:underline"
                  >
                    C{row.caseId} {row.title}
                  </Link>
                  <p className="text-xs text-slate-500 sm:hidden" data-my-tests-run-context="">
                    {formatMyTestsRunContext(row)}
                  </p>
                  {formatMyTestsDueContext(row) ? (
                    <p className="text-xs text-slate-500 sm:hidden">{formatMyTestsDueContext(row)}</p>
                  ) : null}
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
                  {formatMyTestsRunContext(row)}
                </Link>
              )
            },
            {
              key: "due",
              header: "Due",
              headerClassName: hasDue ? compactHide : "hidden",
              cellClassName: hasDue ? compactHide : "hidden",
              cell: (row) => (
                <div className="flex flex-wrap items-center gap-1">
                  <span>{formatRunDueOn(row.runDueOn)}</span>
                  <AssignmentAgingBadge level={row.agingLevel} />
                </div>
              )
            },
            {
              key: "status",
              header: "Status",
              cell: (row) => <StatusBadge status={row.status} />
            },
            {
              key: "action",
              header: <span className="sr-only">Open</span>,
              align: "right",
              headerClassName: "whitespace-nowrap",
              cellClassName: "whitespace-nowrap",
              cell: (row) => (
                <Link
                  className={buttonClassName({ variant: "link", size: "sm" })}
                  to={myTestsResultPath(projectId, row)}
                  aria-label={`Open C${row.caseId} ${row.title} in ${formatMyTestsRunContext(row)}`}
                  data-my-tests-open-test=""
                >
                  Open test
                </Link>
              )
            }
          ]}
        />
      )}
    </WorkbenchPage>
  );
}
