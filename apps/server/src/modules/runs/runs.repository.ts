import type { ResultInput } from "../results/results.types.js";
import { testStatuses, type TestStatus } from "../../domain/status.js";
import type { ProjectsMemoryRepository } from "../projects/projects.memory.repository.js";
import type { TestCase, TestInstance, TestRun } from "./runs.types.js";

function mapCatalogCaseToTestCase(
  c: { id: bigint; sectionId: bigint; title: string; priority?: string; caseType?: string },
  projectId: bigint,
  suiteId: bigint
): TestCase {
  return {
    id: c.id,
    projectId,
    suiteId,
    title: c.title,
    priority: c.priority ?? null,
    caseType: c.caseType ?? null,
    estimate: null,
    automationKey: null,
    externalId: null
  };
}

export type Tx = {
  createRun(input: {
    projectId: bigint;
    suiteId: bigint;
    name: string;
    includeAll: boolean;
  }): Promise<TestRun>;
  getCasesForRun(input: {
    projectId: bigint;
    suiteId: bigint;
    caseIds?: bigint[];
    includeAll: boolean;
  }): Promise<TestCase[]>;
  createInstances(instances: Omit<TestInstance, "id" | "status">[]): Promise<TestInstance[]>;
  getInstancesByRunId(runId: bigint): Promise<Array<Pick<TestInstance, "status">>>;
  getTestInstanceById(testId: bigint): Promise<TestInstance | null>;
  getTestInstanceByCaseInRun(runId: bigint, caseId: bigint): Promise<TestInstance | null>;
  createResult(
    testInstanceId: bigint,
    input: ResultInput
  ): Promise<{ id: bigint; testInstanceId: bigint; status: TestStatus }>;
  createResultSteps(resultId: bigint, steps: NonNullable<ResultInput["stepResults"]>): Promise<void>;
  updateInstanceStatus(testInstanceId: bigint, status: TestStatus): Promise<void>;
};

export interface RunsRepository {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  listRunsByProject(projectId: bigint): Promise<TestRun[]>;
  getRun(runId: bigint): Promise<TestRun | null>;
  listInstancesForRun(runId: bigint): Promise<TestInstance[]>;
}

type ResultRow = { id: bigint; testInstanceId: bigint; status: TestStatus };

export class InMemoryRunsRepository implements RunsRepository {
  constructor(private readonly catalog?: ProjectsMemoryRepository) {}

  private runSeq = 1n;
  private instanceSeq = 1n;
  private resultSeq = 1n;
  private runs: TestRun[] = [];
  private cases: TestCase[] = [
    {
      id: 101n,
      projectId: 1n,
      suiteId: 1n,
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

  async listRunsByProject(projectId: bigint): Promise<TestRun[]> {
    return [...this.runs.filter((r) => r.projectId === projectId)].sort((a, b) => (a.id < b.id ? 1 : -1));
  }

  async getRun(runId: bigint): Promise<TestRun | null> {
    return this.runs.find((r) => r.id === runId) ?? null;
  }

  async listInstancesForRun(runId: bigint): Promise<TestInstance[]> {
    return this.instances.filter((i) => i.runId === runId);
  }

  async transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return fn({
      createRun: async (input) => {
        const run: TestRun = { id: this.runSeq++, status: "open", ...input };
        this.runs.push(run);
        return run;
      },
      getCasesForRun: async ({ projectId, suiteId, caseIds, includeAll }) => {
        const base = this.cases.filter((c) => c.projectId === projectId && c.suiteId === suiteId);
        let selected = includeAll ? base : base.filter((c) => caseIds?.includes(c.id));
        if (selected.length === 0 && this.catalog) {
          const rows = this.catalog.listCasesForSuite(projectId, suiteId);
          selected = rows.map((c) => mapCatalogCaseToTestCase(c, projectId, suiteId));
          if (!includeAll && caseIds?.length) {
            selected = selected.filter((c) => caseIds.includes(c.id));
          }
        }
        return selected;
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
      getInstancesByRunId: async (runId) =>
        this.instances.filter((i) => i.runId === runId).map((i) => ({ status: i.status })),
      getTestInstanceById: async (testId) => this.instances.find((i) => i.id === testId) ?? null,
      getTestInstanceByCaseInRun: async (runId, caseId) =>
        this.instances.find((i) => i.runId === runId && i.caseId === caseId) ?? null,
      createResult: async (testInstanceId, input: ResultInput) => {
        if (!testStatuses.includes(input.status)) throw new Error("invalid status");
        const row = { id: this.resultSeq++, testInstanceId, status: input.status };
        this.results.push(row);
        return row;
      },
      createResultSteps: async () => undefined,
      updateInstanceStatus: async (testInstanceId, status) => {
        const instance = this.instances.find((i) => i.id === testInstanceId);
        if (instance) instance.status = status;
      }
    });
  }
}
