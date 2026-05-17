import { AppError } from "../../common/errors/appError.js";
import type { ResultInput } from "../results/results.types.js";
import { testStatuses, type TestStatus } from "../../domain/status.js";
import type { ProjectsRepository } from "../projects/projects.repository.js";
import { parseRunCompositionMetadata, type RunCompositionMetadata } from "./runComposition.js";
import type { RunCompositionScope } from "./runCompositionFilter.js";
import { expandSectionSubtreeIdsPure } from "./sectionScope.js";
import type { TestCase, TestInstance, TestRun } from "./runs.types.js";
import { enrichTestInstancesWithCaseChange } from "./instanceCaseChange.js";
import type { LiveCaseFields } from "../../domain/testCaseChangeIndicator.js";
import type { CustomFieldValue } from "../../domain/customFieldTypes.js";
import { assignmentAgingForRow } from "./assignmentListFilters.js";

type ResultCustomValues = Record<string, CustomFieldValue>;

function mapCatalogCaseToTestCase(
  c: {
    id: bigint;
    sectionId: bigint;
    title: string;
    priority?: string | null;
    caseType?: string | null;
    estimate?: string | null;
    automationKey?: string | null;
    externalId?: string | null;
    lockVersion?: number;
    updatedAt?: Date;
  },
  projectId: bigint,
  suiteId: bigint
): TestCase {
  return {
    id: c.id,
    projectId,
    suiteId,
    sectionId: c.sectionId,
    title: c.title,
    priority: c.priority ?? null,
    caseType: c.caseType ?? null,
    estimate: c.estimate ?? null,
    automationKey: c.automationKey ?? null,
    externalId: c.externalId ?? null,
    lockVersion: c.lockVersion ?? 1,
    updatedAt: c.updatedAt
  };
}

export type Tx = {
  createRun(input: {
    projectId: bigint;
    suiteId: bigint;
    milestoneId?: bigint | null;
    name: string;
    includeAll: boolean;
    assignedTo?: bigint | null;
    environment?: string | null;
    metadata?: Record<string, unknown>;
    startedAt?: Date | null;
    dueOn?: Date | null;
  }): Promise<TestRun>;
  getCasesForRun(input: {
    projectId: bigint;
    suiteId: bigint;
    caseIds?: bigint[];
    excludedCaseIds?: bigint[];
    includeAll: boolean;
    includedSectionIds?: bigint[];
    excludedSectionIds?: bigint[];
    compositionMode?: import("./runComposition.js").CompositionMode;
    filterDefinition?: import("./runComposition.js").RunCaseFilterDefinition;
  }): Promise<TestCase[]>;
  countResultsForTestInstance(testInstanceId: bigint): Promise<number>;
  hardDeleteTestInstance(testInstanceId: bigint): Promise<void>;
  createInstances(instances: Omit<TestInstance, "id" | "status">[]): Promise<TestInstance[]>;
  getRunById(runId: bigint): Promise<TestRun | null>;
  getInstancesByRunId(runId: bigint): Promise<Array<Pick<TestInstance, "status">>>;
  getTestInstanceById(testId: bigint): Promise<TestInstance | null>;
  getTestInstanceByCaseInRun(runId: bigint, caseId: bigint): Promise<TestInstance | null>;
  createResult(
    testInstanceId: bigint,
    input: ResultInput
  ): Promise<{ id: bigint; testInstanceId: bigint; status: TestStatus }>;
  createResultSteps(resultId: bigint, steps: NonNullable<ResultInput["stepResults"]>): Promise<void>;
  createResultScenarios(
    resultId: bigint,
    scenarios: NonNullable<ResultInput["scenarioResults"]>
  ): Promise<void>;
  listResultScenariosByResultId(resultId: bigint): Promise<
    Array<{
      id: bigint;
      caseScenarioId: bigint;
      status: TestStatus;
      comment?: string | null;
    }>
  >;
  updateInstanceStatus(testInstanceId: bigint, status: TestStatus): Promise<void>;
  closeRun(runId: bigint): Promise<void>;
  updateRun(
    runId: bigint,
    input: { name?: string; assignedTo?: bigint | null; startedAt?: Date | null; dueOn?: Date | null; closedAt?: Date | null }
  ): Promise<void>;
  updateTestAssignee(testId: bigint, assignedTo: bigint | null): Promise<void>;
  getResultsByTestInstanceId(testId: bigint): Promise<
    Array<{
      id: bigint;
      testInstanceId: bigint;
      status: TestStatus;
      comment?: string;
      elapsed?: string;
      version?: string;
      defects: string[];
      customValues?: ResultCustomValues;
      source: "manual" | "automation" | "api";
      createdAt: Date;
    }>
  >;
  getResultStepsByResultId(resultId: bigint): Promise<
    Array<{
      id: bigint;
      resultId: bigint;
      stepOrder: number;
      status: TestStatus;
      actualResult?: string;
      comment?: string;
      createdAt: Date;
    }>
  >;
};

