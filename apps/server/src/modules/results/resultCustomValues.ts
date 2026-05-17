import type { PrismaClient } from "@prisma/client";

import {
  CustomFieldValidationError,
  customFieldErrorMessage,
  fieldOptions,
  mapValidationErrorToResponse,
  sanitizeCustomFieldMap,
  type CustomFieldValue
} from "../../domain/customFieldTypes.js";
import {
  assertWritableCustomValueKeys,
  fieldsVisibleForEdit,
  filterCustomValuesForRead,
  type CustomFieldVisibilityContext
} from "../../domain/customFieldVisibility.js";
import { loadActiveCustomFields } from "../settings/customFieldAccess.js";

export type ResultCustomValues = Record<string, CustomFieldValue>;

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
  values: ResultCustomValues | undefined,
  visibility?: CustomFieldVisibilityContext
) {
  if (!projectId || values === undefined) return values;
  const loaded = await loadActiveCustomFields(prisma, projectId, "result");
  if (visibility) {
    assertWritableCustomValueKeys(values as Record<string, unknown>, loaded, visibility);
  }
  const editable = visibility ? fieldsVisibleForEdit(loaded, visibility) : loaded;
  return sanitizeCustomFieldMap(
    editable.map((field) => ({
      systemName: field.systemName,
      fieldType: field.fieldType,
      options: fieldOptions(field.options),
      isRequired: field.isRequired
    })),
    values as Record<string, unknown>,
    "result"
  ) as ResultCustomValues;
}

export function filterResultCustomValuesForRead(
  values: ResultCustomValues | null | undefined,
  fields: Awaited<ReturnType<typeof loadActiveCustomFields>>,
  visibility: CustomFieldVisibilityContext
) {
  return filterCustomValuesForRead(values ?? {}, fields, visibility);
}

export function resultCustomFieldErrorResponse(error: unknown) {
  const mapped = mapValidationErrorToResponse(error);
  if (mapped) return mapped;
  if (error instanceof CustomFieldValidationError) {
    return {
      code: error.code,
      message: customFieldErrorMessage(error.code, error.field) ?? error.message,
      field: error.field
    };
  }
  return null;
}
