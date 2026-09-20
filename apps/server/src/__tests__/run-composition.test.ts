import { describe, expect, it } from "vitest";

import { assertRunCreationInput } from "../domain/invariants.js";
import { env } from "../config/env.js";
import {
  compositionNeedsLiveSync,
  defaultCompositionMetadata,
  parseRunCompositionMetadata
} from "../modules/runs/runComposition.js";

describe("run composition metadata", () => {
  it("defaults to static composition", () => {
    expect(defaultCompositionMetadata(true, undefined)).toEqual({ compositionMode: "static" });
    expect(defaultCompositionMetadata(true, "include_all_live").compositionMode).toBe("include_all_live");
  });

  it("detects live sync modes", () => {
    expect(compositionNeedsLiveSync({ compositionMode: "static" })).toBe(false);
    expect(compositionNeedsLiveSync({ compositionMode: "include_all_live" })).toBe(true);
    expect(compositionNeedsLiveSync({ compositionMode: "dynamic_filter" })).toBe(true);
  });

  it("parses metadata from run row JSON", () => {
    const parsed = parseRunCompositionMetadata({
      compositionMode: "dynamic_filter",
      filterDefinition: { priority: "high", state: "active" },
      lastSyncedAt: "2026-05-16T00:00:00.000Z",
      lastSyncAdded: 2,
      lastSyncRemoved: 1
    });
    expect(parsed?.compositionMode).toBe("dynamic_filter");
    expect(parsed?.filterDefinition?.priority).toBe("high");
    expect(parsed?.lastSyncAdded).toBe(2);
  });
});

describe("run composition invariants", () => {
  it("rejects caseIds for dynamic_filter at create", () => {
    expect(() =>
      assertRunCreationInput(false, [1n], undefined, undefined, "dynamic_filter")
    ).toThrow();
  });

  it("allows include_all_live without explicit caseIds", () => {
    expect(() =>
      assertRunCreationInput(true, undefined, undefined, undefined, "include_all_live")
    ).not.toThrow();
  });
});

const integrationEnabled = !env.useInMemoryRepository && Boolean(env.databaseUrl);

