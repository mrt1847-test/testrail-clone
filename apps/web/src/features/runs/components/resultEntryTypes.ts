export type ResultStatus = "passed" | "failed" | "blocked" | "retest" | "untested";

export type CustomValue = string | number | boolean | string[] | null;

export type ResultSubmitPayload = {
  status: ResultStatus;
  comment?: string;
  elapsed?: string;
  version?: string;
  defects: string[];
  customValues?: Record<string, CustomValue>;
  aiActualOutput?: string;
  aiQualityRating?: number;
  aiLatencyMs?: number;
  aiTraces?: string;
  stepResults: Array<{ stepOrder: number; status: ResultStatus; actualResult?: string; comment?: string }>;
  scenarioResults?: Array<{ caseScenarioId: string; status: ResultStatus; comment?: string }>;
};

export type StepResultDraft = {
  id: string;
  stepOrder: number;
  status: ResultStatus;
  actualResult: string;
  comment: string;
};

export type CaseStepContext = {
  stepOrder?: number;
  description: string;
  expected: string;
};
