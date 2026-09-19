import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { reportKeys } from "../../projects/hooks/reportKeys";
import { projectKeys } from "../../projects/hooks/useProjectsApi";
import { bulkAddRunResults } from "../api/runApi";
import type { ResultStatus } from "../components/resultEntryTypes";
import type { TestInstanceRow } from "../types";
import {
  captureBulkSubmitSnapshot,
  failedBulkRecovery,
  type BulkResultFailureRow,
  type BulkSubmitSnapshot
} from "../utils/runBulkSelectionScope";

export type { BulkResultFailureRow };

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
  displayedInstances: TestInstanceRow[];
  instanceLookup: Map<string, TestInstanceRow>;
  filteredTotal: number;
};

export function useRunBulkActions(input: Input) {
  const { projectId, runId, displayedInstances, instanceLookup, filteredTotal } = input;
  const qc = useQueryClient();

  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<ResultStatus>("passed");
  const [bulkComment, setBulkComment] = useState("");
  const [bulkFeedback, setBulkFeedback] = useState<BulkResultFeedback | null>(null);
  const submittedSnapshotRef = useRef<BulkSubmitSnapshot | null>(null);
  const [recoverySnapshot, setRecoverySnapshot] = useState<BulkSubmitSnapshot | null>(null);

  const instanceByTestId = instanceLookup;

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
    mutationFn: async (snapshotArg?: BulkSubmitSnapshot) => {
      let snapshot = snapshotArg ?? null;
      if (!snapshot) {
        const captured = captureBulkSubmitSnapshot({
          selectedTestIds,
          lookup: instanceLookup,
          status: bulkStatus,
          comment: bulkComment
        });
        if (!captured.ok || !captured.snapshot) {
          throw new Error(!captured.ok ? captured.message : "Select at least one test.");
        }
        snapshot = captured.snapshot;
      }
      submittedSnapshotRef.current = snapshot;
      return bulkAddRunResults({
        runId,
        atomic: false,
        results: snapshot.targets.map((row) => ({
          caseId: row.caseId,
          status: snapshot.status,
          comment: snapshot.comment.trim() || undefined
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

      const snapshot = submittedSnapshotRef.current;
      const saved = response.saved;
      const recovery = snapshot
        ? failedBulkRecovery(response.items, snapshot)
        : { selectedTestIds: [] as string[], failures: [] as BulkResultFailureRow[], recovery: null };

      setBulkComment("");
      if (response.failed === 0) {
        setSelectedTestIds([]);
        setRecoverySnapshot(null);
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

      setSelectedTestIds(recovery.selectedTestIds);
      setRecoverySnapshot(recovery.recovery);

      if (saved > 0) {
        setBulkFeedback({
          type: "partial",
          saved,
          failed: response.failed,
          message: `Saved ${saved} of ${response.total}; ${response.failed} failed.`,
          failures: recovery.failures
        });
        return;
      }

      setBulkFeedback({
        type: "error",
        message: `No results saved (${response.failed} failed).`,
        failures: recovery.failures
      });
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Bulk apply failed.";
      setBulkFeedback({ type: "error", message });
    }
  });

  const allPageSelected =
    displayedInstances.length > 0 && displayedInstances.every((row) => selectedTestIds.includes(row.id));
  const allFilteredSelected = filteredTotal > 0 && selectedTestIds.length === filteredTotal;
  const canBulkSubmit = selectedTestIds.length > 0 && !bulkResultMutation.isPending;
  const selectedCount = selectedTestIds.length;
  const rerunStatuses = useMemo(
    () => ["failed"] as Array<"failed" | "blocked" | "retest">,
    []
  );
  const retryFailedBulkResults = () => {
    if (!recoverySnapshot || bulkResultMutation.isPending) return;
    void bulkResultMutation.mutateAsync(recoverySnapshot);
  };
  const dismissBulkFeedback = () => {
    setBulkFeedback(null);
    setRecoverySnapshot(null);
  };

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
    dismissBulkFeedback,
    retryFailedBulkResults,
    canRetryFailedBulk: Boolean(recoverySnapshot) && !bulkResultMutation.isPending,
    allPageSelected,
    allFilteredSelected,
    canBulkSubmit,
    selectedCount,
    defaultRerunStatuses: rerunStatuses,
    bulkDisableUntested
  };
}
