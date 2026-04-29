export type CasePriority = "Low" | "Medium" | "High";
export type CaseType = "Functional" | "Integration" | "Regression";

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
  lockVersion: number;
  updatedAt: string;
}

export type CaseVersion = {
  id: number;
  caseId: number;
  versionNo: number;
  title: string;
  changeReason?: string | null;
  createdAt: string;
};

export interface SectionNode {
  id: number;
  name: string;
}

