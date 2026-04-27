import { describe, expect, it } from "vitest";

import { calculateRunSummary } from "../modules/reports/reports.service.js";
import { ResultsService } from "../modules/results/results.service.js";
import { InMemoryRunsRepository } from "../modules/runs/runs.repository.js";
import { RunsService } from "../modules/runs/runs.service.js";

describe("phase1 services", () => {
  it("createRunWithInstances creates run and instances", async () => {
    const repo = new InMemoryRunsRepository();
    const runService = new RunsService(repo);
    const created = await runService.createRunWithInstances({
      projectId: 1n,
      suiteId: 1n,
      name: "Regression",
      includeAll: true
    });
    expect(created.run.id).toBeDefined();
    expect(created.instances.length).toBeGreaterThan(0);
  });

  it("addResultForCaseInRun updates summary counts", async () => {
    const repo = new InMemoryRunsRepository();
    const runService = new RunsService(repo);
    const resultService = new ResultsService(repo);
    const { run } = await runService.createRunWithInstances({
      projectId: 1n,
      suiteId: 1n,
      name: "Run-1",
      includeAll: true
    });
    await resultService.addResultForCaseInRun(run.id, 101n, { status: "passed" });
    const summary = await calculateRunSummary(repo, run.id);
    expect(summary.counts.passed).toBe(1);
  });

  it("bulkAddResults supports partial failure when atomic=false", async () => {
    const repo = new InMemoryRunsRepository();
    const runService = new RunsService(repo);
    const resultService = new ResultsService(repo);
    const { run } = await runService.createRunWithInstances({
      projectId: 1n,
      suiteId: 1n,
      name: "Run-2",
      includeAll: true
    });
    const res = await resultService.bulkAddResults({
      runId: run.id,
      atomic: false,
      results: [
        { caseId: 101n, status: "passed" },
        { caseId: 999n, status: "failed" }
      ]
    });
    expect(res.saved).toBe(1);
    expect(res.failed).toBe(1);
  });
});
