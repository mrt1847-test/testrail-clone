import type { TestStatus } from "../../domain/status.js";

export type ResultInput = {
  status: TestStatus;
  comment?: string;
  elapsed?: string;
  version?: string;
  defects?: string[];
  source?: "manual" | "automation" | "api";
  stepResults?: Array<{
    stepOrder: number;
    status: TestStatus;
    actualResult?: string;
    comment?: string;
  }>;
};

export type BulkResultItem = ResultInput & {
  caseId: bigint;
};

export type BulkAddResultsInput = {
  runId: bigint;
  atomic?: boolean;
  results: BulkResultItem[];
};

export type BulkResultResponse = {
  runId: bigint;
  atomic: boolean;
  total: number;
  saved: number;
  failed: number;
  items: Array<
    | { index: number; caseId: bigint; status: "saved"; testId: bigint; resultId: bigint }
    | { index: number; caseId: bigint; status: "failed"; errorCode: string; message: string }
  >;
};
