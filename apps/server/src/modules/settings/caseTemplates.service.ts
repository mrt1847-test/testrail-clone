import type { Prisma, PrismaClient } from "@prisma/client";

import {
  DEFAULT_CASE_TEMPLATE_DEFINITIONS,
  type DefaultCaseTemplateSystemKey
} from "../../domain/defaultCaseTemplates.js";
import type { CaseTemplateRow } from "./settings.shared.js";

type EnsureClient = PrismaClient | Prisma.TransactionClient;

export async function ensureDefaultCaseTemplates(
  client: EnsureClient,
  projectId: bigint,
  actorUserId?: bigint
) {
  const existing = await client.caseTemplate.findMany({
    where: { projectId, deletedAt: null, systemKey: { not: null } },
    select: { systemKey: true }
  });
  const existingKeys = new Set(
    existing
      .map((row) => row.systemKey)
      .filter((key): key is string => typeof key === "string" && key.length > 0)
  );

  for (const definition of DEFAULT_CASE_TEMPLATE_DEFINITIONS) {
    if (existingKeys.has(definition.systemKey)) continue;
    await client.caseTemplate.create({
      data: {
        projectId,
        systemKey: definition.systemKey,
        name: definition.name,
        description: definition.description,
        fields: definition.fields,
        isDefault: definition.isDefault,
        isActive: true,
        displayOrder: definition.displayOrder,
        ...(actorUserId !== undefined ? { createdBy: actorUserId, updatedBy: actorUserId } : {})
      }
    });
    existingKeys.add(definition.systemKey);
  }
}

export function ensureDefaultCaseTemplatesInMemory(projectId: bigint, rows: CaseTemplateRow[]) {
  let nextId = rows.reduce((max, row) => (row.id > max ? row.id : max), 0n) + 1n;
  const existingKeys = new Set(
    rows
      .filter((row) => row.projectId === projectId && row.systemKey)
      .map((row) => row.systemKey as string)
  );

  for (const definition of DEFAULT_CASE_TEMPLATE_DEFINITIONS) {
    if (existingKeys.has(definition.systemKey)) continue;
    if (definition.isDefault) {
      for (const row of rows) {
        if (row.projectId === projectId) row.isDefault = false;
      }
    }
    rows.push({
      id: nextId++,
      projectId,
      systemKey: definition.systemKey,
      name: definition.name,
      description: definition.description,
      fields: [...definition.fields],
      isDefault: definition.isDefault,
      isActive: true,
      displayOrder: definition.displayOrder
    });
    existingKeys.add(definition.systemKey);
  }
}

export async function resolveProjectCaseTemplateId(
  client: EnsureClient,
  projectId: bigint,
  caseTemplateId: bigint | null | undefined
): Promise<bigint | null> {
  if (caseTemplateId != null) {
    const found = await client.caseTemplate.findFirst({
      where: { id: caseTemplateId, projectId, deletedAt: null, isActive: true },
      select: { id: true }
    });
    if (!found) {
      throw new Error("CASE_TEMPLATE_NOT_FOUND");
    }
    return found.id;
  }

  const defaultTemplate = await client.caseTemplate.findFirst({
    where: { projectId, deletedAt: null, isActive: true, isDefault: true },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    select: { id: true }
  });
  if (defaultTemplate) return defaultTemplate.id;

  const fallback = await client.caseTemplate.findFirst({
    where: { projectId, deletedAt: null, isActive: true },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    select: { id: true }
  });
  return fallback?.id ?? null;
}

export function resolveInMemoryCaseTemplateId(
  projectId: bigint,
  rows: CaseTemplateRow[],
  caseTemplateId: bigint | null | undefined
): bigint | null {
  const projectRows = rows.filter((row) => row.projectId === projectId && row.isActive);
  if (caseTemplateId != null) {
    const found = projectRows.find((row) => row.id === caseTemplateId);
    if (!found) throw new Error("CASE_TEMPLATE_NOT_FOUND");
    return found.id;
  }
  const defaultRow = projectRows.find((row) => row.isDefault) ?? projectRows[0];
  return defaultRow?.id ?? null;
}

export function defaultTemplateSystemKeyForFields(fields: string[]): DefaultCaseTemplateSystemKey | null {
  const normalized = fields.map((field) => field.trim().toLowerCase()).join("|");
  const match = DEFAULT_CASE_TEMPLATE_DEFINITIONS.find(
    (definition) => definition.fields.map((field) => field.trim().toLowerCase()).join("|") === normalized
  );
  return match?.systemKey ?? null;
}
