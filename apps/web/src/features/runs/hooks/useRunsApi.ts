import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { projectKeys } from "../../projects/hooks/useProjectsApi";
import { reportKeys } from "../../projects/hooks/reportKeys";
import { assignmentListFiltersToApi, type AssignmentListFilterState } from "../assignmentListFilters";
import {
  addResultDefectLink,
  deleteResultDefectLink,
  addRunResult,
  closeRun,
  type CreateRunInput,
  createRun,
  fetchResultAttachments,
  fetchResultDefectLinks,
  fetchResultSteps,
  fetchRunDetail,
  fetchRunInstancesPage,
  fetchRuns,
  fetchAssignedToMe,
  fetchTeamTodo,
  fetchRunTestSubscriptions,
  updateTestSubscription,
  fetchAttachmentDownloadUrl,
  fetchTestResultsPage,
  pushResultDefect,
  syncResultDefectLink,
  duplicateRun,
  rerunRun,
  type DuplicateRunInput,
  updateTestAssignee,
  updateRunAssignee,
  updateRunSchedule,
  uploadResultAttachmentViaPresign,
  deleteAttachment,
  reopenRun,
  addCasesToRun,
  removeTestFromRun,
  syncRunComposition,
  updateRunComposition,
  type UpdateRunCompositionInput
} from "../api/runApi";
import type { RunDetailDto } from "../types";

export const runKeys = {
  all: (projectId: string) => ["runs", projectId] as const,
  list: (projectId: string) => [...runKeys.all(projectId), "list"] as const,
  detail: (projectId: string, runId: string) => [...runKeys.all(projectId), "detail", runId] as const,
  subscriptions: (runId: string) => ["run-test-subscriptions", runId] as const,
  instancesPrefix: (projectId: string, runId: string) => [...runKeys.all(projectId), "instances", runId] as const,
  instances: (
    projectId: string,
    runId: string,
    page: number,
    pageSize: number,
    status: string,
    assignee: string,
    search: string
  ) => [...runKeys.all(projectId), "instances", runId, page, pageSize, status, assignee, search] as const,
  resultsPrefix: (testId: string) => ["test-results", testId] as const,
  resultsPage: (testId: string, page: number, pageSize: number) =>
    ["test-results", testId, page, pageSize] as const,
  resultSteps: (resultId: string) => ["result-steps", resultId] as const,
  resultAttachments: (resultId: string) => ["result-attachments", resultId] as const,
  resultDefects: (resultId: string) => ["result-defects", resultId] as const,
  assignedToMe: (
    projectId: string,
    status: string,
    runId: string,
    search: string,
    milestoneId: string,
    dueFilter: string,
    dueBy: string
  ) =>
    [...runKeys.all(projectId), "assigned-to-me", status, runId, search, milestoneId, dueFilter, dueBy] as const,
  teamTodo: (
    projectId: string,
    assigneeId: string,
    status: string,
    runId: string,
    search: string,
    milestoneId: string,
    dueFilter: string,
    dueBy: string
  ) =>
    [
      ...runKeys.all(projectId),
      "team-todo",
      assigneeId,
      status,
      runId,
      search,
      milestoneId,
      dueFilter,
      dueBy
    ] as const
};

