import type { Prisma, PrismaClient } from "@prisma/client";

type ScalarCustomValue = string | number | boolean | null;
export type ResultCustomValues = Record<string, ScalarCustomValue>;

function fieldOptions(value: Prisma.JsonValue | null): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function projectIdForTestInstance(prisma: PrismaClient | undefined, testId: bigint) {
  if (!prisma) return null;
  const row = await prisma.testInstance.findFirst({
    where: { id: testId, deletedAt: null },
    select: { run: { select: { projectId: true } } }
  });
  return row?.run.projectId ?? null;
}

export async function validateResultCustomValues(
  prisma: PrismaClient | undefined,
  projectId: bigint | null,
  values: ResultCustomValues | undefined
) {
  if (!prisma || !projectId || values === undefined) return values;
  const fields = await prisma.customField.findMany({
    where: { projectId, scope: "result", deletedAt: null, isActive: true },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }]
  });
  const known = new Map(fields.map((field) => [field.systemName, field]));
  const sanitized: ResultCustomValues = {};
  for (const [key, value] of Object.entries(values)) {
    const field = known.get(key);
    if (!field) {
      throw new Error(`UNKNOWN_RESULT_CUSTOM_FIELD:${key}`);
    }
    if (value == null || value === "") {
      if (field.isRequired) throw new Error(`REQUIRED_RESULT_CUSTOM_FIELD:${key}`);
      sanitized[key] = null;
      continue;
    }
    if (field.fieldType === "number") {
      const numberValue = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(numberValue)) throw new Error(`INVALID_RESULT_CUSTOM_FIELD_NUMBER:${key}`);
      sanitized[key] = numberValue;
      continue;
    }
    if (field.fieldType === "select") {
      const stringValue = String(value);
      if (!fieldOptions(field.options).includes(stringValue)) throw new Error(`INVALID_RESULT_CUSTOM_FIELD_OPTION:${key}`);
      sanitized[key] = stringValue;
      continue;
    }
    sanitized[key] = String(value);
  }
  for (const field of fields) {
    if (field.isRequired && (sanitized[field.systemName] == null || sanitized[field.systemName] === "")) {
      throw new Error(`REQUIRED_RESULT_CUSTOM_FIELD:${field.systemName}`);
    }
  }
  return sanitized;
}

export function resultCustomFieldErrorResponse(error: unknown) {
  if (!(error instanceof Error)) return null;
  const [code, field] = error.message.split(":");
  if (!field) return null;
  const messages: Record<string, string> = {
    UNKNOWN_RESULT_CUSTOM_FIELD: `unknown result custom field ${field}`,
    REQUIRED_RESULT_CUSTOM_FIELD: `result custom field ${field} is required`,
    INVALID_RESULT_CUSTOM_FIELD_NUMBER: `result custom field ${field} must be a number`,
    INVALID_RESULT_CUSTOM_FIELD_OPTION: `result custom field ${field} has an invalid option`
  };
  if (!messages[code]) return null;
  return { code, message: messages[code], field };
}
