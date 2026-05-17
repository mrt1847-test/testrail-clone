import type { TestStatus } from "../../domain/status.js";
import type { CustomFieldValue } from "../../domain/customFieldTypes.js";

export type ResultInput = {
  status: TestStatus;
  comment?: string;
  elapsed?: string;
  version?: string;
  defects?: string[];
  aiActualOutput?: string | null;
  aiQualityRating?: number | null;
  aiLatencyMs?: number | null;
  aiTraces?: string | null;
  customValues?: Record<string, CustomFieldValue>;
  source?: "manual" | "automation" | "api";
  metadata?: Record<string, unknown>;
  stepResults?: Array<{
    stepOrder: number;
    status: TestStatus;
    actualResult?: string;
    comment?: string;
  }>;
  scenarioResults?: Array<{
    caseScenarioId: bigint;
    status: TestStatus;
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
