export type BulkCaseFailureRow = {
  caseId: string;
  label: string;
  error: string;
};

export type BulkCaseFeedback = {
  tone: "success" | "partial" | "error";
  message: string;
  failures?: BulkCaseFailureRow[];
};

export function bulkCaseFeedbackClass(feedback: BulkCaseFeedback) {
  if (feedback.tone === "error") return "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900";
  if (feedback.tone === "partial") return "rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950";
  return "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950";
}

export function buildBulkCaseFeedback(input: {
  successCount: number;
  failedCount: number;
  successLabel: string;
  failureLabel: string;
  items: Array<{ caseId: string; success: boolean; error: string | null }>;
  caseLabelById: Map<number, string>;
}): BulkCaseFeedback | null {
  const { successCount, failedCount, successLabel, failureLabel, items, caseLabelById } = input;
  if (successCount === 0 && failedCount === 0) return null;

  const failures = items
    .filter((item) => !item.success)
    .map((item) => ({
      caseId: item.caseId,
      label: caseLabelById.get(Number(item.caseId)) ?? `C${item.caseId}`,
      error: item.error ?? "UNKNOWN"
    }));

  if (failedCount === 0) {
    return {
      tone: "success",
      message: `${successLabel} ${successCount} selected case${successCount === 1 ? "" : "s"}.`
    };
  }

  if (successCount > 0) {
    return {
      tone: "partial",
      message: `${successLabel} ${successCount}; ${failureLabel} ${failedCount}.`,
      failures
    };
  }

  return {
    tone: "error",
    message: `${failureLabel} ${failedCount} selected case${failedCount === 1 ? "" : "s"}.`,
    failures
  };
}