export function useRunsQuery(projectId: string | undefined) {
  return useQuery({
    queryKey: runKeys.list(projectId ?? ""),
    queryFn: () => fetchRuns(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useRunDetailQuery(projectId: string | undefined, runId: string | undefined) {
  return useQuery({
    queryKey: runKeys.detail(projectId ?? "", runId ?? ""),
    queryFn: () => fetchRunDetail(projectId!, runId!),
    enabled: Boolean(projectId && runId),
    refetchInterval: (query) => {
      const data = query.state.data as RunDetailDto | null | undefined;
      return data?.run.status === "closed" ? false : 15000;
    },
    refetchIntervalInBackground: false
  });
}

export function useRunInstancesQuery(input: {
  projectId: string | undefined;
  runId: string | undefined;
  page: number;
  pageSize: number;
  status: string;
  assignee: string;
  search: string;
}) {
  const { projectId, runId, page, pageSize, status, assignee, search } = input;
  return useQuery({
    queryKey: runKeys.instances(projectId ?? "", runId ?? "", page, pageSize, status, assignee, search),
    queryFn: () =>
      fetchRunInstancesPage({
        projectId: projectId!,
        runId: runId!,
        page,
        pageSize,
        status,
        assignee,
        search
      }),
    enabled: Boolean(projectId && runId),
    refetchInterval: false,
    refetchIntervalInBackground: false
  });
}

export function useCreateRunMutation(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateRunInput, "projectId">) => createRun({ ...input, projectId: projectId! }),
    onSuccess: () => {
      if (!projectId) return;
      void qc.invalidateQueries({ queryKey: runKeys.all(projectId) });
      void qc.invalidateQueries({ queryKey: projectKeys.overview(projectId) });
      void qc.invalidateQueries({ queryKey: reportKeys.all(projectId) });
    }
  });
}

export function useTestResultsQuery(testId: string | undefined, page: number, pageSize: number) {
  return useQuery({
    queryKey: runKeys.resultsPage(testId ?? "", page, pageSize),
    queryFn: () => fetchTestResultsPage(testId!, page, pageSize),
    enabled: Boolean(testId)
  });
}

export function useResultStepsQuery(resultId: string | undefined) {
  return useQuery({
    queryKey: runKeys.resultSteps(resultId ?? ""),
    queryFn: () => fetchResultSteps(resultId!),
    enabled: Boolean(resultId)
  });
}

export function useResultAttachmentsQuery(resultId: string | undefined) {
  return useQuery({
    queryKey: runKeys.resultAttachments(resultId ?? ""),
    queryFn: () => fetchResultAttachments(resultId!),
    enabled: Boolean(resultId)
  });
}

export function useResultDefectsQuery(resultId: string | undefined) {
  return useQuery({
    queryKey: runKeys.resultDefects(resultId ?? ""),
    queryFn: () => fetchResultDefectLinks(resultId!),
    enabled: Boolean(resultId)
  });
}

export function useAddRunResultMutation(projectId: string | undefined, runId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      testId: string;
      status: "passed" | "failed" | "blocked" | "retest" | "untested";
      comment?: string;
      elapsed?: string;
      version?: string;
      defects?: string[];
      customValues?: Record<string, string | number | boolean | string[] | null>;
      stepResults?: Array<{
        stepOrder: number;
        status: "passed" | "failed" | "blocked" | "retest" | "untested";
        actualResult?: string;
        comment?: string;
      }>;
      scenarioResults?: Array<{
        caseScenarioId: string;
        status: "passed" | "failed" | "blocked" | "retest" | "untested";
        comment?: string;
      }>;
      aiActualOutput?: string;
      aiQualityRating?: number;
      aiLatencyMs?: number;
      aiTraces?: string;
    }) =>
      addRunResult({ runId: runId!, ...payload }),
    onSuccess: (_, vars) => {
      if (!projectId || !runId) return;
      void qc.invalidateQueries({ queryKey: runKeys.detail(projectId, runId) });
      void qc.invalidateQueries({ queryKey: runKeys.instancesPrefix(projectId, runId) });
      void qc.invalidateQueries({ queryKey: runKeys.resultsPrefix(vars.testId) });
      void qc.invalidateQueries({ queryKey: projectKeys.overview(projectId) });
      void qc.invalidateQueries({ queryKey: reportKeys.all(projectId) });
      void qc.invalidateQueries({ queryKey: ["result-explorer", projectId] });
    }
  });
}

export function useCloseRunMutation(projectId: string | undefined, runId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => closeRun(runId!),
    onSuccess: () => {
      if (!projectId || !runId) return;
      void qc.invalidateQueries({ queryKey: runKeys.detail(projectId, runId) });
      void qc.invalidateQueries({ queryKey: runKeys.instancesPrefix(projectId, runId) });
      void qc.invalidateQueries({ queryKey: runKeys.list(projectId) });
      void qc.invalidateQueries({ queryKey: projectKeys.overview(projectId) });
      void qc.invalidateQueries({ queryKey: reportKeys.all(projectId) });
    }
  });
}

export function useReopenRunMutation(projectId: string | undefined, runId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => reopenRun(runId!),
    onSuccess: () => {
      if (!projectId || !runId) return;
      void qc.invalidateQueries({ queryKey: runKeys.detail(projectId, runId) });
      void qc.invalidateQueries({ queryKey: runKeys.instancesPrefix(projectId, runId) });
      void qc.invalidateQueries({ queryKey: runKeys.list(projectId) });
      void qc.invalidateQueries({ queryKey: projectKeys.overview(projectId) });
      void qc.invalidateQueries({ queryKey: reportKeys.all(projectId) });
    }
  });
}

export function useSyncRunCompositionMutation(projectId: string | undefined, runId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => syncRunComposition(projectId!, runId!),
    onSuccess: () => {
      if (!projectId || !runId) return;
      void qc.invalidateQueries({ queryKey: runKeys.detail(projectId, runId) });
      void qc.invalidateQueries({ queryKey: runKeys.instancesPrefix(projectId, runId) });
      void qc.invalidateQueries({ queryKey: reportKeys.all(projectId) });
      void qc.invalidateQueries({ queryKey: ["project-activity", projectId] });
      void qc.invalidateQueries({ queryKey: ["project-activity", projectId, "run", runId] });
    }
  });
}

