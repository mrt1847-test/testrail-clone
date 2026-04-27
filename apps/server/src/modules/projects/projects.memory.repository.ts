import type { CaseRow, ProjectRow, ProjectsRepository, SectionRow, SuiteRow } from "./projects.repository.js";

export class ProjectsMemoryRepository implements ProjectsRepository {
  private projectSeq = 1n;
  private suiteSeq = 1n;
  private sectionSeq = 1n;
  private caseSeq = 1n;

  private readonly projects: ProjectRow[] = [];
  private readonly suites: SuiteRow[] = [];
  private readonly sections: SectionRow[] = [];
  private readonly cases: CaseRow[] = [];

  async listProjects() {
    return [...this.projects];
  }
  async createProject(input: Omit<ProjectRow, "id"> & { ownerUserId?: bigint }) {
    const row: ProjectRow = { id: this.projectSeq++, ...input };
    this.projects.push(row);
    return row;
  }
  async getProject(projectId: bigint) {
    return this.projects.find((p) => p.id === projectId) ?? null;
  }
  async updateProject(projectId: bigint, patch: Partial<Omit<ProjectRow, "id">>) {
    const row = this.projects.find((p) => p.id === projectId);
    if (!row) return null;
    Object.assign(row, patch);
    return row;
  }
  async deleteProject(projectId: bigint) {
    const idx = this.projects.findIndex((p) => p.id === projectId);
    if (idx === -1) return false;
    this.projects.splice(idx, 1);
    return true;
  }

  async listSuitesByProject(projectId: bigint) {
    return this.suites.filter((s) => s.projectId === projectId);
  }
  async createSuite(input: Omit<SuiteRow, "id">) {
    const row: SuiteRow = { id: this.suiteSeq++, ...input };
    this.suites.push(row);
    return row;
  }
  async getSuite(suiteId: bigint) {
    return this.suites.find((s) => s.id === suiteId) ?? null;
  }
  async updateSuite(suiteId: bigint, patch: Partial<Omit<SuiteRow, "id" | "projectId">>) {
    const row = this.suites.find((s) => s.id === suiteId);
    if (!row) return null;
    Object.assign(row, patch);
    return row;
  }
  async deleteSuite(suiteId: bigint) {
    const idx = this.suites.findIndex((s) => s.id === suiteId);
    if (idx === -1) return false;
    this.suites.splice(idx, 1);
    return true;
  }

  async listSectionsBySuite(suiteId: bigint) {
    return this.sections.filter((s) => s.suiteId === suiteId);
  }
  async createSection(input: Omit<SectionRow, "id">) {
    const row: SectionRow = { id: this.sectionSeq++, ...input };
    this.sections.push(row);
    return row;
  }
  async updateSection(sectionId: bigint, patch: Partial<Omit<SectionRow, "id" | "suiteId">>) {
    const row = this.sections.find((s) => s.id === sectionId);
    if (!row) return null;
    Object.assign(row, patch);
    return row;
  }
  async deleteSection(sectionId: bigint) {
    const idx = this.sections.findIndex((s) => s.id === sectionId);
    if (idx === -1) return false;
    this.sections.splice(idx, 1);
    return true;
  }
  async getSection(sectionId: bigint) {
    return this.sections.find((s) => s.id === sectionId) ?? null;
  }

  /** 스위트에 속한 섹션들의 케이스만 반환 (런 생성 시 카탈로그와 정합) */
  async listCasesForSuite(projectId: bigint, suiteId: bigint) {
    const suite = await this.getSuite(suiteId);
    if (!suite || suite.projectId !== projectId) return [];
    const sectionIds = new Set(this.sections.filter((s) => s.suiteId === suiteId).map((s) => s.id));
    return this.cases.filter((c) => sectionIds.has(c.sectionId));
  }

  async listCases(params: { projectId?: bigint; sectionId?: bigint; q?: string }) {
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
  async createCase(input: Omit<CaseRow, "id">) {
    const row: CaseRow = { id: this.caseSeq++, ...input };
    this.cases.push(row);
    return row;
  }
  async getCase(caseId: bigint) {
    return this.cases.find((c) => c.id === caseId) ?? null;
  }
  async updateCase(caseId: bigint, patch: Partial<Omit<CaseRow, "id" | "sectionId">>) {
    const row = this.cases.find((c) => c.id === caseId);
    if (!row) return null;
    Object.assign(row, patch);
    return row;
  }
  async deleteCase(caseId: bigint) {
    const idx = this.cases.findIndex((c) => c.id === caseId);
    if (idx === -1) return false;
    this.cases.splice(idx, 1);
    return true;
  }
}
