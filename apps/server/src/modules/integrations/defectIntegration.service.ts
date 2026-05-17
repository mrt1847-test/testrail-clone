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
