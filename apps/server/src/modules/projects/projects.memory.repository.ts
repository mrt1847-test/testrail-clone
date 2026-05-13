import type {
  CaseRow,
  CasePresenceFilter,
  CaseStepRow,
  CaseVersionRow,
  ProjectRow,
  ProjectsRepository,
  SectionRow,
  SuiteRow
} from "./projects.repository.js";

type StoredCaseStep = CaseStepRow & { caseId: bigint };

function normalizeSearchTerm(value: string | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function caseMatchesSearch(row: CaseRow, q: string | undefined) {
  const needle = normalizeSearchTerm(q);
  if (!needle) return true;
  const customValues = Object.values(row.customValues ?? {})
    .filter((value) => value != null && String(value).trim().length > 0)
    .map((value) => String(value).toLowerCase());
  const haystacks = [
    row.title,
    row.refs ?? "",
    row.automationKey ?? "",
    row.externalId ?? "",
    `c${row.id.toString()}`,
    ...(row.labels ?? []),
    ...customValues
  ].map((value) => value.toLowerCase());
  return haystacks.some((value) => value.includes(needle));
}

function hasText(value: string | null | undefined) {
  return value != null && value.trim().length > 0;
}

function hasLabels(value: string[] | undefined) {
  return (value ?? []).some((label) => label.trim().length > 0);
}

function matchesPresence(hasValue: boolean, filter: CasePresenceFilter | undefined) {
  if (filter === "with") return hasValue;
  if (filter === "without") return !hasValue;
  return true;
}

function compareCaseOrder(left: CaseRow, right: CaseRow) {
  return (left.displayOrder ?? 0) - (right.displayOrder ?? 0) || Number(left.id - right.id);
}

function compareSectionOrder(left: SectionRow, right: SectionRow) {
  return (left.displayOrder ?? 0) - (right.displayOrder ?? 0) || Number(left.id - right.id);
}

export class ProjectsMemoryRepository implements ProjectsRepository {
  private projectSeq = 1n;
  private suiteSeq = 1n;
  private sectionSeq = 1n;
  private caseSeq = 1n;
  private stepSeq = 1n;

  private readonly projects: ProjectRow[] = [];
  private readonly suites: SuiteRow[] = [];
  private readonly sections: SectionRow[] = [];
  private readonly cases: CaseRow[] = [];
  private readonly caseSteps: StoredCaseStep[] = [];
  private readonly caseVersions: CaseVersionRow[] = [];
  private caseVersionSeq = 1n;

  /** Per-case promise chain: same idea as locking the parent row before assigning versionNo. */
  private caseSnapshotChain = new Map<string, Promise<unknown>>();

  private runCaseSnapshotExclusive<T>(caseId: bigint, fn: () => Promise<T>): Promise<T> {
    const key = caseId.toString();
    const prev = this.caseSnapshotChain.get(key) ?? Promise.resolve();
    const next = prev.then(() => fn());
    this.caseSnapshotChain.set(key, next);
    void next.finally(() => {
      if (this.caseSnapshotChain.get(key) === next) {
        this.caseSnapshotChain.delete(key);
      }
    });
    return next as Promise<T>;
  }

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
    return this.sections.filter((s) => s.suiteId === suiteId).sort(compareSectionOrder);
  }
  async createSection(input: Omit<SectionRow, "id">) {
    const lastOrder = this.sections
      .filter((s) => s.suiteId === input.suiteId && (s.parentSectionId ?? null) === (input.parentSectionId ?? null))
      .reduce((max, row) => Math.max(max, row.displayOrder ?? 0), -1);
    const row: SectionRow = { id: this.sectionSeq++, ...input, displayOrder: input.displayOrder ?? lastOrder + 1 };
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
  async listCasesForSuite(projectId: bigint, suiteId: bigint, state: "active" | "archived" | "all" = "active") {
    const suite = await this.getSuite(suiteId);
    if (!suite || suite.projectId !== projectId) return [];
    const sectionIds = new Set(this.sections.filter((s) => s.suiteId === suiteId).map((s) => s.id));
    return this.cases
      .filter((c) => {
        if (!sectionIds.has(c.sectionId)) return false;
        if (state === "archived") return c.archivedAt != null;
        if (state === "all") return true;
        return c.archivedAt == null;
      })
      .sort(compareCaseOrder);
  }

  async listCases(params: {
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
  }) {
    const suiteIds = params.projectId
      ? this.suites.filter((s) => s.projectId === params.projectId).map((s) => s.id)
      : null;
    const sectionIdsByProject = suiteIds
      ? this.sections.filter((sec) => suiteIds.includes(sec.suiteId)).map((sec) => sec.id)
      : null;
    let sectionSubtreeIds: Set<bigint> | null = null;
    if (params.sectionId) {
      const root = this.sections.find((section) => section.id === params.sectionId);
      if (!root) return [];
      if ((params.sectionScope ?? "subtree") === "direct") {
        sectionSubtreeIds = new Set<bigint>([params.sectionId]);
      } else {
        const children = new Map<bigint | null, bigint[]>();
        for (const section of this.sections) {
          if (section.suiteId !== root.suiteId) continue;
          const parent = section.parentSectionId ?? null;
          const list = children.get(parent);
          if (list) list.push(section.id);
          else children.set(parent, [section.id]);
        }
        sectionSubtreeIds = new Set<bigint>();
        const stack: bigint[] = [params.sectionId];
        while (stack.length > 0) {
          const current = stack.pop()!;
          if (sectionSubtreeIds.has(current)) continue;
          sectionSubtreeIds.add(current);
          const kids = children.get(current) ?? [];
          for (const kid of kids) stack.push(kid);
        }
      }
    }

    return this.cases
      .filter((c) => {
        if (sectionSubtreeIds && !sectionSubtreeIds.has(c.sectionId)) return false;
        if (params.suiteId) {
          const section = this.sections.find((s) => s.id === c.sectionId);
          if (!section || section.suiteId !== params.suiteId) return false;
        }
        if (sectionIdsByProject && !sectionIdsByProject.includes(c.sectionId)) return false;
        if ((params.state ?? "active") === "archived" && c.archivedAt == null) return false;
        if ((params.state ?? "active") === "active" && c.archivedAt != null) return false;
        if (params.priority && (c.priority ?? "").toLowerCase() !== params.priority.toLowerCase()) return false;
        if (params.caseType && (c.caseType ?? "").toLowerCase() !== params.caseType.toLowerCase()) return false;
        if (params.automation === "automated" && !c.automationKey) return false;
        if (params.automation === "manual" && c.automationKey) return false;
        if (!matchesPresence(hasText(c.refs), params.refs)) return false;
        if (!matchesPresence(hasLabels(c.labels), params.labels)) return false;
        if (!matchesPresence(hasText(c.estimate), params.estimate)) return false;
        if (!caseMatchesSearch(c, params.q)) return false;
        return true;
      })
      .sort((left, right) => {
        if (left.sectionId !== right.sectionId) return Number(left.sectionId - right.sectionId);
        return compareCaseOrder(left, right);
      });
  }
  async createCase(input: Omit<CaseRow, "id" | "updatedAt" | "lockVersion">) {
    const lastOrder = this.cases
      .filter((c) => c.sectionId === input.sectionId)
      .reduce((max, row) => Math.max(max, row.displayOrder ?? 0), -1);
    const row: CaseRow = {
      id: this.caseSeq++,
      ...input,
      displayOrder: input.displayOrder ?? lastOrder + 1,
      labels: input.labels ?? [],
      lockVersion: 1,
      updatedAt: new Date(),
      archivedAt: input.archivedAt ?? null
    };
    this.cases.push(row);
    return row;
  }
  async getCase(caseId: bigint) {
    return this.cases.find((c) => c.id === caseId) ?? null;
  }
  async listCaseSteps(caseId: bigint): Promise<CaseStepRow[]> {
    return this.caseSteps
      .filter((s) => s.caseId === caseId)
      .sort((a, b) => a.stepOrder - b.stepOrder)
      .map(({ id, stepOrder, content, expectedResult }) => ({ id, stepOrder, content, expectedResult }));
  }

  async listCaseVersions(caseId: bigint): Promise<CaseVersionRow[]> {
    return this.caseVersions
      .filter((v) => v.caseId === caseId)
      .sort((a, b) => b.versionNo - a.versionNo);
  }

  async getCaseVersion(caseId: bigint, versionId: bigint): Promise<CaseVersionRow | null> {
    return this.caseVersions.find((v) => v.caseId === caseId && v.id === versionId) ?? null;
  }

  async createCaseVersionSnapshot(caseId: bigint, reason?: string): Promise<CaseVersionRow | null> {
    return this.runCaseSnapshotExclusive(caseId, async () => {
      const current = this.cases.find((c) => c.id === caseId);
      if (!current) return null;
      const stepsSnapshot = this.caseSteps
        .filter((s) => s.caseId === caseId)
        .sort((a, b) => a.stepOrder - b.stepOrder)
        .map((s) => ({ stepOrder: s.stepOrder, content: s.content, expectedResult: s.expectedResult ?? null }));
      const latest = this.caseVersions
        .filter((v) => v.caseId === caseId)
        .sort((a, b) => b.versionNo - a.versionNo)[0];
      const sig = JSON.stringify({
        title: current.title,
        priority: current.priority ?? null,
        caseType: current.caseType ?? null,
        preconditions: current.preconditions ?? null,
        customValues: current.customValues ?? {},
        stepsSnapshot
      });
      if (latest) {
        const latestSig = JSON.stringify({
          title: latest.title,
          priority: latest.priority ?? null,
          caseType: latest.caseType ?? null,
          preconditions: latest.preconditions ?? null,
          customValues: latest.customValuesSnapshot ?? {},
          stepsSnapshot: latest.stepsSnapshot
        });
        if (sig === latestSig) return null;
      }
      const next: CaseVersionRow = {
        id: this.caseVersionSeq++,
        caseId,
        versionNo: (latest?.versionNo ?? 0) + 1,
        title: current.title,
        priority: current.priority ?? null,
        caseType: current.caseType ?? null,
        preconditions: current.preconditions ?? null,
        customValuesSnapshot: current.customValues ?? {},
        stepsSnapshot,
        changeReason: reason ?? null,
        createdAt: new Date()
      };
      this.caseVersions.push(next);
      return next;
    });
  }

  async createCaseStep(input: {
    caseId: bigint;
    stepOrder: number;
    content: string;
    expectedResult?: string | null;
  }): Promise<CaseStepRow> {
    const c = this.cases.find((row) => row.id === input.caseId);
    if (!c) {
      throw new Error("case not found");
    }
    const row: StoredCaseStep = {
      id: this.stepSeq++,
      caseId: input.caseId,
      stepOrder: input.stepOrder,
      content: input.content,
      expectedResult: input.expectedResult ?? null
    };
    this.caseSteps.push(row);
    return { id: row.id, stepOrder: row.stepOrder, content: row.content, expectedResult: row.expectedResult };
  }

  async updateCaseStep(
    stepId: bigint,
    patch: { content?: string; expectedResult?: string | null; stepOrder?: number }
  ): Promise<CaseStepRow | null> {
    const row = this.caseSteps.find((s) => s.id === stepId);
    if (!row) return null;
    if (patch.content !== undefined) row.content = patch.content;
    if (patch.expectedResult !== undefined) row.expectedResult = patch.expectedResult;
    if (patch.stepOrder !== undefined && patch.stepOrder !== row.stepOrder) {
      const forCase = this.caseSteps.filter((s) => s.caseId === row.caseId).sort((a, b) => a.stepOrder - b.stepOrder);
      const rest = forCase.filter((s) => s.id !== stepId);
      const targetPos = Math.min(Math.max(1, patch.stepOrder), forCase.length);
      const idx = targetPos - 1;
      const reordered = [...rest.slice(0, idx), row, ...rest.slice(idx)];
      reordered.forEach((s, i) => {
        s.stepOrder = i + 1;
      });
    }
    return { id: row.id, stepOrder: row.stepOrder, content: row.content, expectedResult: row.expectedResult };
  }

  async deleteCaseStep(stepId: bigint): Promise<boolean> {
    const row = this.caseSteps.find((s) => s.id === stepId);
    if (!row) return false;
    const caseId = row.caseId;
    const idx = this.caseSteps.findIndex((s) => s.id === stepId);
    this.caseSteps.splice(idx, 1);
    const remaining = this.caseSteps.filter((s) => s.caseId === caseId).sort((a, b) => a.stepOrder - b.stepOrder);
    remaining.forEach((s, i) => {
      s.stepOrder = i + 1;
    });
    return true;
  }

  async updateCase(
    caseId: bigint,
    patch: Partial<Omit<CaseRow, "id" | "sectionId" | "updatedAt" | "lockVersion" | "archivedAt">>,
    expectedVersion?: number
  ) {
    const row = this.cases.find((c) => c.id === caseId);
    if (!row) return null;
    if (expectedVersion !== undefined && row.lockVersion !== expectedVersion) return "conflict";
    Object.assign(row, patch);
    row.lockVersion += 1;
    row.updatedAt = new Date();
    return row;
  }
  async setCaseArchived(caseId: bigint, archived: boolean) {
    const row = this.cases.find((c) => c.id === caseId);
    if (!row) return null;
    if (archived && row.archivedAt != null) return "already_archived";
    if (!archived && row.archivedAt == null) return "already_active";
    row.archivedAt = archived ? new Date() : null;
    row.lockVersion += 1;
    row.updatedAt = new Date();
    return row;
  }
  async moveCase(caseId: bigint, targetSectionId: bigint) {
    const row = this.cases.find((c) => c.id === caseId);
    const targetSection = this.sections.find((section) => section.id === targetSectionId);
    if (!row || !targetSection) return null;
    const lastOrder = this.cases
      .filter((c) => c.sectionId === targetSectionId && c.id !== caseId)
      .reduce((max, item) => Math.max(max, item.displayOrder ?? 0), -1);
    row.sectionId = targetSectionId;
    row.displayOrder = lastOrder + 1;
    row.lockVersion += 1;
    row.updatedAt = new Date();
    return row;
  }
  async deleteCase(caseId: bigint) {
    const idx = this.cases.findIndex((c) => c.id === caseId);
    if (idx === -1) return false;
    this.cases.splice(idx, 1);
    for (let i = this.caseSteps.length - 1; i >= 0; i -= 1) {
      if (this.caseSteps[i]!.caseId === caseId) this.caseSteps.splice(i, 1);
    }
    return true;
  }
}
