export type CasePriority = "Low" | "Medium" | "High";
export type CaseType = "Functional" | "Integration" | "Regression";

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
  steps: Array<{ description: string; expected: string }>;
  sectionId: number;
  updatedAt: string;
}

export interface SectionNode {
  id: number;
  name: string;
}

