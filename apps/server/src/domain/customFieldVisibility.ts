import { projectRoles, type ProjectRole } from "./roles.js";
import { CustomFieldValidationError } from "./customFieldTypes.js";

export type CustomFieldVisibilityRules = {
  viewRoles?: ProjectRole[];
  editRoles?: ProjectRole[];
  templateIds?: string[];
};

export type CustomFieldVisibilityContext = {
  role: ProjectRole;
  templateId?: string | null;
  scope: "case" | "result";
};

function parseRoleList(value: unknown): ProjectRole[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const roles = value
    .filter((item): item is string => typeof item === "string")
    .filter((item): item is ProjectRole => (projectRoles as readonly string[]).includes(item));
  return roles.length > 0 ? [...new Set(roles)] : undefined;
}

function parseTemplateIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = value
    .map((item) => (typeof item === "string" || typeof item === "number" ? String(item).trim() : ""))
    .filter(Boolean);
  return ids.length > 0 ? [...new Set(ids)] : undefined;
}

export function parseVisibilityRules(value: unknown): CustomFieldVisibilityRules {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const viewRoles = parseRoleList(raw.viewRoles);
  const editRoles = parseRoleList(raw.editRoles);
  const templateIds = parseTemplateIds(raw.templateIds);
  return {
    ...(viewRoles ? { viewRoles } : {}),
    ...(editRoles ? { editRoles } : {}),
    ...(templateIds ? { templateIds } : {})
  };
}

export function visibilityRulesForStorage(
  rules: CustomFieldVisibilityRules | null | undefined
): CustomFieldVisibilityRules | null {
  if (!rules) return null;
  const parsed = parseVisibilityRules(rules);
  if (!parsed.viewRoles?.length && !parsed.editRoles?.length && !parsed.templateIds?.length) {
    return null;
  }
  return parsed;
}

function roleAllowed(role: ProjectRole, allowed: ProjectRole[] | undefined): boolean {
  if (!allowed?.length) return true;
  return allowed.includes(role);
}

function templateAllowed(
  templateId: string | null | undefined,
  allowed: string[] | undefined,
  scope: "case" | "result"
): boolean {
  if (scope !== "case" || !allowed?.length) return true;
  if (!templateId) return false;
  return allowed.includes(String(templateId));
}

export function canViewCustomField(rules: CustomFieldVisibilityRules, ctx: CustomFieldVisibilityContext): boolean {
  if (!roleAllowed(ctx.role, rules.viewRoles)) return false;
  return templateAllowed(ctx.templateId, rules.templateIds, ctx.scope);
}

export function canEditCustomField(rules: CustomFieldVisibilityRules, ctx: CustomFieldVisibilityContext): boolean {
  if (!canViewCustomField(rules, ctx)) return false;
  if (!rules.editRoles?.length) return true;
  return roleAllowed(ctx.role, rules.editRoles);
}

export function filterCustomValuesForRead<T extends Record<string, unknown>>(
  values: T | null | undefined,
  fields: Array<{ systemName: string; visibility?: unknown }>,
  ctx: CustomFieldVisibilityContext
): T {
  const source = (values ?? {}) as T;
  const visible = new Set(
    fields
      .filter((field) => canViewCustomField(parseVisibilityRules(field.visibility), ctx))
      .map((field) => field.systemName)
  );
  const next = { ...source } as Record<string, unknown>;
  for (const key of Object.keys(next)) {
    if (!visible.has(key)) delete next[key];
  }
  return next as T;
}

export function assertWritableCustomValueKeys(
  values: Record<string, unknown> | undefined,
  fields: Array<{ systemName: string; visibility?: unknown }>,
  ctx: CustomFieldVisibilityContext
): void {
  if (!values) return;
  for (const key of Object.keys(values)) {
    const field = fields.find((row) => row.systemName === key);
    if (!field) continue;
    if (!canEditCustomField(parseVisibilityRules(field.visibility), ctx)) {
      throw new CustomFieldValidationError(
        ctx.scope === "result" ? "FORBIDDEN_RESULT_CUSTOM_FIELD" : "FORBIDDEN_CUSTOM_FIELD",
        key
      );
    }
  }
}

export function fieldsVisibleForEdit<T extends { visibility?: unknown }>(
  fields: T[],
  ctx: CustomFieldVisibilityContext
): T[] {
  return fields.filter((field) => canEditCustomField(parseVisibilityRules(field.visibility), ctx));
}
