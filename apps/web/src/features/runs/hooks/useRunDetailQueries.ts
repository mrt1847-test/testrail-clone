import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { useCaseDetail } from "../../cases/hooks/useCaseDetail";
import { fetchMilestone } from "../../projects/api/planningApi";
import { fetchProjectMembers } from "../../projects/api/settingsApi";
import type { TestInstanceRow } from "../types";
import {
  useResultAttachmentsQuery,
  useResultDefectsQuery,
  useResultStepsQuery,
  useRunDetailQuery,
  useRunInstancesQuery,
  useTestResultsQuery
} from "./useRunsApi";

type RunInstanceApiRow = {
  id: string | number;
  caseId: string | number;
  titleSnapshot: string;
  status: string;
  assignedTo?: string | number | null;
  caseChanged?: boolean;
  changedFields?: string[];
  sectionId?: string | number | null;
  casePriority?: string | null;
  caseType?: string | null;
};

type Input = {
  projectId: string;
  runId: string;
  selectedCaseId: number | null;
  selectedTestId: string | undefined;
  selectedResultId: string | null;
  instancePage: number;
  pageSize: number;
  historyPage: number;
  historyPageSize: number;
  statusFilter: string;
  assigneeFilter: string;
  searchText: string;
  priorityFilter?: import("../utils/runInstanceListParams").RunFilterPriority;
  caseTypeFilter?: import("../utils/runInstanceListParams").RunFilterCaseType;
  caseChangedFilter?: boolean;
  sortBy?: import("../utils/runInstanceListParams").RunSortBy;
  sortDir?: import("../utils/runInstanceListParams").RunSortDir;
};

export function useRunDetailQueries(input: Input) {
  const {
    projectId,
    runId,
    selectedCaseId,
    selectedTestId,
    selectedResultId,
    instancePage,
    pageSize,
    historyPage,
    historyPageSize,
    statusFilter,
    assigneeFilter,
    searchText,
    priorityFilter = "",
    caseTypeFilter = "",
    caseChangedFilter = false,
    sortBy = "case_id",
    sortDir = "asc"
  } = input;

  const runDetailQuery = useRunDetailQuery(projectId, runId);
  const milestoneId = runDetailQuery.data?.run.milestoneId ?? null;
  const membersQuery = useQuery({
    queryKey: ["run-assignee-members", projectId],
    queryFn: () => fetchProjectMembers(projectId),
    enabled: Boolean(projectId)
  });
  const milestoneQuery = useQuery({
    queryKey: ["run-detail-milestone", projectId, milestoneId ?? ""],
    queryFn: () => fetchMilestone(projectId, milestoneId ?? ""),
    enabled: Boolean(projectId && milestoneId)
  });
  const runInstancesQuery = useRunInstancesQuery({
    projectId,
    runId,
    page: instancePage,
    pageSize,
    status: statusFilter,
    assignee: assigneeFilter,
    search: searchText,
    priority: priorityFilter,
    caseType: caseTypeFilter,
    caseChanged: caseChangedFilter,
    sortBy,
    sortDir
  });
  const pagedInstances: TestInstanceRow[] = useMemo(
    () =>
      ((runInstancesQuery.data?.data ?? []) as RunInstanceApiRow[]).map((instance) => ({
        id: String(instance.id),
        caseId: String(instance.caseId),
        caseCode: `C${instance.caseId}`,
        title: instance.titleSnapshot,
        status: instance.status,
        assignedTo: instance.assignedTo ? String(instance.assignedTo) : null,
        caseChanged: instance.caseChanged,
        changedFields: instance.changedFields,
        sectionId: instance.sectionId != null ? String(instance.sectionId) : null,
        casePriority: instance.casePriority ?? null,
        caseType: instance.caseType ?? null
      })),
    [runInstancesQuery.data?.data]
  );
  const selectedCaseDetail = useCaseDetail(selectedCaseId);
  const historyQuery = useTestResultsQuery(selectedTestId, historyPage, historyPageSize);
  const stepsQuery = useResultStepsQuery(selectedResultId ?? undefined);
  const attachmentsQuery = useResultAttachmentsQuery(selectedResultId ?? undefined);
  const defectsQuery = useResultDefectsQuery(selectedResultId ?? undefined);

  return {
    runDetailQuery,
    membersQuery,
    milestoneQuery,
    runInstancesQuery,
    pagedInstances,
    selectedCaseDetail,
    historyQuery,
    stepsQuery,
    attachmentsQuery,
    defectsQuery
  };
}
