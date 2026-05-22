import type { PrismaClient } from "@prisma/client";

import { parseCaseRefs } from "../../domain/caseRefs.js";
import {
  resolveReferenceUrl,
  type DefectIntegrationForRefs
} from "../../domain/referenceUrls.js";

export type DefectIntegrationRow = DefectIntegrationForRefs & {
  projectId: bigint;
  provider: string;
  createMode: string;
  apiBaseUrl: string | null;
  apiToken: string | null;
};

const inMemorySettings = new Map<string, DefectIntegrationRow>();

export function defaultDefectIntegration(projectId: bigint): DefectIntegrationRow {
  return {
    projectId,
    provider: "custom",
    isEnabled: false,
    createMode: "url_template",
    issueUrlTemplate: null,
    defaultProjectKey: null,
    apiBaseUrl: null,
    apiToken: null
  };
}

export function getInMemoryDefectIntegration(projectId: bigint): DefectIntegrationRow {
  return inMemorySettings.get(projectId.toString()) ?? defaultDefectIntegration(projectId);
}

export function setInMemoryDefectIntegration(row: DefectIntegrationRow) {
  inMemorySettings.set(row.projectId.toString(), row);
}

export async function loadDefectIntegration(
  projectId: bigint,
  prisma?: PrismaClient
): Promise<DefectIntegrationRow> {
  if (!prisma) {
    return getInMemoryDefectIntegration(projectId);
  }
  const row = await prisma.defectIntegrationSetting.findFirst({
    where: { projectId, deletedAt: null }
  });
  return {
    projectId,
    provider: row?.provider ?? "custom",
    isEnabled: row?.isEnabled ?? false,
    createMode: row?.createMode ?? "url_template",
    issueUrlTemplate: row?.issueUrlTemplate ?? null,
    defaultProjectKey: row?.defaultProjectKey ?? null,
    apiBaseUrl: row?.apiBaseUrl ?? null,
    apiToken: row?.apiToken ?? null
  };
}

export function toDefectIntegrationPublicResponse(row: DefectIntegrationRow) {
  return {
    projectId: row.projectId,
    provider: row.provider,
    isEnabled: row.isEnabled,
    createMode: row.createMode,
    issueUrlTemplate: row.issueUrlTemplate,
    defaultProjectKey: row.defaultProjectKey,
    apiBaseUrl: row.apiBaseUrl,
    hasApiToken: Boolean(row.apiToken?.trim())
  };
}

function synthesizedKeys(setting: DefectIntegrationForRefs, q: string, limit: number): string[] {
  if (!setting.isEnabled) return [];
  const needle = q.trim();
  if (needle.length < 1) return [];
  const prefix = setting.defaultProjectKey?.trim().toUpperCase();
  const out: string[] = [];
  if (prefix && needle.toUpperCase().startsWith(prefix)) {
    for (let i = 1; i <= 99 && out.length < limit; i++) {
      const key = `${prefix}-${i}`;
      if (key.toUpperCase().includes(needle.toUpperCase())) out.push(key);
    }
  }
  if (/^[A-Za-z][A-Za-z0-9_]*-\d*$/.test(needle) && !out.includes(needle)) {
    out.unshift(needle);
  }
  return [...new Set(out)].slice(0, limit);
}

export type RecentDefectItem = { key: string; label: string; url: string | null; lastUsedAt: string };

function mergeRecentDefectKeys(
  rows: Array<{ key: string; createdAt: Date; url?: string | null }>,
  limit: number
) {
  const byKey = new Map<string, { createdAt: Date; url: string | null }>();
  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing || row.createdAt > existing.createdAt) {
      byKey.set(key, { createdAt: row.createdAt, url: row.url ?? null });
    }
  }
  return [...byKey.entries()]
    .sort((a, b) => b[1].createdAt.getTime() - a[1].createdAt.getTime())
    .slice(0, limit)
    .map(([key, meta]) => ({ key, createdAt: meta.createdAt, url: meta.url }));
}

export async function listRecentDefectKeys(
  projectId: bigint,
  limit: number,
  prisma: PrismaClient | undefined,
  setting: DefectIntegrationForRefs
): Promise<RecentDefectItem[]> {
  const capped = Math.min(Math.max(limit, 1), 25);
  const collected: Array<{ key: string; createdAt: Date; url?: string | null }> = [];

  if (prisma) {
    const links = await prisma.resultDefectLink.findMany({
      where: {
        deletedAt: null,
        result: {
          instance: {
            run: { projectId, deletedAt: null }
          }
        }
      },
      select: { defectKey: true, url: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    for (const link of links) {
      collected.push({ key: link.defectKey, createdAt: link.createdAt, url: link.url });
    }

    const results = await prisma.testResult.findMany({
      where: {
        instance: {
          run: { projectId, deletedAt: null }
        },
        defects: { isEmpty: false }
      },
      select: { defects: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 150
    });
    for (const result of results) {
      for (const key of result.defects) {
        const trimmed = key.trim();
        if (trimmed) collected.push({ key: trimmed, createdAt: result.createdAt });
      }
    }
  } else {
    const { listAllInMemoryResultDefectLinks } = await import("../results/resultDefectLinks.memory.js");
    for (const link of listAllInMemoryResultDefectLinks()) {
      collected.push({ key: link.defectKey, createdAt: link.createdAt, url: link.url });
    }
  }

  return mergeRecentDefectKeys(collected, capped).map((row) => ({
    key: row.key,
    label: row.key,
    url: resolveReferenceUrl(row.key, setting) ?? row.url,
    lastUsedAt: row.createdAt.toISOString()
  }));
}

export async function searchIssueKeys(
  projectId: bigint,
  q: string,
  limit: number,
  prisma: PrismaClient | undefined,
  setting: DefectIntegrationForRefs
): Promise<Array<{ key: string; label: string; url: string | null }>> {
  const capped = Math.min(Math.max(limit, 1), 25);
  const needle = q.trim().toLowerCase();
  if (!setting.isEnabled || needle.length < 1) return [];

  const keys = new Set<string>();

  if (prisma) {
    const rows = await prisma.testCase.findMany({
      where: { projectId, deletedAt: null, refs: { not: null } },
      select: { refs: true },
      take: 500,
      orderBy: { updatedAt: "desc" }
    });
    for (const row of rows) {
      for (const token of parseCaseRefs(row.refs)) {
        if (token.toLowerCase().includes(needle)) keys.add(token);
      }
    }
  }

  for (const key of synthesizedKeys(setting, q, capped)) {
    keys.add(key);
  }

  return [...keys]
    .slice(0, capped)
    .map((key) => ({
      key,
      label: key,
      url: resolveReferenceUrl(key, setting)
    }));
}
