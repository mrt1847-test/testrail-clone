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
  steps: CaseStep[];
  sectionId: number;
  updatedAt: string;
}

export interface SectionNode {
  id: number;
  name: string;
}

