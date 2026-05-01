export type ResultStatus = "passed" | "failed" | "blocked" | "retest" | "untested";

export type CustomValue = string | number | boolean | null;

export type ResultSubmitPayload = {
  status: ResultStatus;
  comment?: string;
  elapsed?: string;
  version?: string;
  defects: string[];
  customValues?: Record<string, CustomValue>;
  stepResults: Array<{ stepOrder: number; status: ResultStatus; actualResult?: string; comment?: string }>;
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