describe.skipIf(!integrationEnabled)("run composition API (prisma)", () => {
  it("include_all_live adds new cases on sync", async () => {
    process.env.USE_IN_MEMORY_REPOSITORY = "false";
    const { buildApp } = await import("../app.js");
    const app = buildApp();
    await app.ready();
    try {
      const loginRes = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "admin@example.com", password: "password" }
      });
      expect(loginRes.statusCode).toBe(200);
      const { token } = loginRes.json() as { token: string };
      const headers = { authorization: `Bearer ${token}` };

      const projectRes = await app.inject({
        method: "POST",
        url: "/api/projects",
        headers,
        payload: { name: `Composition ${Date.now()}` }
      });
      const projectId = (projectRes.json() as { data: { id: string } }).data.id;

      const suiteRes = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/suites`,
        headers,
        payload: { name: "Suite" }
      });
      const suiteId = (suiteRes.json() as { data: { id: string } }).data.id;

      const sectionRes = await app.inject({
        method: "POST",
        url: `/api/suites/${suiteId}/sections`,
        headers,
        payload: { name: "Section" }
      });
      const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

      const caseARes = await app.inject({
        method: "POST",
        url: `/api/sections/${sectionId}/cases`,
        headers,
        payload: { title: "Case A", priority: "medium" }
      });
      const caseAId = (caseARes.json() as { data: { id: string } }).data.id;

      const runRes = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/runs`,
        headers,
        payload: {
          suiteId,
          name: "Live include-all",
          includeAll: true,
          compositionMode: "include_all_live"
        }
      });
      expect(runRes.statusCode).toBe(200);
      const runId = (runRes.json() as { run: { id: string } }).run.id;

      const caseBRes = await app.inject({
        method: "POST",
        url: `/api/sections/${sectionId}/cases`,
        headers,
        payload: { title: "Case B", priority: "low" }
      });
      expect(caseBRes.statusCode).toBe(200);

      const syncRes = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/runs/${runId}/sync-composition`,
        headers
      });
      expect(syncRes.statusCode).toBe(200);
      const syncBody = (syncRes.json() as { data: { added: number; skipped: boolean } }).data;
      expect(syncBody.skipped).toBe(false);
      expect(syncBody.added).toBeGreaterThanOrEqual(1);

      const detailRes = await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/runs/${runId}?includeInstances=false`,
        headers
      });
      const composition = (
        detailRes.json() as { data: { run: { composition?: { compositionMode: string } } } }
      ).data.run.composition;
      expect(composition?.compositionMode).toBe("include_all_live");
    } finally {
      await app.close();
    }
  });

  it("skips sync for closed runs", async () => {
    process.env.USE_IN_MEMORY_REPOSITORY = "false";
    const { buildApp } = await import("../app.js");
    const app = buildApp();
    await app.ready();
    try {
      const loginRes = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "admin@example.com", password: "password" }
      });
      const { token } = loginRes.json() as { token: string };
      const headers = { authorization: `Bearer ${token}` };

      const projectRes = await app.inject({
        method: "POST",
        url: "/api/projects",
        headers,
        payload: { name: `Closed composition ${Date.now()}` }
      });
      const projectId = (projectRes.json() as { data: { id: string } }).data.id;

      const suiteRes = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/suites`,
        headers,
        payload: { name: "Suite" }
      });
      const suiteId = (suiteRes.json() as { data: { id: string } }).data.id;

      const sectionRes = await app.inject({
        method: "POST",
        url: `/api/suites/${suiteId}/sections`,
        headers,
        payload: { name: "Section" }
      });
      const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

      await app.inject({
        method: "POST",
        url: `/api/sections/${sectionId}/cases`,
        headers,
        payload: { title: "Case", priority: "medium" }
      });

      const runRes = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/runs`,
        headers,
        payload: {
          suiteId,
          name: "Closed live",
          includeAll: true,
          compositionMode: "include_all_live"
        }
      });
      const runId = (runRes.json() as { run: { id: string } }).run.id;

      const closeRes = await app.inject({
        method: "POST",
        url: `/api/runs/${runId}/close`,
        headers
      });
      expect(closeRes.statusCode).toBe(200);

      const syncRes = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/runs/${runId}/sync-composition`,
        headers
      });
      const syncBody = (syncRes.json() as { data: { skipped: boolean; reason?: string } }).data;
      expect(syncBody.skipped).toBe(true);
      expect(syncBody.reason).toBe("closed");
    } finally {
      await app.close();
    }
  });
});

describe("run composition membership (in-memory)", () => {
  it("All includes new cases on create; Dynamic follows priority; Selected stays fixed", async () => {
    process.env.USE_IN_MEMORY_REPOSITORY = "true";
    const { buildApp } = await import("../app.js");
    const app = buildApp();
    await app.ready();
    try {
      const loginRes = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "admin@example.com", password: "password" }
      });
      expect(loginRes.statusCode).toBe(200);
      const { token } = loginRes.json() as { token: string };
      const headers = { authorization: `Bearer ${token}` };

      const projectRes = await app.inject({
        method: "POST",
        url: "/api/projects",
        headers,
        payload: { name: `UI-058 membership ${Date.now()}` }
      });
      const projectId = (projectRes.json() as { data: { id: string } }).data.id;

      const suitesRes = await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/suites`,
        headers
      });
      const suiteId = (suitesRes.json() as { data: Array<{ id: string; isMaster?: boolean }> }).data.find(
        (suite) => suite.isMaster
      )?.id;
      expect(suiteId).toBeTruthy();

      const sectionRes = await app.inject({
        method: "POST",
        url: `/api/suites/${suiteId}/sections`,
        headers,
        payload: { name: "S1" }
      });
      const sectionId = (sectionRes.json() as { data: { id: string } }).data.id;

      const caseHighRes = await app.inject({
        method: "POST",
        url: `/api/sections/${sectionId}/cases`,
        headers,
        payload: { title: "C-high", priority: "high" }
      });
      const caseHighId = (caseHighRes.json() as { data: { id: string } }).data.id;

      const caseMedRes = await app.inject({
        method: "POST",
        url: `/api/sections/${sectionId}/cases`,
        headers,
        payload: { title: "C-med", priority: "medium" }
      });
      const caseMedId = (caseMedRes.json() as { data: { id: string } }).data.id;

      const allRunRes = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/runs`,
        headers,
        payload: {
          suiteId,
          name: "All live",
          includeAll: true,
          compositionMode: "include_all_live"
        }
      });
      expect(allRunRes.statusCode).toBe(200);
      const allRunId = (allRunRes.json() as { run: { id: string } }).run.id;

      const dynamicRunRes = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/runs`,
        headers,
        payload: {
          suiteId,
          name: "Dynamic high",
          includeAll: false,
          compositionMode: "dynamic_filter",
          filterDefinition: { priority: "high", state: "active" }
        }
      });
      expect(dynamicRunRes.statusCode).toBe(200);
      const dynamicRunId = (dynamicRunRes.json() as { run: { id: string } }).run.id;

      const selectedRunRes = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/runs`,
        headers,
        payload: {
          suiteId,
          name: "Selected fixed",
          includeAll: false,
          caseIds: [caseHighId],
          compositionMode: "static"
        }
      });
      expect(selectedRunRes.statusCode).toBe(200);
      const selectedRunId = (selectedRunRes.json() as { run: { id: string } }).run.id;

      const caseNewAllRes = await app.inject({
        method: "POST",
        url: `/api/sections/${sectionId}/cases`,
        headers,
        payload: { title: "C-new-all", priority: "low" }
      });
      expect(caseNewAllRes.statusCode).toBe(200);
      const caseNewAllId = (caseNewAllRes.json() as { data: { id: string } }).data.id;

      const caseNewHighRes = await app.inject({
        method: "POST",
        url: `/api/sections/${sectionId}/cases`,
        headers,
        payload: { title: "C-new-high", priority: "high" }
      });
      expect(caseNewHighRes.statusCode).toBe(200);
      const caseNewHighId = (caseNewHighRes.json() as { data: { id: string } }).data.id;

      const caseNewLowRes = await app.inject({
        method: "POST",
        url: `/api/sections/${sectionId}/cases`,
        headers,
        payload: { title: "C-new-low", priority: "low" }
      });
      expect(caseNewLowRes.statusCode).toBe(200);
      const caseNewLowId = (caseNewLowRes.json() as { data: { id: string } }).data.id;

      async function instanceCaseIds(runId: string) {
        const res = await app.inject({
          method: "GET",
          url: `/api/projects/${projectId}/runs/${runId}/instances?page=1&pageSize=100`,
          headers
        });
        expect(res.statusCode).toBe(200);
        const items = (res.json() as { data: Array<{ caseId: string }> }).data;
        return items.map((row) => row.caseId).sort();
      }

      const allIds = await instanceCaseIds(allRunId);
      expect(allIds).toEqual(
        [caseHighId, caseMedId, caseNewAllId, caseNewHighId, caseNewLowId].sort()
      );

      const dynamicIds = await instanceCaseIds(dynamicRunId);
      expect(dynamicIds).toEqual([caseHighId, caseNewHighId].sort());
      expect(dynamicIds).not.toContain(caseNewLowId);
      expect(dynamicIds).not.toContain(caseMedId);

      const selectedIds = await instanceCaseIds(selectedRunId);
      expect(selectedIds).toEqual([caseHighId]);

      const selectedInstancesRes = await app.inject({
        method: "GET",
        url: `/api/projects/${projectId}/runs/${selectedRunId}/instances?page=1&pageSize=10`,
        headers
      });
      const selectedTestId = (selectedInstancesRes.json() as { data: Array<{ id: string }> }).data[0]!.id;

      const resultRes = await app.inject({
        method: "POST",
        url: `/api/tests/${selectedTestId}/results`,
        headers,
        payload: { status: "passed", comment: "keep me" }
      });
      expect(resultRes.statusCode).toBe(200);

      const syncSelected = await app.inject({
        method: "POST",
        url: `/api/projects/${projectId}/runs/${selectedRunId}/sync-composition`,
        headers
      });
      expect(syncSelected.statusCode).toBe(200);
      const syncSelectedBody = (syncSelected.json() as { data: { skipped: boolean; reason?: string } }).data;
      expect(syncSelectedBody.skipped).toBe(true);
      expect(syncSelectedBody.reason).toBe("static");
      expect(await instanceCaseIds(selectedRunId)).toEqual([caseHighId]);

      const history = await app.inject({
        method: "GET",
        url: `/api/tests/${selectedTestId}/results`,
        headers
      });
      expect(history.statusCode).toBe(200);
      const historyBody = history.json() as { data: { total?: number; items?: unknown[] } };
      const historyCount = historyBody.data.total ?? historyBody.data.items?.length ?? 0;
      expect(historyCount).toBeGreaterThanOrEqual(1);
    } finally {
      await app.close();
    }
  });
});
