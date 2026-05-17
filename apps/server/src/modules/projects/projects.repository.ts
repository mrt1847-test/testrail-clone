import type { ProjectType } from "../../domain/projectTypes.js";

export type ProjectRow = {
  id: bigint;
  name: string;
  description?: string | null;
  projectType: ProjectType;
  isArchived?: boolean;
};

export type SuiteRow = {
  id: bigint;
  projectId: bigint;
  name: string;
  description?: string | null;
  isMaster: boolean;
  isBaseline: boolean;
  parentSuiteId?: bigint | null;
};

export type SectionRow = {
  id: bigint;
  suiteId: bigint;
  parentSectionId?: bigint | null;
  displayOrder?: number;
  name: string;
  description?: string | null;
};

export type CaseCustomValue = string | number | boolean | string[] | null;

export type CaseRow = {
  id: bigint;
  projectId?: bigint;
  suiteId?: bigint;
  sectionId: bigint;
  displayOrder?: number;
  title: string;
  priority?: string | null;
  caseType?: string | null;
  estimate?: string | null;
  refs?: string | null;
  labels?: string[];
  automationKey?: string | null;
  externalId?: string | null;
  preconditions?: string | null;
  expectedResult?: string | null;
  mission?: string | null;
  goals?: string | null;
  aiInput?: string | null;
  aiExpectedOutput?: string | null;
  caseTemplateId?: bigint | null;
  customValues?: Record<string, CaseCustomValue>;
  lockVersion: number;
  updatedAt: Date;
  archivedAt?: Date | null;
};

export type CasePresenceFilter = "with" | "without";

export type CaseStepRow = {
  id: bigint;
  stepOrder: number;
  content: string;
  expectedResult?: string | null;
};

export type CaseScenarioRow = {
  id: bigint;
  scenarioOrder: number;
  name: string;
  content: string;
};

export type CaseVersionRow = {
  id: bigint;
  caseId: bigint;
  versionNo: number;
  title: string;
  priority?: string | null;
  caseType?: string | null;
  preconditions?: string | null;
  customValuesSnapshot?: Record<string, CaseCustomValue>;
  stepsSnapshot: Array<{ stepOrder: number; content: string; expectedResult?: string | null }>;
  attachmentSnapshots: Array<{
    id: string;
    entityType: "case" | "case_step";
    entityId: string;
    stepOrder?: number | null;
    fileName: string;
    contentType?: string | null;
    storagePath: string;
    fileSize?: string | null;
    createdAt: string;
    createdBy?: string | null;
  }>;
  changeReason?: string | null;
  createdAt: Date;
};

export interface ProjectsRepository {
  listProjects(): Promise<ProjectRow[]>;
  createProject(input: Omit<ProjectRow, "id" | "isArchived"> & { ownerUserId?: bigint }): Promise<ProjectRow>;
  getProject(projectId: bigint): Promise<ProjectRow | null>;
  updateProject(projectId: bigint, patch: Partial<Omit<ProjectRow, "id">>): Promise<ProjectRow | null>;
  deleteProject(projectId: bigint): Promise<boolean>;

  listSuitesByProject(projectId: bigint): Promise<SuiteRow[]>;
  createSuite(
    input: Omit<SuiteRow, "id" | "isMaster" | "isBaseline" | "parentSuiteId"> &
      Partial<Pick<SuiteRow, "isMaster" | "isBaseline" | "parentSuiteId">>
  ): Promise<SuiteRow>;
  getSuite(suiteId: bigint): Promise<SuiteRow | null>;
  updateSuite(suiteId: bigint, patch: Partial<Omit<SuiteRow, "id" | "projectId">>): Promise<SuiteRow | null>;
  deleteSuite(suiteId: bigint): Promise<boolean>;

  listSectionsBySuite(suiteId: bigint): Promise<SectionRow[]>;
  createSection(input: Omit<SectionRow, "id">): Promise<SectionRow>;
  updateSection(
    sectionId: bigint,
    patch: Partial<Omit<SectionRow, "id" | "suiteId">>
  ): Promise<SectionRow | null>;
  deleteSection(sectionId: bigint): Promise<boolean>;
  getSection(sectionId: bigint): Promise<SectionRow | null>;

  listCasesForSuite(projectId: bigint, suiteId: bigint, state?: "active" | "archived" | "all"): Promise<CaseRow[]>;
  listCases(params: {
    projectId?: bigint;
    suiteId?: bigint;
    sectionId?: bigint;
    q?: string;
    priority?: string;
    caseType?: string;
    automation?: "manual" | "automated";
    refs?: CasePresenceFilter;
    labels?: CasePresenceFilter;
    estimate?: CasePresenceFilter;
    sectionScope?: "direct" | "subtree";
    state?: "active" | "archived" | "all";
  }): Promise<CaseRow[]>;
  createCase(input: Omit<CaseRow, "id" | "updatedAt" | "lockVersion">): Promise<CaseRow>;
  getCase(caseId: bigint): Promise<CaseRow | null>;
  listCaseSteps(caseId: bigint): Promise<CaseStepRow[]>;
  listCaseScenarios(caseId: bigint): Promise<CaseScenarioRow[]>;
  createCaseScenario(input: {
    caseId: bigint;
    scenarioOrder: number;
    name: string;
    content: string;
  }): Promise<CaseScenarioRow>;
  updateCaseScenario(
    scenarioId: bigint,
    patch: { name?: string; content?: string; scenarioOrder?: number }
  ): Promise<CaseScenarioRow | null>;
  deleteCaseScenario(scenarioId: bigint): Promise<boolean>;
  replaceCaseScenarios(
    caseId: bigint,
    scenarios: Array<{ name: string; content: string }>
  ): Promise<CaseScenarioRow[]>;
  listCaseVersions(caseId: bigint): Promise<CaseVersionRow[]>;
  getCaseVersion(caseId: bigint, versionId: bigint): Promise<CaseVersionRow | null>;
  getCaseVersionByVersionNo(caseId: bigint, versionNo: number): Promise<CaseVersionRow | null>;
  createCaseVersionSnapshot(caseId: bigint, reason?: string): Promise<CaseVersionRow | null>;
  createCaseStep(input: {
    caseId: bigint;
    stepOrder: number;
    content: string;
    expectedResult?: string | null;
  }): Promise<CaseStepRow>;
  updateCaseStep(
    stepId: bigint,
    patch: { content?: string; expectedResult?: string | null; stepOrder?: number }
  ): Promise<CaseStepRow | null>;
  deleteCaseStep(stepId: bigint): Promise<boolean>;
  updateCase(
    caseId: bigint,
    patch: Partial<Omit<CaseRow, "id" | "sectionId" | "updatedAt" | "lockVersion" | "archivedAt">>,
    expectedVersion?: number
  ): Promise<CaseRow | "conflict" | null>;
  setCaseArchived(caseId: bigint, archived: boolean): Promise<CaseRow | "already_archived" | "already_active" | null>;
  moveCase(caseId: bigint, targetSectionId: bigint): Promise<CaseRow | null>;
  deleteCase(caseId: bigint): Promise<boolean>;
}
export class ProjectsRepository {}