export function useUpdateRunCompositionMutation(projectId: string | undefined, runId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateRunCompositionInput) => updateRunComposition(projectId!, runId!, input),
    onSuccess: () => {
      if (!projectId || !runId) return;
      void qc.invalidateQueries({ queryKey: runKeys.detail(projectId, runId) });
      void qc.invalidateQueries({ queryKey: runKeys.instancesPrefix(projectId, runId) });
      void qc.invalidateQueries({ queryKey: reportKeys.all(projectId) });
      void qc.invalidateQueries({ queryKey: ["project-activity", projectId] });
      void qc.invalidateQueries({ queryKey: ["project-activity", projectId, "run", runId] });
    }
  });
}

export function useAddCasesToRunMutation(projectId: string | undefined, runId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (caseIds: string[]) => addCasesToRun(runId!, caseIds),
    onSuccess: () => {
      if (!projectId || !runId) return;
      void qc.invalidateQueries({ queryKey: runKeys.detail(projectId, runId) });
      void qc.invalidateQueries({ queryKey: runKeys.instancesPrefix(projectId, runId) });
      void qc.invalidateQueries({ queryKey: reportKeys.all(projectId) });
      void qc.invalidateQueries({ queryKey: ["project-activity", projectId] });
      void qc.invalidateQueries({ queryKey: ["project-activity", projectId, "run", runId] });
      void qc.invalidateQueries({ queryKey: ["notifications", projectId] });
    }
  });
}

export function useRemoveTestFromRunMutation(projectId: string | undefined, runId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { testId: string; confirmDataLoss?: boolean }) =>
      removeTestFromRun(runId!, input.testId, input.confirmDataLoss),
    onSuccess: (_, vars) => {
      if (!projectId || !runId) return;
      void qc.invalidateQueries({ queryKey: runKeys.detail(projectId, runId) });
      void qc.invalidateQueries({ queryKey: runKeys.instancesPrefix(projectId, runId) });
      void qc.invalidateQueries({ queryKey: runKeys.resultsPrefix(vars.testId) });
      void qc.invalidateQueries({ queryKey: reportKeys.all(projectId) });
      void qc.invalidateQueries({ queryKey: ["project-activity", projectId] });
      void qc.invalidateQueries({ queryKey: ["project-activity", projectId, "run", runId] });
      void qc.invalidateQueries({ queryKey: ["notifications", projectId] });
    }
  });
}

export function useUpdateRunAssigneeMutation(projectId: string | undefined, runId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assignedTo: string | null) => updateRunAssignee(runId!, assignedTo),
    onSuccess: () => {
      if (!projectId || !runId) return;
      void qc.invalidateQueries({ queryKey: runKeys.detail(projectId, runId) });
      void qc.invalidateQueries({ queryKey: runKeys.instancesPrefix(projectId, runId) });
      void qc.invalidateQueries({ queryKey: [...runKeys.all(projectId), "assigned-to-me"] });
      void qc.invalidateQueries({ queryKey: [...runKeys.all(projectId), "team-todo"] });
    }
  });
}

export function useUpdateRunScheduleMutation(projectId: string | undefined, runId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { startedAt: string | null; dueOn: string | null }) => updateRunSchedule(runId!, patch),
    onSuccess: () => {
      if (!projectId || !runId) return;
      void qc.invalidateQueries({ queryKey: runKeys.detail(projectId, runId) });
      void qc.invalidateQueries({ queryKey: runKeys.list(projectId) });
    }
  });
}

export function useRerunMutation(projectId: string | undefined, runId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (statuses: Array<"passed" | "failed" | "blocked" | "retest" | "untested">) =>
      rerunRun(runId!, statuses),
    onSuccess: () => {
      if (!projectId || !runId) return;
      void qc.invalidateQueries({ queryKey: runKeys.list(projectId) });
      void qc.invalidateQueries({ queryKey: runKeys.detail(projectId, runId) });
      void qc.invalidateQueries({ queryKey: runKeys.instancesPrefix(projectId, runId) });
      void qc.invalidateQueries({ queryKey: projectKeys.overview(projectId) });
      void qc.invalidateQueries({ queryKey: reportKeys.all(projectId) });
    }
  });
}

export function useDuplicateRunMutation(projectId: string | undefined, sourceRunId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DuplicateRunInput) => duplicateRun(sourceRunId!, input),
    onSuccess: (created) => {
      if (!projectId) return;
      void qc.invalidateQueries({ queryKey: runKeys.list(projectId) });
      void qc.invalidateQueries({ queryKey: projectKeys.overview(projectId) });
      void qc.invalidateQueries({ queryKey: reportKeys.all(projectId) });
      const newRunId = String(created.run.id);
      void qc.invalidateQueries({ queryKey: runKeys.detail(projectId, newRunId) });
      void qc.invalidateQueries({ queryKey: runKeys.instancesPrefix(projectId, newRunId) });
    }
  });
}

