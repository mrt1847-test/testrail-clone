export type RunSummary = {
  id: string;
  name: string;
  status: "open" | "closed";
  progress: number;
  failed: number;
  createdAt: string;
  milestone?: string;
};

export type TestInstanceRow = {
  id: string;
  caseCode: string;
  title: string;
  status: string;
};

export type RunDetailDto = {
  run: RunSummary & { environment?: string };
  instances: TestInstanceRow[];
  counts: { passed: number; failed: number; blocked: number; retest: number; untested: number };
};
