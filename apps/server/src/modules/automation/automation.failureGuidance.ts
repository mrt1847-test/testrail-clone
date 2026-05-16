export type AutomationFailureGuidance = {
  errorCode: string;
  guidance: string;
};

export function resolveAutomationFailureGuidance(
  comment: string | null | undefined,
  status: string
): AutomationFailureGuidance | null {
  const text = (comment ?? "").toLowerCase();
  if (text.includes("not found in run") || text.includes("case_not_found")) {
    return {
      errorCode: "CASE_NOT_FOUND_IN_RUN",
      guidance:
        "Confirm the case is included in the run and that the payload case_id matches the run instance before retrying."
    };
  }
  if (text.includes("run is closed") || text.includes("run_closed")) {
    return {
      errorCode: "RUN_CLOSED",
      guidance: "Reopen the run or create a new run, then resubmit automation results for this case."
    };
  }
  if (status === "failed") {
    return {
      errorCode: "AUTOMATION_RESULT_FAILED",
      guidance:
        "Review the failure comment and automation mapping. Use Retry failed items to queue a retest after fixing the test or mapping."
    };
  }
  return null;
}
