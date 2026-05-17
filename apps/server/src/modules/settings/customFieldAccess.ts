import type { Prisma, PrismaClient } from "@prisma/client";

import {
  canEditCustomField,
  canViewCustomField,
  filterCustomValuesForRead,
  parseVisibilityRules,
  type CustomFieldVisibilityContext,
  type CustomFieldVisibilityRules
} from "../../domain/customFieldVisibility.js";
import type { ResolvedProjectAccess } from "../permissions/projectAccess.service.js";
import { customFields as inMemoryCustomFields } from "./settings.shared.js";

export type LoadedCustomField = {
  id: bigint;
  name: string;
  systemName: string;
  fieldType: string;
  scope: "case" | "result";
  options: Prisma.JsonValue | string[] | null;
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
  visibility: CustomFieldVisibilityRules;
};

export function visibilityContextFromAccess(
  access: ResolvedProjectAccess,
  scope: "case" | "result",
  templateId?: string | null
): CustomFieldVisibilityContext {
  return {
    role: access.builtInRole,
    scope,
    templateId: templateId ?? null
  };
}

export async function loadActiveCustomFields(
  prisma: PrismaClient | undefined,
  projectId: bigint,
  scope: "case" | "result"
): Promise<LoadedCustomField[]> {
  if (prisma) {
    const rows = await prisma.customField.findMany({
      where: { projectId, scope, deletedAt: null, isActive: true },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }]
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      systemName: row.systemName,
      fieldType: row.fieldType,
      scope: row.scope === "result" ? "result" : "case",
      options: row.options,
      isRequired: row.isRequired,
      isActive: row.isActive,
      displayOrder: row.displayOrder,
      visibility: parseVisibilityRules(row.visibility)
    }));
  }
  return inMemoryCustomFields
    .filter((field) => field.projectId === projectId && field.scope === scope && field.isActive)
    .sort((left, right) => left.displayOrder - right.displayOrder || Number(left.id - right.id))
    .map((field) => ({
      id: field.id,
      name: field.name,
      systemName: field.systemName,
      fieldType: field.fieldType,
      scope: field.scope,
      options: field.options,
      isRequired: field.isRequired,
      isActive: field.isActive,
      displayOrder: field.displayOrder,
      visibility: parseVisibilityRules(field.visibility)
    }));
}

export function customFieldAccessFlags(field: LoadedCustomField, ctx: CustomFieldVisibilityContext) {
  const rules = field.visibility;
  return {
    canView: canViewCustomField(rules, ctx),
    canEdit: canEditCustomField(rules, ctx)
  };
}

export function filterLoadedFieldsForUse(fields: LoadedCustomField[], ctx: CustomFieldVisibilityContext) {
  return fields
    .filter((field) => canViewCustomField(field.visibility, ctx))
    .map((field) => ({
      field,
      access: customFieldAccessFlags(field, ctx)
    }));
}

export function filterRecordCustomValuesForRead<T extends Record<string, unknown>>(
  values: T | null | undefined,
  fields: LoadedCustomField[],
  ctx: CustomFieldVisibilityContext
): T {
  return filterCustomValuesForRead(values, fields, ctx);
}
