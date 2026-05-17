import { AppError } from "../common/errors/appError.js";

export const RESULT_CORRECTION_MODE = "append_only" as const;

export type ResultCorrectionPolicy = {
  mode: typeof RESULT_CORRECTION_MODE;
  summary: string;
  userGuidance: string;
  allowNewResult: true;
  allowEditHistoricalResult: false;
  allowDeleteHistoricalResult: false;
  correctionMethod: "add_result";
  allowedPostSubmitActions: Array<"attachment" | "defect_link">;
};

export const RESULT_CORRECTION_POLICY: ResultCorrectionPolicy = {
  mode: RESULT_CORRECTION_MODE,
  summary:
    "Submitted test results are immutable. Status, comment, elapsed, and custom values on a saved result cannot be changed.",
  userGuidance:
    "To correct a mistake, add a new result with the updated status or notes. The latest result drives the test status shown in the run.",
  allowNewResult: true,
  allowEditHistoricalResult: false,
  allowDeleteHistoricalResult: false,
  correctionMethod: "add_result",
  allowedPostSubmitActions: ["attachment", "defect_link"]
};

export function rejectResultRowMutation(method = "PATCH") {
  throw new AppError(
    "RESULT_IMMUTABLE",
    "Submitted results cannot be edited or deleted. Add a new result to correct status, comments, or custom values.",
    405,
    {
      policy: RESULT_CORRECTION_POLICY.mode,
      correctionMethod: RESULT_CORRECTION_POLICY.correctionMethod,
      attemptedMethod: method.toUpperCase()
    }
  );
}
