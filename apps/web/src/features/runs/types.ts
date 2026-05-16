export type RunSummary = {
  id: string;
  name: string;
  status: "open" | "closed";
  progress: number;
  failed: number;
  createdAt: string;
  milestone?: string;
  milestoneId?: string | null;
  assignedTo?: string | null;
};

export type TestInstanceRow = {
  id: string;
  caseId: string;
  caseCode: string;
  title: string;
  status: string;
  assignedTo?: string | null;
};

export type RunCompositionMode = "static" | "include_all_live" | "dynamic_filter";

export type RunCompositionInfo = {
  compositionMode: RunCompositionMode;
  filterDefinition?: {
    priority?: "low" | "medium" | "high";
    state?: "active" | "archived";
    includedSectionIds?: string[];
  };
  lastSyncedAt?: string;
  lastSyncAdded?: number;
  lastSyncRemoved?: number;
};

export type RunDetailDto = {
  run: RunSummary & {
    environment?: string;
    assignedTo?: string | null;
    includeAll?: boolean;
    composition?: RunCompositionInfo | null;
  };
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
  customValues?: Record<string, string | number | boolean | null>;
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

export type ResultAttachmentItem = {
  id: string;
  fileName: string;
  contentType?: string | null;
  storagePath: string;
  fileSize?: string | null;
  createdAt: string;
};

export type ResultDefectLinkItem = {
  id: string;
  defectKey: string;
  url?: string | null;
  createdAt: string;
};