export interface RunsRepository {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  listRunsByProject(projectId: bigint): Promise<TestRun[]>;
  getRun(runId: bigint): Promise<TestRun | null>;
  listInstancesForRun(runId: bigint): Promise<TestInstance[]>;
  listInstancesForRunPage(input: {
    runId: bigint;
    page: number;
    pageSize: number;
    status?: TestStatus;
    assignedTo?: bigint | null;
    q?: string;
  }): Promise<{ items: TestInstance[]; total: number }>;
  listResultsForTestInstance(testId: bigint): Promise<
    Array<{
      id: bigint;
      testInstanceId: bigint;
      status: TestStatus;
      comment?: string;
      elapsed?: string;
      version?: string;
      defects: string[];
      customValues?: ResultCustomValues;
      source: "manual" | "automation" | "api";
      createdAt: Date;
    }>
  >;
  listResultsForTestInstancePage(
    testId: bigint,
    page: number,
    pageSize: number
  ): Promise<{
    items: Array<{
      id: bigint;
      testInstanceId: bigint;
      status: TestStatus;
      comment?: string;
      elapsed?: string;
      version?: string;
      defects: string[];
      customValues?: ResultCustomValues;
      source: "manual" | "automation" | "api";
      createdAt: Date;
    }>;
    total: number;
  }>;
  listResultStepsByResultId(resultId: bigint): Promise<
    Array<{
      id: bigint;
      resultId: bigint;
      stepOrder: number;
      status: TestStatus;
      actualResult?: string;
      comment?: string;
      createdAt: Date;
    }>
  >;
  listResultScenariosByResultId(resultId: bigint): Promise<
    Array<{
      id: bigint;
      caseScenarioId: bigint;
      status: TestStatus;
      comment?: string | null;
    }>
  >;
  closeRun(runId: bigint): Promise<TestRun | null>;
  reopenRun(runId: bigint): Promise<TestRun | null>;
  updateRun(
    runId: bigint,
    input: { name?: string; assignedTo?: bigint | null; startedAt?: Date | null; dueOn?: Date | null; closedAt?: Date | null }
  ): Promise<TestRun | null>;
  updateRunComposition(
    runId: bigint,
    metadata: import("./runComposition.js").RunCompositionMetadata
  ): Promise<TestRun | null>;
  resolveFilterCaseIds(input: import("./runCompositionFilter.js").RunCompositionScope): Promise<bigint[]>;
  listSuiteCaseIds(projectId: bigint, suiteId: bigint): Promise<bigint[]>;
  updateTestAssignee(testId: bigint, assignedTo: bigint | null): Promise<TestInstance | null>;
  listAssignedTests(input: import("./assignmentListFilters.js").AssignmentListFilters & {
    projectId: bigint;
    userId: bigint;
  }): Promise<import("./assignmentListFilters.js").AssignmentTestRow[]>;
  listTeamTodoTests(
    input: import("./assignmentListFilters.js").AssignmentListFilters & {
      projectId: bigint;
      assigneeId?: bigint | "all";
    }
  ): Promise<import("./assignmentListFilters.js").AssignmentTestRow[]>;
}