export function useUpdateTestAssigneeMutation(projectId: string | undefined, runId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { testId: string; assignedTo: string | null }) =>
      updateTestAssignee(input.testId, input.assignedTo),
    onSuccess: () => {
      if (!projectId || !runId) return;
      void qc.invalidateQueries({ queryKey: runKeys.detail(projectId, runId) });
      void qc.invalidateQueries({ queryKey: runKeys.instancesPrefix(projectId, runId) });
      void qc.invalidateQueries({ queryKey: [...runKeys.all(projectId), "assigned-to-me"] });
      void qc.invalidateQueries({ queryKey: [...runKeys.all(projectId), "team-todo"] });
    }
  });
}

export function useAssignedToMeQuery(projectId: string | undefined, filters: AssignmentListFilterState) {
  return useQuery({
    queryKey: runKeys.assignedToMe(
      projectId ?? "",
      filters.status,
      filters.runId,
      filters.search,
      filters.milestoneId,
      filters.dueFilter,
      filters.dueBy
    ),
    queryFn: () => fetchAssignedToMe(projectId!, assignmentListFiltersToApi(filters)),
    enabled: Boolean(projectId),
    refetchInterval: 30000,
    refetchIntervalInBackground: false
  });
}

export function useTeamTodoQuery(
  projectId: string | undefined,
  filters: AssignmentListFilterState & { assigneeId: string }
) {
  return useQuery({
    queryKey: runKeys.teamTodo(
      projectId ?? "",
      filters.assigneeId,
      filters.status,
      filters.runId,
      filters.search,
      filters.milestoneId,
      filters.dueFilter,
      filters.dueBy
    ),
    queryFn: () =>
      fetchTeamTodo(projectId!, {
        assigneeId: filters.assigneeId,
        ...assignmentListFiltersToApi(filters)
      }),
    enabled: Boolean(projectId),
    refetchInterval: 30000,
    refetchIntervalInBackground: false
  });
}

export function useAddResultAttachmentMutation(resultId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { file: File; onProgress?: (progress: number) => void }) =>
      uploadResultAttachmentViaPresign(resultId!, input.file, input.onProgress),
    onSuccess: () => {
      if (!resultId) return;
      void qc.invalidateQueries({ queryKey: runKeys.resultAttachments(resultId) });
    }
  });
}

export function useAddResultDefectMutation(resultId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { defectKey: string; url?: string }) => addResultDefectLink(resultId!, input),
    onSuccess: () => {
      if (!resultId) return;
      void qc.invalidateQueries({ queryKey: runKeys.resultDefects(resultId) });
    }
  });
}

export function usePushResultDefectMutation(resultId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      defectKey?: string;
      title?: string;
      description?: string;
      provider?: string;
      customFields?: Record<string, string>;
    }) => pushResultDefect(resultId!, input),
    onSuccess: () => {
      if (!resultId) return;
      void qc.invalidateQueries({ queryKey: runKeys.resultDefects(resultId) });
    }
  });
}

export function useDeleteResultDefectMutation(resultId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (defectLinkId: string) => deleteResultDefectLink(resultId!, defectLinkId),
    onSuccess: () => {
      if (!resultId) return;
      void qc.invalidateQueries({ queryKey: runKeys.resultDefects(resultId) });
    }
  });
}

export function useSyncResultDefectMutation(resultId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (defectLinkId: string) => syncResultDefectLink(resultId!, defectLinkId),
    onSuccess: () => {
      if (!resultId) return;
      void qc.invalidateQueries({ queryKey: runKeys.resultDefects(resultId) });
    }
  });
}

export function useOpenAttachmentDownloadMutation() {
  return useMutation({
    mutationFn: (attachmentId: string) => fetchAttachmentDownloadUrl(attachmentId),
    onSuccess: (downloadUrl) => {
      if (typeof window !== "undefined") {
        window.open(downloadUrl, "_blank", "noopener,noreferrer");
      }
    }
  });
}

export function useDeleteAttachmentMutation(resultId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => deleteAttachment(attachmentId),
    onSuccess: () => {
      if (!resultId) return;
      void qc.invalidateQueries({ queryKey: runKeys.resultAttachments(resultId) });
    }
  });
}

export function useRunTestSubscriptionsQuery(runId: string | undefined) {
  return useQuery({
    queryKey: runKeys.subscriptions(runId ?? ""),
    queryFn: () => fetchRunTestSubscriptions(runId!),
    enabled: Boolean(runId)
  });
}

export function useTestSubscriptionMutation(runId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { testId: string; subscribed: boolean }) =>
      updateTestSubscription(input.testId, input.subscribed),
    onSuccess: () => {
      if (!runId) return;
      void qc.invalidateQueries({ queryKey: runKeys.subscriptions(runId) });
    }
  });
}
