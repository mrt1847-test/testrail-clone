import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

export type BulkResultFeedback =
  | { type: "success"; message: string }
  | { type: "error"; message: string };

import { reportKeys } from "../../projects/hooks/reportKeys";
import { projectKeys } from "../../projects/hooks/useProjectsApi";
import { addRunResult } from "../api/runApi";
import type { ResultStatus } from "../components/resultEntryTypes";
import type { TestInstanceRow } from "../types";

type Input = {
  projectId: string;
  runId: string;
  pagedInstances: TestInstanceRow[];
};

export function useRunBulkActions(input: Input) {
  const { projectId, runId, pagedInstances } = input;
  const qc = useQueryClient();

  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<ResultStatus>("passed");
  const [bulkComment, setBulkComment] = useState("");
  const [bulkFeedback, setBulkFeedback] = useState<BulkResultFeedback | null>(null);

  const bulkResultMutation = useMutation({
    mutationFn: async () => {
      const targets = selectedTestIds;
      await Promise.all(
        targets.map((testId) =>
          addRunResult({
            runId,
            testId,
            status: bulkStatus,
            comment: bulkComment.trim() || undefined
          })
        )
      );
      return targets.length;
    },
    onMutate: () => {
      setBulkFeedback(null);
    },
    onSuccess: async (appliedCount) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["runs", projectId, "detail", runId] }),
        qc.invalidateQueries({ queryKey: ["runs", projectId, "instances", runId] }),
        qc.invalidateQueries({ queryKey: projectKeys.overview(projectId) }),
        qc.invalidateQueries({ queryKey: reportKeys.all(projectId) }),
        qc.invalidateQueries({ queryKey: ["result-explorer", projectId] }),
        qc.invalidateQueries({
          predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === "test-results"
        })
      ]);
      setBulkComment("");
      setSelectedTestIds([]);
      setBulkFeedback({
        type: "success",
        message:
          appliedCount === 1
            ? "Bulk result applied to 1 selected test."
            : `Bulk result applied to ${appliedCount} selected tests.`
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
    defaultRerunStatuses: rerunStatuses
  };
}
