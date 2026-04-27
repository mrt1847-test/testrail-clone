export type ProjectRow = {
  id: bigint;
  name: string;
  description?: string;
};

export type SuiteRow = {
  id: bigint;
  projectId: bigint;
  name: string;
  description?: string;
};

export type SectionRow = {
  id: bigint;
  suiteId: bigint;
  parentSectionId?: bigint | null;
  name: string;
};

export type CaseRow = {
  id: bigint;
  sectionId: bigint;
  title: string;
  priority?: string;
  caseType?: string;
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
  listCases(params: { projectId?: bigint; sectionId?: bigint; q?: string }): Promise<CaseRow[]>;
  createCase(input: Omit<CaseRow, "id">): Promise<CaseRow>;
  getCase(caseId: bigint): Promise<CaseRow | null>;
  updateCase(caseId: bigint, patch: Partial<Omit<CaseRow, "id" | "sectionId">>): Promise<CaseRow | null>;
  deleteCase(caseId: bigint): Promise<boolean>;
}
export class ProjectsRepository {}
