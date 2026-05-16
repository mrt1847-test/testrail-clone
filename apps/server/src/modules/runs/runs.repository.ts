import { AppError } from "../../common/errors/appError.js";
import type { ResultInput } from "../results/results.types.js";
import { testStatuses, type TestStatus } from "../../domain/status.js";
import type { ProjectsRepository } from "../projects/projects.repository.js";
import { expandSectionSubtreeIdsPure } from "./sectionScope.js";
import type { TestCase, TestInstance, TestRun } from "./runs.types.js";

type ResultCustomValues = Record<string, string | number | boolean | null>;

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
    externalId: c.externalId ?? null
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
  updateInstanceStatus(testInstanceId: bigint, status: TestStatus): Promise<void>;
  closeRun(runId: bigint): Promise<void>;
  updateRun(runId: bigint, input: { name?: string; assignedTo?: bigint | null }): Promise<void>;
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
  closeRun(runId: bigint): Promise<TestRun | null>;
  reopenRun(runId: bigint): Promise<TestRun | null>;
  updateRun(runId: bigint, input: { name?: string; assignedTo?: bigint | null }): Promise<TestRun | null>;
  updateTestAssignee(testId: bigint, assignedTo: bigint | null): Promise<TestInstance | null>;
  listAssignedTests(input: {
    projectId: bigint;
    userId: bigint;
  }): Promise<
    Array<{
      testId: bigint;
      runId: bigint;
      runName: string;
      caseId: bigint;
      title: string;
      status: TestStatus;
      assignedTo: bigint | null;
    }>
  >;
}

type ResultRow = {
  id: bigint;
  testInstanceId: bigint;
  status: TestStatus;
  comment?: string;
  elapsed?: string;
  version?: string;
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

export class InMemoryRunsRepository implements RunsRepository {
  constructor(private readonly catalog?: ProjectsRepository) {}

  private runSeq = 1n;
  private instanceSeq = 1n;
  private resultSeq = 1n;
  private resultStepSeq = 1n;
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
      externalId: null
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
      externalId: null
    }
  ];
  private instances: TestInstance[] = [];
  private results: ResultRow[] = [];
  private resultSteps: ResultStepRow[] = [];

  async listRunsByProject(projectId: bigint): Promise<TestRun[]> {
    return [...this.runs.filter((r) => r.projectId === projectId)].sort((a, b) => (a.id < b.id ? 1 : -1));
  }

  async getRun(runId: bigint): Promise<TestRun | null> {
    return this.runs.find((r) => r.id === runId) ?? null;
  }

  async listInstancesForRun(runId: bigint): Promise<TestInstance[]> {
    return this.instances.filter((i) => i.runId === runId);
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
    return {
      items: rows.slice(start, start + input.pageSize),
      total: rows.length
    };
  }

  async transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return fn({
      createRun: async (input) => {
        const run: TestRun = {
          id: this.runSeq++,
          status: "open",
          milestoneId: input.milestoneId ?? null,
          assignedTo: input.assignedTo ?? null,
          environment: input.environment ?? null,
          ...input
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
      updateInstanceStatus: async (testInstanceId, status) => {
        const instance = this.instances.find((i) => i.id === testInstanceId);
        if (instance) instance.status = status;
      },
      closeRun: async (runId) => {
        const run = this.runs.find((r) => r.id === runId);
        if (!run) return;
        run.status = "closed";
      },
      updateRun: async (runId, input) => {
        const run = this.runs.find((r) => r.id === runId);
        if (!run) return;
        if (input.name !== undefined) run.name = input.name;
        if (input.assignedTo !== undefined) run.assignedTo = input.assignedTo;
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
    return run;
  }

  async reopenRun(runId: bigint): Promise<TestRun | null> {
    const run = this.runs.find((item) => item.id === runId);
    if (!run) return null;
    run.status = "open";
    return run;
  }

  async updateRun(runId: bigint, input: { name?: string; assignedTo?: bigint | null }): Promise<TestRun | null> {
    const run = this.runs.find((item) => item.id === runId);
    if (!run) return null;
    if (input.name !== undefined) {
      run.name = input.name;
    }
    if (input.assignedTo !== undefined) {
      run.assignedTo = input.assignedTo;
    }
    return run;
  }

  async updateTestAssignee(testId: bigint, assignedTo: bigint | null): Promise<TestInstance | null> {
    const instance = this.instances.find((item) => item.id === testId);
    if (!instance) return null;
    instance.assignedTo = assignedTo;
    return instance;
  }

  async listAssignedTests(input: { projectId: bigint; userId: bigint }) {
    const runMap = new Map(this.runs.filter((run) => run.projectId === input.projectId).map((run) => [run.id, run]));
    const caseMap = new Map(this.cases.map((c) => [c.id, c]));
    return this.instances
      .filter((instance) => instance.assignedTo === input.userId && runMap.has(instance.runId))
      .map((instance) => {
        const run = runMap.get(instance.runId)!;
        const testCase = caseMap.get(instance.caseId);
        return {
          testId: instance.id,
          runId: run.id,
          runName: run.name,
          caseId: instance.caseId,
          title: testCase?.title ?? instance.titleSnapshot,
          status: instance.status,
          assignedTo: instance.assignedTo
        };
      });
  }
}
