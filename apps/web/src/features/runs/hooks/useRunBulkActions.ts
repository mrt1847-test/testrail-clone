import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

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
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["runs", projectId, "detail", runId] }),
        qc.invalidateQueries({ queryKey: ["runs", projectId, "instances", runId] }),
        qc.invalidateQueries({ queryKey: projectKeys.overview(projectId) }),
        qc.invalidateQueries({ queryKey: reportKeys.all(projectId) }),
        qc.invalidateQueries({ queryKey: ["result-explorer", projectId] })
      ]);
      setBulkComment("");
      setSelectedTestIds([]);
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
    allFilteredSelected,
    canBulkSubmit,
    selectedCount,
    defaultRerunStatuses: rerunStatuses
  };
}