type ResultRow = {
  id: bigint;
  testInstanceId: bigint;
  status: TestStatus;
  comment?: string;
  elapsed?: string;
  version?: string;
  aiActualOutput?: string | null;
  aiQualityRating?: number | null;
  aiLatencyMs?: number | null;
  aiTraces?: string | null;
  defects: string[];
  customValues?: ResultCustomValues;
  source: "manual" | "automation" | "api";
  metadata?: Record<string, unknown>;
  createdAt: Date;
};
type ResultStepRow = {
  id: bigint;
  resultId: bigint;
  stepOrder: number;
  status: TestStatus;
  actualResult?: string;
  comment?: string;
  createdAt: Date;
};
type ResultScenarioRow = {
  id: bigint;
  resultId: bigint;
  caseScenarioId: bigint;
  status: TestStatus;
  comment?: string;
  createdAt: Date;
};

export class InMemoryRunsRepository implements RunsRepository {
  constructor(private readonly catalog?: ProjectsRepository) {}

  private runSeq = 1n;
  private instanceSeq = 1n;
  private resultSeq = 1n;
  private resultStepSeq = 1n;
  private resultScenarioSeq = 1n;
  private runs: TestRun[] = [];
  private cases: TestCase[] = [
    {
      id: 101n,
      projectId: 1n,
      suiteId: 1n,
      sectionId: 1n,
      title: "Add product to cart",
      priority: "high",
      caseType: "functional",
      estimate: "1m",
      automationKey: "MWEB-CART-001",
      externalId: null,
      lockVersion: 1
    },
    {
      id: 102n,
      projectId: 1n,
      suiteId: 1n,
      sectionId: 1n,
      title: "Checkout returns 200",
      priority: "high",
      caseType: "functional",
      estimate: "2m",
      automationKey: "MWEB-CHECKOUT-001",
      externalId: null,
      lockVersion: 1
    }
  ];
  private instances: TestInstance[] = [];
  private results: ResultRow[] = [];
  private resultSteps: ResultStepRow[] = [];
  private resultScenarios: ResultScenarioRow[] = [];

  async listRunsByProject(projectId: bigint): Promise<TestRun[]> {
    return [...this.runs.filter((r) => r.projectId === projectId)].sort((a, b) => (a.id < b.id ? 1 : -1));
  }

  async getRun(runId: bigint): Promise<TestRun | null> {
    return this.runs.find((r) => r.id === runId) ?? null;
  }

  private enrichMemoryInstances(runId: bigint, instances: TestInstance[]): TestInstance[] {
    const run = this.runs.find((r) => r.id === runId);
    const casesById = new Map<bigint, LiveCaseFields>();
    for (const inst of instances) {
      if (casesById.has(inst.caseId)) continue;
      const row = this.cases.find((c) => c.id === inst.caseId);
      if (!row) continue;
      casesById.set(inst.caseId, {
        lockVersion: row.lockVersion ?? 1,
        title: row.title,
        priority: row.priority,
        caseType: row.caseType,
        automationKey: row.automationKey,
        externalId: row.externalId,
        updatedAt: row.updatedAt ?? new Date(0)
      });
    }
    return enrichTestInstancesWithCaseChange(instances, casesById, run?.createdAt ?? null);
  }

  async listInstancesForRun(runId: bigint): Promise<TestInstance[]> {
    const rows = this.instances.filter((i) => i.runId === runId);
    return this.enrichMemoryInstances(runId, rows);
  }

