type Project = {
  id: bigint;
  name: string;
  description?: string;
};

type Suite = {
  id: bigint;
  projectId: bigint;
  name: string;
  description?: string;
};

type Section = {
  id: bigint;
  suiteId: bigint;
  parentSectionId?: bigint | null;
  name: string;
};

type CaseRow = {
  id: bigint;
  sectionId: bigint;
  title: string;
  priority?: string;
  caseType?: string;
};

export class ProjectsMemoryRepository {
  private projectSeq = 1n;
  private suiteSeq = 1n;
  private sectionSeq = 1n;
  private caseSeq = 1n;

  private readonly projects: Project[] = [];
  private readonly suites: Suite[] = [];
  private readonly sections: Section[] = [];
  private readonly cases: CaseRow[] = [];

  listProjects() {
    return [...this.projects];
  }
  createProject(input: Omit<Project, "id">) {
    const row: Project = { id: this.projectSeq++, ...input };
    this.projects.push(row);
    return row;
  }
  getProject(projectId: bigint) {
    return this.projects.find((p) => p.id === projectId) ?? null;
  }
  updateProject(projectId: bigint, patch: Partial<Omit<Project, "id">>) {
    const row = this.projects.find((p) => p.id === projectId);
    if (!row) return null;
    Object.assign(row, patch);
    return row;
  }
  deleteProject(projectId: bigint) {
    const idx = this.projects.findIndex((p) => p.id === projectId);
    if (idx === -1) return false;
    this.projects.splice(idx, 1);
    return true;
  }

  listSuitesByProject(projectId: bigint) {
    return this.suites.filter((s) => s.projectId === projectId);
  }
  createSuite(input: Omit<Suite, "id">) {
    const row: Suite = { id: this.suiteSeq++, ...input };
    this.suites.push(row);
    return row;
  }
  getSuite(suiteId: bigint) {
    return this.suites.find((s) => s.id === suiteId) ?? null;
  }
  updateSuite(suiteId: bigint, patch: Partial<Omit<Suite, "id" | "projectId">>) {
    const row = this.suites.find((s) => s.id === suiteId);
    if (!row) return null;
    Object.assign(row, patch);
    return row;
  }
  deleteSuite(suiteId: bigint) {
    const idx = this.suites.findIndex((s) => s.id === suiteId);
    if (idx === -1) return false;
    this.suites.splice(idx, 1);
    return true;
  }

  listSectionsBySuite(suiteId: bigint) {
    return this.sections.filter((s) => s.suiteId === suiteId);
  }
  createSection(input: Omit<Section, "id">) {
    const row: Section = { id: this.sectionSeq++, ...input };
    this.sections.push(row);
    return row;
  }
  updateSection(sectionId: bigint, patch: Partial<Omit<Section, "id" | "suiteId">>) {
    const row = this.sections.find((s) => s.id === sectionId);
    if (!row) return null;
    Object.assign(row, patch);
    return row;
  }
  deleteSection(sectionId: bigint) {
    const idx = this.sections.findIndex((s) => s.id === sectionId);
    if (idx === -1) return false;
    this.sections.splice(idx, 1);
    return true;
  }
  getSection(sectionId: bigint) {
    return this.sections.find((s) => s.id === sectionId) ?? null;
  }

  /** 스위트에 속한 섹션들의 케이스만 반환 (런 생성 시 카탈로그와 정합) */
  listCasesForSuite(projectId: bigint, suiteId: bigint) {
    const suite = this.getSuite(suiteId);
    if (!suite || suite.projectId !== projectId) return [];
    const sectionIds = new Set(this.sections.filter((s) => s.suiteId === suiteId).map((s) => s.id));
    return this.cases.filter((c) => sectionIds.has(c.sectionId));
  }

  listCases(params: { projectId?: bigint; sectionId?: bigint; q?: string }) {
    const suiteIds = params.projectId
      ? this.suites.filter((s) => s.projectId === params.projectId).map((s) => s.id)
      : null;
    const sectionIdsByProject = suiteIds
      ? this.sections.filter((sec) => suiteIds.includes(sec.suiteId)).map((sec) => sec.id)
      : null;

    return this.cases.filter((c) => {
      if (params.sectionId && c.sectionId !== params.sectionId) return false;
      if (sectionIdsByProject && !sectionIdsByProject.includes(c.sectionId)) return false;
      if (params.q && !c.title.toLowerCase().includes(params.q.toLowerCase())) return false;
      return true;
    });
  }
  createCase(input: Omit<CaseRow, "id">) {
    const row: CaseRow = { id: this.caseSeq++, ...input };
    this.cases.push(row);
    return row;
  }
  getCase(caseId: bigint) {
    return this.cases.find((c) => c.id === caseId) ?? null;
  }
  updateCase(caseId: bigint, patch: Partial<Omit<CaseRow, "id" | "sectionId">>) {
    const row = this.cases.find((c) => c.id === caseId);
    if (!row) return null;
    Object.assign(row, patch);
    return row;
  }
  deleteCase(caseId: bigint) {
    const idx = this.cases.findIndex((c) => c.id === caseId);
    if (idx === -1) return false;
    this.cases.splice(idx, 1);
    return true;
  }
}
