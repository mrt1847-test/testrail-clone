export type CasePriority = "Low" | "Medium" | "High";
export type CaseType = "Functional" | "Integration" | "Regression";
export type CaseFilterPriority = "" | "low" | "medium" | "high";
export type CaseFilterType = "" | "functional" | "integration" | "regression";
export type CaseFilterAutomation = "" | "manual" | "automated";
export type CaseFilterState = "active" | "archived";
export type CasePresenceFilter = "" | "with" | "without";
export type CaseSectionScope = "direct" | "subtree";
export type CaseListColumn = "type" | "priority" | "automation" | "estimate" | "refs" | "labels" | "customValues";

export type CaseListFilters = {
  q: string;
  priority: CaseFilterPriority;
  caseType: CaseFilterType;
  automation: CaseFilterAutomation;
  refs: CasePresenceFilter;
  labels: CasePresenceFilter;
  estimate: CasePresenceFilter;
  sectionScope?: CaseSectionScope;
  state: CaseFilterState;
};

export type CaseStep = {
  id?: number;
  stepOrder?: number;
  description: string;
  expected: string;
};

export interface TestCase {
  id: number;
  projectId?: number;
  caseCode: string;
  title: string;
  type: CaseType;
  priority: CasePriority;
  automationStatus: "manual" | "automated";
  estimate: string;
  references: string;
  labels: string[];
  automationKey: string;
  preconditions: string;
  customValues: Record<string, string | number | boolean | null>;
  steps: CaseStep[];
  sectionId: number;
  displayOrder: number;
  lockVersion: number;
  updatedAt: string;
  archivedAt: string | null;
}

export type CaseVersion = {
  id: number;
  caseId: number;
  versionNo: number;
  title: string;
  priority?: string | null;
  caseType?: string | null;
  preconditions?: string | null;
  customValuesSnapshot?: Record<string, string | number | boolean | null>;
  stepsSnapshot?: Array<{ stepOrder: number; content: string; expectedResult?: string | null }>;
  changeReason?: string | null;
  createdAt: string;
};

export interface SectionNode {
  id: number;
  suiteId: number;
  name: string;
  parentSectionId: number | null;
  displayOrder: number;
}

export type SavedCaseView = {
  id: string;
  name: string;
  sectionId: number | null;
  filters: CaseListFilters;
  columns: CaseListColumn[];
};

