export type ProjectRow = {
  id: bigint;
  name: string;
  description?: string | null;
};

export type SuiteRow = {
  id: bigint;
  projectId: bigint;
  name: string;
  description?: string | null;
};

export type SectionRow = {
  id: bigint;
  suiteId: bigint;
  parentSectionId?: bigint | null;
  name: string;
};

export type CaseRow = {
  id: bigint;
  projectId?: bigint;
  sectionId: bigint;
  title: string;
  priority?: string | null;
  caseType?: string | null;
  preconditions?: string | null;
  customValues?: Record<string, string | number | boolean | null>;
  lockVersion: number;
  updatedAt: Date;
};

export type CaseStepRow = {
  id: bigint;
  stepOrder: number;
  content: string;
  expectedResult?: string | null;
};

export type CaseVersionRow = {
  id: bigint;
  caseId: bigint;
  versionNo: number;
  title: string;
  priority?: string | null;
  caseType?: string | null;
  preconditions?: string | null;
  customValuesSnapshot?: Record<string, string | number | boolean | null>;
  stepsSnapshot: Array<{ stepOrder: number; content: string; expectedResult?: string | null }>;
  changeReason?: string | null;
  createdAt: Date;
};

export interface ProjectsRepository {
  listProjects(): Promise<ProjectRow[]>;
  createProject(input: Omit<ProjectRow, "id"> & { ownerUserId?: bigint }): Promise<ProjectRow>;
  getProject(projectId: bigint): Promise<ProjectRow | null>;
  updateProject(projectId: bigint, patch: Partial<Omit<ProjectRow, "id">>): Promise<ProjectRow | null>;
  deleteProject(projectId: bigint): Promise<boolean>;

  listSuitesByProject(projectId: bigint): Promise<SuiteRow[]>;
  createSuite(input: Omit<SuiteRow, "id">): Promise<SuiteRow>;
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

  listCasesForSuite(projectId: bigint, suiteId: bigint): Promise<CaseRow[]>;
  listCases(params: { projectId?: bigint; suiteId?: bigint; sectionId?: bigint; q?: string }): Promise<CaseRow[]>;
  createCase(input: Omit<CaseRow, "id" | "updatedAt" | "lockVersion">): Promise<CaseRow>;
  getCase(caseId: bigint): Promise<CaseRow | null>;
  listCaseSteps(caseId: bigint): Promise<CaseStepRow[]>;
  listCaseVersions(caseId: bigint): Promise<CaseVersionRow[]>;
  getCaseVersion(caseId: bigint, versionId: bigint): Promise<CaseVersionRow | null>;
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
    patch: Partial<Omit<CaseRow, "id" | "sectionId" | "updatedAt" | "lockVersion">>,
    expectedVersion?: number
  ): Promise<CaseRow | "conflict" | null>;
  deleteCase(caseId: bigint): Promise<boolean>;
}
export class ProjectsRepository {}