  async listInstancesForRunPage(input: {
    runId: bigint;
    page: number;
    pageSize: number;
    status?: TestStatus;
    assignedTo?: bigint | null;
    q?: string;
  }): Promise<{ items: TestInstance[]; total: number }> {
    const q = input.q?.toLowerCase();
    const rows = this.instances.filter((i) => {
      if (i.runId !== input.runId) return false;
      if (input.status && i.status !== input.status) return false;
      if (input.assignedTo !== undefined && i.assignedTo !== input.assignedTo) return false;
      if (!q) return true;
      return (
        i.titleSnapshot.toLowerCase().includes(q) ||
        `c${i.caseId.toString()}`.toLowerCase().includes(q)
      );
    });
    const start = (input.page - 1) * input.pageSize;
    const pageRows = rows.slice(start, start + input.pageSize);
    return {
      items: this.enrichMemoryInstances(input.runId, pageRows),
      total: rows.length
    };
  }

  async transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return fn({
      createRun: async (input) => {
        const { metadata, ...rest } = input;
        const run: TestRun = {
          id: this.runSeq++,
          status: "open",
          milestoneId: rest.milestoneId ?? null,
          assignedTo: rest.assignedTo ?? null,
          environment: rest.environment ?? null,
          startedAt: rest.startedAt ?? null,
          dueOn: rest.dueOn ?? null,
          closedAt: null,
          createdAt: new Date(),
          composition: parseRunCompositionMetadata(metadata ?? null),
          ...rest
        };
        this.runs.push(run);
        return run;
      },
      getCasesForRun: async (input) => {
        const { projectId, suiteId, caseIds, excludedCaseIds, includeAll, includedSectionIds, excludedSectionIds } = input;
        let sectionRows: Array<{ id: bigint; parentSectionId: bigint | null }> = [];
        if (this.catalog && (includedSectionIds?.length || excludedSectionIds?.length)) {
          const sec = await this.catalog.listSectionsBySuite(suiteId);
          sectionRows = sec.map((s) => ({ id: s.id, parentSectionId: s.parentSectionId ?? null }));
        } else if (!this.catalog && (includedSectionIds?.length || excludedSectionIds?.length)) {
          const baseSec = this.cases.filter((c) => c.projectId === projectId && c.suiteId === suiteId);
          const ids = new Set(baseSec.map((c) => c.sectionId).filter((x): x is bigint => typeof x === "bigint"));
          sectionRows = [...ids].map((id) => ({ id, parentSectionId: null }));
        }
        if (includedSectionIds?.length || excludedSectionIds?.length) {
          const merged = [...(includedSectionIds ?? []), ...(excludedSectionIds ?? [])];
          for (const id of merged) {
            if (!sectionRows.some((s) => s.id === id)) {
              throw new AppError("VALIDATION_ERROR", "includedSectionIds or excludedSectionIds must belong to the run suite", 400);
            }
          }
        }
        const allowed = includedSectionIds?.length
          ? new Set(expandSectionSubtreeIdsPure(sectionRows, includedSectionIds))
          : null;
        const excludedSet = excludedSectionIds?.length
          ? new Set(expandSectionSubtreeIdsPure(sectionRows, excludedSectionIds))
          : null;
        const filterBySection = (c: TestCase) => {
          const sid = c.sectionId;
          if (allowed && (sid == null || !allowed.has(sid))) return false;
          if (excludedSet && sid != null && excludedSet.has(sid)) return false;
          return true;
        };
        const base = this.cases.filter((c) => c.projectId === projectId && c.suiteId === suiteId);
        let selected = includeAll
          ? base.filter((c) => !excludedCaseIds?.includes(c.id)).filter(filterBySection)
          : base.filter((c) => caseIds?.includes(c.id)).filter(filterBySection);
        if (selected.length === 0 && this.catalog) {
          const rows = await this.catalog.listCasesForSuite(projectId, suiteId);
          selected = rows.map((c) => mapCatalogCaseToTestCase(c, projectId, suiteId));
          if (!includeAll && caseIds?.length) {
            selected = selected.filter((c) => caseIds.includes(c.id));
          } else if (includeAll && excludedCaseIds?.length) {
            selected = selected.filter((c) => !excludedCaseIds.includes(c.id));
          }
          selected = selected.filter(filterBySection);
        }
        return selected;
      },
      countResultsForTestInstance: async (testInstanceId) => {
        return this.results.filter((r) => r.testInstanceId === testInstanceId).length;
      },
      hardDeleteTestInstance: async (testInstanceId) => {
        const idx = this.instances.findIndex((i) => i.id === testInstanceId);
        if (idx === -1) return;
        this.instances.splice(idx, 1);
        const resultIds = this.results.filter((r) => r.testInstanceId === testInstanceId).map((r) => r.id);
        this.results = this.results.filter((r) => r.testInstanceId !== testInstanceId);
        this.resultSteps = this.resultSteps.filter((s) => !resultIds.includes(s.resultId));
      },
      createInstances: async (instancesInput) => {
        const created = instancesInput.map((i) => ({
          id: this.instanceSeq++,
          status: "untested" as const,
          ...i
        }));
        this.instances.push(...created);
        return created;
      },
      getRunById: async (runId) => this.runs.find((r) => r.id === runId) ?? null,
      getInstancesByRunId: async (runId) =>
        this.instances.filter((i) => i.runId === runId).map((i) => ({ status: i.status })),
      getTestInstanceById: async (testId) => this.instances.find((i) => i.id === testId) ?? null,
      getTestInstanceByCaseInRun: async (runId, caseId) =>
        this.instances.find((i) => i.runId === runId && i.caseId === caseId) ?? null,
      createResult: async (testInstanceId, input: ResultInput) => {
        if (!testStatuses.includes(input.status)) throw new Error("invalid status");
        const row: ResultRow = {
          id: this.resultSeq++,
          testInstanceId,
          status: input.status,
          comment: input.comment,
          elapsed: input.elapsed,
          version: input.version,
          aiActualOutput: input.aiActualOutput ?? null,
          aiQualityRating: input.aiQualityRating ?? null,
          aiLatencyMs: input.aiLatencyMs ?? null,
          aiTraces: input.aiTraces ?? null,
          defects: input.defects ?? [],
          customValues: input.customValues ?? {},
          source: input.source ?? "manual",
          metadata: input.metadata,
          createdAt: new Date()
        };
        this.results.push(row);
        return row;
      },
      createResultSteps: async (resultId, steps) => {
        for (const item of steps) {
          this.resultSteps.push({
            id: this.resultStepSeq++,
            resultId,
            stepOrder: item.stepOrder,
            status: item.status,
            actualResult: item.actualResult,
            comment: item.comment,
            createdAt: new Date()
          });
        }
      },
      createResultScenarios: async (resultId, scenarios) => {
        for (const item of scenarios) {
          this.resultScenarios.push({
            id: this.resultScenarioSeq++,
            resultId,
            caseScenarioId: item.caseScenarioId,
            status: item.status,
            comment: item.comment,
            createdAt: new Date()
          });
        }
      },
      listResultScenariosByResultId: async (resultId) =>
        this.resultScenarios
          .filter((row) => row.resultId === resultId)
          .map((row) => ({
            id: row.id,
            caseScenarioId: row.caseScenarioId,
            status: row.status,
            comment: row.comment ?? null
          })),
      updateInstanceStatus: async (testInstanceId, status) => {
        const instance = this.instances.find((i) => i.id === testInstanceId);
        if (instance) instance.status = status;
      },
      closeRun: async (runId) => {
        const run = this.runs.find((r) => r.id === runId);
        if (!run) return;
        run.status = "closed";
        run.closedAt = new Date();
      },
      updateRun: async (runId, input) => {
        const run = this.runs.find((r) => r.id === runId);
        if (!run) return;
        if (input.name !== undefined) run.name = input.name;
        if (input.assignedTo !== undefined) run.assignedTo = input.assignedTo;
        if (input.startedAt !== undefined) run.startedAt = input.startedAt;
        if (input.dueOn !== undefined) run.dueOn = input.dueOn;
        if (input.closedAt !== undefined) run.closedAt = input.closedAt;
      },
      updateTestAssignee: async (testId, assignedTo) => {
        const instance = this.instances.find((i) => i.id === testId);
        if (instance) instance.assignedTo = assignedTo;
      },
      getResultsByTestInstanceId: async (testId) => {
        return this.results
          .filter((row) => row.testInstanceId === testId)
          .sort((a, b) => (a.id < b.id ? 1 : -1));
      },
      getResultStepsByResultId: async (resultId) =>
        this.resultSteps
          .filter((row) => row.resultId === resultId)
          .sort((a, b) => a.stepOrder - b.stepOrder)
    });
  }

  async listResultStepsByResultId(resultId: bigint) {
    return this.resultSteps
      .filter((row) => row.resultId === resultId)
      .sort((a, b) => a.stepOrder - b.stepOrder);
  }

  async listResultScenariosByResultId(resultId: bigint) {
    return this.resultScenarios
      .filter((row) => row.resultId === resultId)
      .map((row) => ({
        id: row.id,
        caseScenarioId: row.caseScenarioId,
        status: row.status,
        comment: row.comment ?? null
      }));
  }

  async listResultsForTestInstance(testId: bigint) {
    return this.results
      .filter((row) => row.testInstanceId === testId)
      .sort((a, b) => (a.id < b.id ? 1 : -1));
  }

  async listResultsForTestInstancePage(testId: bigint, page: number, pageSize: number) {
    const sorted = this.results
      .filter((row) => row.testInstanceId === testId)
      .sort((a, b) => (a.id < b.id ? 1 : -1));
    const total = sorted.length;
    const start = (page - 1) * pageSize;
    return { items: sorted.slice(start, start + pageSize), total };
  }

  async closeRun(runId: bigint): Promise<TestRun | null> {
    const run = this.runs.find((item) => item.id === runId);
    if (!run) return null;
    run.status = "closed";
    run.closedAt = new Date();
    return run;
  }

  async reopenRun(runId: bigint): Promise<TestRun | null> {
    const run = this.runs.find((item) => item.id === runId);
    if (!run) return null;
    run.status = "open";
    run.closedAt = null;
    return run;
  }

  async updateRun(
    runId: bigint,
    input: { name?: string; assignedTo?: bigint | null; startedAt?: Date | null; dueOn?: Date | null; closedAt?: Date | null }
  ): Promise<TestRun | null> {
    const run = this.runs.find((item) => item.id === runId);
    if (!run) return null;
    if (input.name !== undefined) {
      run.name = input.name;
    }
    if (input.assignedTo !== undefined) {
      run.assignedTo = input.assignedTo;
    }
    if (input.startedAt !== undefined) {
      run.startedAt = input.startedAt;
    }
    if (input.dueOn !== undefined) {
      run.dueOn = input.dueOn;
    }
    if (input.closedAt !== undefined) {
      run.closedAt = input.closedAt;
    }
    return run;
  }

  async updateRunComposition(runId: bigint, metadata: RunCompositionMetadata): Promise<TestRun | null> {
    const run = this.runs.find((item) => item.id === runId);
    if (!run) return null;
    run.composition = metadata;
    return run;
  }

  async resolveFilterCaseIds(input: RunCompositionScope): Promise<bigint[]> {
    let rows: TestCase[] = this.cases.filter(
      (row) => row.projectId === input.projectId && row.suiteId === input.suiteId
    );
    if (this.catalog) {
      const catalogRows = await this.catalog.listCasesForSuite(input.projectId, input.suiteId);
      rows = catalogRows.map((row) => mapCatalogCaseToTestCase(row, input.projectId, input.suiteId));
    }
    const filter = input.filterDefinition;
    return rows
      .filter((row) => {
        if (filter?.priority && row.priority !== filter.priority) return false;
        return true;
      })
      .map((row) => row.id);
  }

  async listSuiteCaseIds(projectId: bigint, suiteId: bigint): Promise<bigint[]> {
    if (this.catalog) {
      const rows = await this.catalog.listCasesForSuite(projectId, suiteId);
      return rows.map((row) => row.id);
    }
    return this.cases.filter((row) => row.projectId === projectId && row.suiteId === suiteId).map((row) => row.id);
  }

  async updateTestAssignee(testId: bigint, assignedTo: bigint | null): Promise<TestInstance | null> {
    const instance = this.instances.find((item) => item.id === testId);
    if (!instance) return null;
    instance.assignedTo = assignedTo;
    return instance;
  }

  async listAssignedTests(input: import("./assignmentListFilters.js").AssignmentListFilters & {
    projectId: bigint;
    userId: bigint;
  }) {
    const { matchesAssignmentListFiltersInMemory } = await import("./assignmentListFilters.js");
    const runMap = new Map(this.runs.filter((run) => run.projectId === input.projectId).map((run) => [run.id, run]));
    const caseMap = new Map(this.cases.map((c) => [c.id, c]));
    const q = input.q?.trim().toLowerCase();
    return this.instances
      .filter((instance) => {
        if (instance.assignedTo !== input.userId || !runMap.has(instance.runId)) return false;
        const run = runMap.get(instance.runId)!;
        if (input.status && instance.status !== input.status) return false;
        if (input.runId && instance.runId !== input.runId) return false;
        if (!matchesAssignmentListFiltersInMemory(run, input)) return false;
        if (!q) return true;
        const testCase = caseMap.get(instance.caseId);
        const title = testCase?.title ?? instance.titleSnapshot;
        return `${title} ${instance.caseId} ${run.name}`.toLowerCase().includes(q);
      })
      .map((instance) => this.mapInMemoryAssignmentRow(instance, runMap, caseMap));
  }

  async listTeamTodoTests(
    input: import("./assignmentListFilters.js").AssignmentListFilters & {
      projectId: bigint;
      assigneeId?: bigint | "all";
    }
  ) {
    const { matchesAssignmentListFiltersInMemory } = await import("./assignmentListFilters.js");
    const runMap = new Map(this.runs.filter((run) => run.projectId === input.projectId).map((run) => [run.id, run]));
    const caseMap = new Map(this.cases.map((c) => [c.id, c]));
    const q = input.q?.trim().toLowerCase();
    return this.instances
      .filter((instance) => {
        if (!instance.assignedTo || !runMap.has(instance.runId)) return false;
        if (input.assigneeId && input.assigneeId !== "all" && instance.assignedTo !== input.assigneeId) return false;
        if (input.status && instance.status !== input.status) return false;
        if (input.runId && instance.runId !== input.runId) return false;
        const run = runMap.get(instance.runId)!;
        if (!matchesAssignmentListFiltersInMemory(run, input)) return false;
        if (!q) return true;
        const testCase = caseMap.get(instance.caseId);
        const title = testCase?.title ?? instance.titleSnapshot;
        return `${title} ${instance.caseId} ${run.name}`.toLowerCase().includes(q);
      })
      .map((instance) => this.mapInMemoryAssignmentRow(instance, runMap, caseMap, true));
  }

  private mapInMemoryAssignmentRow(
    instance: TestInstance,
    runMap: Map<bigint, TestRun>,
    caseMap: Map<bigint, TestCase>,
    includeAssignee = false
  ): import("./assignmentListFilters.js").AssignmentTestRow {
    const run = runMap.get(instance.runId)!;
    const testCase = caseMap.get(instance.caseId);
    const assigneeId = instance.assignedTo!;
    const runDueOn = run.dueOn ?? null;
    const status = instance.status;
    return {
      testId: instance.id,
      runId: run.id,
      runName: run.name,
      caseId: instance.caseId,
      title: testCase?.title ?? instance.titleSnapshot,
      status,
      assignedTo: instance.assignedTo,
      runDueOn,
      milestoneId: run.milestoneId ?? null,
      milestoneName: null,
      agingLevel: assignmentAgingForRow({
        status,
        runDueOn,
        updatedAt: new Date()
      }),
      assignee: includeAssignee
        ? {
            id: assigneeId,
            name: `User ${assigneeId.toString()}`,
            email: `user-${assigneeId.toString()}@local`
          }
        : null
    };
  }
}
