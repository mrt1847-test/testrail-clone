import type { Prisma, PrismaClient } from "@prisma/client";

import {
  compositionNeedsLiveSync,
  parseRunCompositionMetadata,
  toMetadataJson,
  type RunCompositionMetadata
} from "./runComposition.js";
import { resolveDesiredCaseIds } from "./runCompositionFilter.js";
import type { RunsService } from "./runs.service.js";

export type CompositionSyncResult = {
  runId: bigint;
  skipped: boolean;
  added: number;
  removed: number;
  reason?: string;
};

export class RunCompositionSyncService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly runsService: RunsService
  ) {}

  async syncSuite(projectId: bigint, suiteId: bigint): Promise<CompositionSyncResult[]> {
    const runs = await this.prisma.testRun.findMany({
      where: { projectId, suiteId, status: "open", deletedAt: null },
      select: { id: true, metadata: true }
    });
    const out: CompositionSyncResult[] = [];
    for (const run of runs) {
      const meta = parseRunCompositionMetadata(run.metadata);
      if (!compositionNeedsLiveSync(meta)) continue;
      out.push(await this.syncRun(run.id));
    }
    return out;
  }

  async syncRun(runId: bigint): Promise<CompositionSyncResult> {
    const row = await this.prisma.testRun.findFirst({
      where: { id: runId, deletedAt: null },
      select: {
        id: true,
        projectId: true,
        suiteId: true,
        status: true,
        includeAll: true,
        metadata: true
      }
    });
    if (!row) return { runId, skipped: true, added: 0, removed: 0, reason: "not_found" };
    if (row.status === "closed") return { runId, skipped: true, added: 0, removed: 0, reason: "closed" };

    const meta = parseRunCompositionMetadata(row.metadata);
    if (!meta || !compositionNeedsLiveSync(meta)) {
      return { runId, skipped: true, added: 0, removed: 0, reason: "static" };
    }

    const desiredIds = await this.resolveDesiredForRun(row, meta);
    const instances = await this.prisma.testInstance.findMany({
      where: { runId, deletedAt: null },
      select: { id: true, caseId: true }
    });
    const desiredSet = new Set(desiredIds.map((id) => id.toString()));
    const currentByCase = new Map(instances.map((i) => [i.caseId.toString(), i.id]));

    let added = 0;
    const toAdd: bigint[] = [];
    for (const id of desiredIds) {
      if (!currentByCase.has(id.toString())) toAdd.push(id);
    }
    if (toAdd.length > 0) {
      const result = await this.runsService.addCasesToOpenRun(runId, toAdd);
      added = result.added.length;
    }

    let removed = 0;
    for (const inst of instances) {
      if (desiredSet.has(inst.caseId.toString())) continue;
      const resultCount = await this.prisma.testResult.count({ where: { testInstanceId: inst.id } });
      if (resultCount > 0) continue;
      await this.runsService.removeTestFromOpenRun(runId, inst.id, true);
      removed += 1;
    }

    const nextMeta: RunCompositionMetadata = {
      ...meta,
      lastSyncedAt: new Date().toISOString(),
      lastSyncAdded: added,
      lastSyncRemoved: removed
    };
    await this.prisma.testRun.update({
      where: { id: runId },
      data: { metadata: toMetadataJson(nextMeta) as Prisma.InputJsonValue }
    });

    return { runId, skipped: false, added, removed };
  }

  private async resolveDesiredForRun(
    row: { projectId: bigint; suiteId: bigint; includeAll: boolean; metadata: unknown },
    meta: RunCompositionMetadata
  ) {
    const excludedCaseIds = (meta.excludedCaseIds ?? []).map((id) => BigInt(id));
    const includedSectionIds = (meta.includedSectionIds ?? []).map((id) => BigInt(id));
    const excludedSectionIds = (meta.excludedSectionIds ?? []).map((id) => BigInt(id));

    if (meta.compositionMode === "include_all_live") {
      return resolveDesiredCaseIds(this.prisma, {
        projectId: row.projectId,
        suiteId: row.suiteId,
        includeAll: true,
        excludedCaseIds,
        includedSectionIds: includedSectionIds.length ? includedSectionIds : undefined,
        excludedSectionIds: excludedSectionIds.length ? excludedSectionIds : undefined
      });
    }

    return resolveDesiredCaseIds(this.prisma, {
      projectId: row.projectId,
      suiteId: row.suiteId,
      includeAll: false,
      excludedCaseIds,
      includedSectionIds: includedSectionIds.length ? includedSectionIds : undefined,
      excludedSectionIds: excludedSectionIds.length ? excludedSectionIds : undefined,
      filterDefinition: meta.filterDefinition
    });
  }
}
