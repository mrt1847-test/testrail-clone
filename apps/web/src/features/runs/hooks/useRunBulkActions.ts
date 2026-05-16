import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { reportKeys } from "../../projects/hooks/reportKeys";
import { projectKeys } from "../../projects/hooks/useProjectsApi";
import { bulkAddRunResults, type BulkRunResultItem } from "../api/runApi";
import type { ResultStatus } from "../components/resultEntryTypes";
import type { TestInstanceRow } from "../types";

export type BulkResultFailureRow = {
  caseId: string;
  caseCode: string;
  title: string;
  message: string;
};

export type BulkResultFeedback =
  | {
      type: "success";
      saved: number;
      failed: number;
      message: string;
    }
  | {
      type: "partial";
      saved: number;
      failed: number;
      message: string;
      failures: BulkResultFailureRow[];
    }
  | {
      type: "error";
      message: string;
      failures?: BulkResultFailureRow[];
    };

type Input = {
  projectId: string;
  runId: string;
  pagedInstances: TestInstanceRow[];
};

function mapFailures(
  failedItems: BulkRunResultItem[],
  instanceByCaseId: Map<string, TestInstanceRow>
): BulkResultFailureRow[] {
  return failedItems.map((item) => {
    const row = instanceByCaseId.get(item.caseId);
    return {
      caseId: item.caseId,
      caseCode: row?.caseCode ?? `C${item.caseId}`,
      title: row?.title ?? "Unknown case",
      message:
        item.errorCode === "UNTESTED_NOT_ALLOWED"
          ? "Untested cannot be set after a result exists for this test."
          : (item.message ?? item.errorCode ?? "Failed to save result")
    };
  });
}

export function useRunBulkActions(input: Input) {
  const { projectId, runId, pagedInstances } = input;
  const qc = useQueryClient();

  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<ResultStatus>("passed");
  const [bulkComment, setBulkComment] = useState("");
  const [bulkFeedback, setBulkFeedback] = useState<BulkResultFeedback | null>(null);

  const instanceByTestId = useMemo(() => {
    const map = new Map<string, TestInstanceRow>();
    for (const row of pagedInstances) {
      map.set(row.id, row);
    }
    return map;
  }, [pagedInstances]);

  const instanceByCaseId = useMemo(() => {
    const map = new Map<string, TestInstanceRow>();
    for (const row of pagedInstances) {
      map.set(row.caseId, row);
    }
    return map;
  }, [pagedInstances]);

  const bulkDisableUntested = useMemo(
    () =>
      selectedTestIds.some((testId) => {
        const row = instanceByTestId.get(testId);
        return row != null && row.status !== "untested";
      }),
    [selectedTestIds, instanceByTestId]
  );

  useEffect(() => {
    if (bulkDisableUntested && bulkStatus === "untested") {
      setBulkStatus("passed");
    }
  }, [bulkDisableUntested, bulkStatus]);

  const bulkResultMutation = useMutation({
    mutationFn: async () => {
      const targets = selectedTestIds
        .map((testId) => instanceByTestId.get(testId))
        .filter((row): row is TestInstanceRow => Boolean(row));
      if (targets.length === 0) {
        throw new Error("Select at least one test.");
      }
      return bulkAddRunResults({
        runId,
        atomic: false,
        results: targets.map((row) => ({
          caseId: row.caseId,
          status: bulkStatus,
          comment: bulkComment.trim() || undefined
        }))
      });
    },
    onMutate: () => {
      setBulkFeedback(null);
    },
    onSuccess: async (response) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["runs", projectId, "detail", runId] }),
        qc.invalidateQueries({ queryKey: ["runs", projectId, "instances", runId] }),
        qc.invalidateQueries({ queryKey: projectKeys.overview(projectId) }),
        qc.invalidateQueries({ queryKey: reportKeys.all(projectId) }),
        qc.invalidateQueries({ queryKey: ["result-explorer", projectId] }),
        qc.invalidateQueries({ queryKey: ["project-activity", projectId] }),
        qc.invalidateQueries({
          predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "test-results"
        })
      ]);

      const failedItems = response.items.filter((item) => item.status === "failed");
      const failures = mapFailures(failedItems, instanceByCaseId);
      const saved = response.saved;

      setBulkComment("");
      if (failedItems.length === 0) {
        setSelectedTestIds([]);
      } else {
        const failedTestIds = failedItems
          .map((item) => instanceByCaseId.get(item.caseId)?.id)
          .filter((id): id is string => Boolean(id));
        setSelectedTestIds(failedTestIds);
      }

      if (response.failed === 0) {
        setBulkFeedback({
          type: "success",
          saved,
          failed: 0,
          message:
            saved === 1
              ? "Bulk result saved for 1 selected test."
              : `Bulk result saved for ${saved} selected tests.`
        });
        return;
      }

      if (saved > 0) {
        setBulkFeedback({
          type: "partial",
          saved,
          failed: response.failed,
          message: `Saved ${saved} of ${response.total}; ${response.failed} failed.`,
          failures
        });
        return;
      }

      setBulkFeedback({
        type: "error",
        message: `No results saved (${response.failed} failed).`,
        failures
      });
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Bulk apply failed.";
      setBulkFeedback({ type: "error", message });
    }
  });

  const allFilteredSelected =
    pagedInstances.length > 0 && pagedInstances.every((row) => selectedTestIds.includes(row.id));
  const canBulkSubmit = selectedTestIds.length > 0 && !bulkResultMutation.isPending;
  const selectedCount = selectedTestIds.length;
  const rerunStatuses = useMemo(
    () => ["failed"] as Array<"failed" | "blocked" | "retest">,
    []
  );

  return {
    selectedTestIds,
    setSelectedTestIds,
    bulkStatus,
    setBulkStatus,
    bulkComment,
    setBulkComment,
    bulkResultMutation,
    bulkFeedback,
    setBulkFeedback,
    allFilteredSelected,
    canBulkSubmit,
    selectedCount,
    defaultRerunStatuses: rerunStatuses,
    bulkDisableUntested
  };
}
