export type RunSummary = {
  id: string;
  name: string;
  status: "open" | "closed";
  progress: number;
  failed: number;
  createdAt: string;
  milestone?: string;
  assignedTo?: string | null;
};

export type TestInstanceRow = {
  id: string;
  caseCode: string;
  title: string;
  status: string;
};

export type RunDetailDto = {
  run: RunSummary & { environment?: string; assignedTo?: string | null };
  instances: TestInstanceRow[];
  counts: { passed: number; failed: number; blocked: number; retest: number; untested: number };
};

export type TestResultHistoryItem = {
  id: string;
  status: string;
  comment?: string;
  elapsed?: string;
  version?: string;
  source: "manual" | "automation" | "api";
  defects: string[];
  createdAt: string;
};

export type TestResultStepItem = {
  id: string;
  resultId: string;
  stepOrder: number;
  status: string;
  actualResult?: string;
  comment?: string;
  createdAt: string;
};
