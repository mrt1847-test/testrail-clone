export type RunSummary = {
  id: string;
  name: string;
  status: "open" | "closed";
  progress: number;
  failed: number;
  createdAt: string;
  startedAt?: string | null;
  dueOn?: string | null;
  closedAt?: string | null;
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
  caseChanged?: boolean;
  changedFields?: string[];
  sectionId?: string | null;
  casePriority?: string | null;
  caseType?: string | null;
};

export type RunInstanceGroupBy = "section_id" | "priority" | "type" | "none";

export type RunInstanceGroupDto = {
  groupKey: string;
  groupLabel: string;
  sectionId: string | null;
  sectionName: string | null;
  displayOrder: number;
  parentSectionId: string | null;
  instances: Array<{
    id: string;
    caseId: string;
    titleSnapshot: string;
    status: string;
    assignedTo?: string | null;
    caseChanged?: boolean;
    changedFields?: string[];
    sectionId?: string | null;
    casePriority?: string | null;
    caseType?: string | null;
  }>;
};

export type RunInstancesGroupedDto = {
  groupBy: RunInstanceGroupBy;
  suiteId: string;
  total: number;
  truncated: boolean;
  sectionCounts: Array<{ sectionId: string; count: number }>;
  groups: RunInstanceGroupDto[];
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

export type RunDetail = RunSummary & {
  suiteId?: string;
  planId?: string | null;
  environment?: string;
  includeAll?: boolean;
  composition?: RunCompositionInfo | null;
};

export type RunProgressMetricsDto = {
  total: number;
  counts: { passed: number; failed: number; blocked: number; retest: number; untested: number };
  executed: number;
  completionRate: number;
  progressPercent: number;
};

export type RunDetailDto = {
  run: RunDetail;
  dateWarnings?: string[];
  instances: TestInstanceRow[];
  counts: { passed: number; failed: number; blocked: number; retest: number; untested: number };
  metrics?: RunProgressMetricsDto;
};

export type DefectPushContext = {
  projectId: string;
  runId: string;
  runName: string;
  testId: string;
  testTitle: string;
  resultId: string;
  resultStatus: string;
  resultComment?: string | null;
  caseCode?: string | null;
  caseTitle?: string | null;
  casePreconditions?: string | null;
  caseExpected?: string | null;
  caseRefs?: string | null;
};

export type DefectPushFieldDefinition = {
  key: string;
  label: string;
  type: "text" | "textarea" | "select";
  required?: boolean;
  placeholder?: string;
  options?: string[];
  mapsTo?: "defectKey" | "title" | "description";
};

export type CaseExecutionHistoryItem = {
  resultId: string;
  testId: string;
  runId: string;
  runName: string;
  runClosed: boolean;
  status: string;
  comment?: string | null;
  elapsed?: string | null;
  version?: string | null;
  defects: string[];
  createdAt: string;
};

export type TestResultHistoryItem = {
  id: string;
  status: string;
  comment?: string;
  elapsed?: string;
  version?: string;
  source: "manual" | "automation" | "api";
  defects: string[];
  customValues?: Record<string, string | number | boolean | string[] | null>;
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
  remoteStatus?: string | null;
  remoteStatusLabel?: string | null;
  remoteStatusSyncedAt?: string | null;
  createdAt: string;
};
