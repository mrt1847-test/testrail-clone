import { z } from "zod";

/** Types admins can create via settings API (includes legacy aliases). */
export const USER_DEFINABLE_FIELD_TYPES = [
  "string",
  "text",
  "url",
  "integer",
  "number",
  "checkbox",
  "boolean",
  "date",
  "dropdown",
  "select",
  "multi_select",
  "user",
  "milestone",
  "rating"
] as const;

/** TestRail template system field types (not stored in customValues JSON). */
export const SYSTEM_TEMPLATE_FIELD_TYPES = ["steps", "step_results", "scenarios", "scenario_results"] as const;

export const ALL_CUSTOM_FIELD_TYPES = [...USER_DEFINABLE_FIELD_TYPES, ...SYSTEM_TEMPLATE_FIELD_TYPES] as const;

export type UserDefinableFieldType = (typeof USER_DEFINABLE_FIELD_TYPES)[number];
export type SystemTemplateFieldType = (typeof SYSTEM_TEMPLATE_FIELD_TYPES)[number];
export type CustomFieldType = UserDefinableFieldType | SystemTemplateFieldType;

export type CustomFieldValue = string | number | boolean | string[] | null;

export function customValuesFromJson(value: unknown): Record<string, CustomFieldValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, CustomFieldValue> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (item === null || typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
      out[key] = item;
      continue;
    }
    if (Array.isArray(item) && item.every((entry) => typeof entry === "string")) {
      out[key] = item;
    }
  }
  return out;
}

export type CustomFieldDefinition = {
  systemName: string;
  fieldType: string;
  options: string[];
  isRequired: boolean;
};

const TESTRAIL_TYPE_ALIASES: Record<string, CustomFieldType> = {
  string: "string",
  String: "string",
  text: "text",
  Text: "text",
  url: "url",
  URL: "url",
  integer: "integer",
  Integer: "integer",
  number: "number",
  Number: "number",
  checkbox: "checkbox",
  Checkbox: "checkbox",
  boolean: "checkbox",
  Boolean: "checkbox",
  date: "date",
  Date: "date",
  dropdown: "dropdown",
  Dropdown: "dropdown",
  select: "dropdown",
  Select: "dropdown",
  multi_select: "multi_select",
  "multi-select": "multi_select",
  "Multi-select": "multi_select",
  user: "user",
  User: "user",
  milestone: "milestone",
  Milestone: "milestone",
  rating: "rating",
  Rating: "rating",
  steps: "steps",
  Steps: "steps",
  step_results: "step_results",
  "step results": "step_results",
  "Step Results": "step_results",
  scenarios: "scenarios",
  Scenarios: "scenarios",
  scenario_results: "scenario_results",
  "scenario results": "scenario_results",
  "Scenario Results": "scenario_results"
};

export const userDefinableFieldTypeSchema = z.enum(USER_DEFINABLE_FIELD_TYPES);

export function normalizeFieldType(raw: string): CustomFieldType | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const alias = TESTRAIL_TYPE_ALIASES[trimmed];
  if (alias) return alias;
  const lower = trimmed.toLowerCase().replace(/\s+/g, "_");
  return TESTRAIL_TYPE_ALIASES[lower] ?? null;
}

export function isSystemTemplateFieldType(fieldType: string) {
  const normalized = normalizeFieldType(fieldType);
  return normalized != null && (SYSTEM_TEMPLATE_FIELD_TYPES as readonly string[]).includes(normalized);
}

export function fieldOptions(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function fieldTypeUsesOptions(fieldType: string) {
  const type = normalizeFieldType(fieldType);
  return type === "dropdown" || type === "multi_select" || type === "rating";
}

export function testRailFieldTypeLabel(fieldType: string): string {
  const normalized = normalizeFieldType(fieldType) ?? fieldType;
  const labels: Record<string, string> = {
    string: "String",
    text: "Text",
    url: "URL",
    integer: "Integer",
    number: "Number",
    checkbox: "Checkbox",
    date: "Date",
    dropdown: "Dropdown",
    multi_select: "Multi-select",
    user: "User",
    milestone: "Milestone",
    rating: "Rating",
    steps: "Steps",
    step_results: "Step Results",
    scenarios: "Scenarios",
    scenario_results: "Scenario Results"
  };
  return labels[normalized] ?? fieldType;
}

export class CustomFieldValidationError extends Error {
  constructor(
    public readonly code: string,
    public readonly field: string
  ) {
    super(`${code}:${field}`);
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseBooleanInput(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const stringValue = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(stringValue)) return true;
  if (["false", "0", "no", "n", "off"].includes(stringValue)) return false;
  return null;
}

function parseMultiSelectInput(value: unknown, options: string[]): string[] | null {
  let items: string[];
  if (Array.isArray(value)) {
    items = value.map((item) => String(item).trim()).filter(Boolean);
  } else {
    items = String(value)
      .split(/[,;|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (items.length === 0) return null;
  if (options.length > 0 && items.some((item) => !options.includes(item))) return null;
  return items;
}

function maxRating(options: string[]) {
  const fromOptions = options.map((item) => Number(item.trim())).find((n) => Number.isInteger(n) && n >= 1);
  return fromOptions ?? 5;
}

function isValidUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function validationCode(base: string, scope: "case" | "result") {
  if (scope === "case") return base;
  return base.replace("CUSTOM_FIELD", "RESULT_CUSTOM_FIELD");
}

export function sanitizeCustomFieldValue(
  field: CustomFieldDefinition,
  value: unknown,
  scope: "case" | "result" = "case"
): CustomFieldValue {
  const type = normalizeFieldType(field.fieldType);
  if (!type) {
    throw new CustomFieldValidationError(validationCode("INVALID_CUSTOM_FIELD_TYPE", scope), field.systemName);
  }
  if (isSystemTemplateFieldType(type)) {
    throw new CustomFieldValidationError(validationCode("SYSTEM_CUSTOM_FIELD_NOT_EDITABLE", scope), field.systemName);
  }

  if (value == null || value === "") {
    if (field.isRequired) {
      throw new CustomFieldValidationError(validationCode("REQUIRED_CUSTOM_FIELD", scope), field.systemName);
    }
    return null;
  }

  const options = field.options ?? [];

  switch (type) {
    case "checkbox": {
      const parsed = parseBooleanInput(value);
      if (parsed == null) {
        throw new CustomFieldValidationError(
          validationCode("INVALID_CUSTOM_FIELD_CHECKBOX", scope),
          field.systemName
        );
      }
      return parsed;
    }
    case "integer": {
      const numberValue = typeof value === "number" ? value : Number(value);
      if (!Number.isInteger(numberValue)) {
        throw new CustomFieldValidationError(validationCode("INVALID_CUSTOM_FIELD_INTEGER", scope), field.systemName);
      }
      return numberValue;
    }
    case "number": {
      const numberValue = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(numberValue)) {
        throw new CustomFieldValidationError(validationCode("INVALID_CUSTOM_FIELD_NUMBER", scope), field.systemName);
      }
      return numberValue;
    }
    case "rating": {
      const numberValue = typeof value === "number" ? value : Number(value);
      const max = maxRating(options);
      if (!Number.isInteger(numberValue) || numberValue < 1 || numberValue > max) {
        throw new CustomFieldValidationError(validationCode("INVALID_CUSTOM_FIELD_RATING", scope), field.systemName);
      }
      return numberValue;
    }
    case "dropdown": {
      const stringValue = String(value);
      if (options.length > 0 && !options.includes(stringValue)) {
        throw new CustomFieldValidationError(validationCode("INVALID_CUSTOM_FIELD_OPTION", scope), field.systemName);
      }
      return stringValue;
    }
    case "multi_select": {
      const parsed = parseMultiSelectInput(value, options);
      if (!parsed) {
        throw new CustomFieldValidationError(validationCode("INVALID_CUSTOM_FIELD_MULTI_SELECT", scope), field.systemName);
      }
      return parsed;
    }
    case "date": {
      const stringValue = String(value).trim();
      if (!ISO_DATE.test(stringValue)) {
        throw new CustomFieldValidationError(validationCode("INVALID_CUSTOM_FIELD_DATE", scope), field.systemName);
      }
      return stringValue;
    }
    case "url": {
      const stringValue = String(value).trim();
      if (!isValidUrl(stringValue)) {
        throw new CustomFieldValidationError(validationCode("INVALID_CUSTOM_FIELD_URL", scope), field.systemName);
      }
      return stringValue;
    }
    case "user":
    case "milestone":
    case "string":
    case "text": {
      const stringValue = String(value).trim();
      if (!stringValue) {
        if (field.isRequired) {
          throw new CustomFieldValidationError(validationCode("REQUIRED_CUSTOM_FIELD", scope), field.systemName);
        }
        return null;
      }
      return stringValue;
    }
    default:
      return String(value);
  }
}

export function sanitizeCustomFieldMap(
  fields: CustomFieldDefinition[],
  values: Record<string, unknown> | undefined,
  scope: "case" | "result" = "case"
): Record<string, CustomFieldValue> {
  if (values === undefined) return {};
  const known = new Map(fields.map((field) => [field.systemName, field]));
  const sanitized: Record<string, CustomFieldValue> = {};

  for (const [key, value] of Object.entries(values)) {
    const field = known.get(key);
    if (!field) {
      throw new CustomFieldValidationError(
        scope === "result" ? "UNKNOWN_RESULT_CUSTOM_FIELD" : "UNKNOWN_CUSTOM_FIELD",
        key
      );
    }
    sanitized[key] = sanitizeCustomFieldValue(field, value, scope);
  }

  for (const field of fields) {
    if (isSystemTemplateFieldType(field.fieldType)) continue;
    if (field.isRequired && (sanitized[field.systemName] == null || sanitized[field.systemName] === "")) {
      throw new CustomFieldValidationError(
        scope === "result" ? "REQUIRED_RESULT_CUSTOM_FIELD" : "REQUIRED_CUSTOM_FIELD",
        field.systemName
      );
    }
  }

  return sanitized;
}

export function customFieldErrorMessage(code: string, field: string): string | null {
  const messages: Record<string, string> = {
    UNKNOWN_CUSTOM_FIELD: `unknown custom field ${field}`,
    UNKNOWN_RESULT_CUSTOM_FIELD: `unknown result custom field ${field}`,
    REQUIRED_CUSTOM_FIELD: `custom field ${field} is required`,
    REQUIRED_RESULT_CUSTOM_FIELD: `result custom field ${field} is required`,
    INVALID_CUSTOM_FIELD_TYPE: `custom field ${field} has an unsupported type`,
    INVALID_CUSTOM_FIELD_NUMBER: `custom field ${field} must be a number`,
    INVALID_CUSTOM_FIELD_INTEGER: `custom field ${field} must be an integer`,
    INVALID_CUSTOM_FIELD_OPTION: `custom field ${field} has an invalid option`,
    INVALID_CUSTOM_FIELD_CHECKBOX: `custom field ${field} must be true or false`,
    INVALID_CUSTOM_FIELD_DATE: `custom field ${field} must be YYYY-MM-DD`,
    INVALID_CUSTOM_FIELD_URL: `custom field ${field} must be a valid http(s) URL`,
    INVALID_CUSTOM_FIELD_MULTI_SELECT: `custom field ${field} has invalid selection`,
    INVALID_CUSTOM_FIELD_RATING: `custom field ${field} has an invalid rating`,
    SYSTEM_CUSTOM_FIELD_NOT_EDITABLE: `custom field ${field} is managed by the case template, not custom values`,
    FORBIDDEN_CUSTOM_FIELD: `custom field ${field} is not editable for your role or template`,
    FORBIDDEN_RESULT_CUSTOM_FIELD: `result custom field ${field} is not editable for your role`,
    INVALID_RESULT_CUSTOM_FIELD_NUMBER: `result custom field ${field} must be a number`,
    INVALID_RESULT_CUSTOM_FIELD_INTEGER: `result custom field ${field} must be an integer`,
    INVALID_RESULT_CUSTOM_FIELD_OPTION: `result custom field ${field} has an invalid option`,
    INVALID_RESULT_CUSTOM_FIELD_CHECKBOX: `result custom field ${field} must be true or false`,
    INVALID_RESULT_CUSTOM_FIELD_DATE: `result custom field ${field} must be YYYY-MM-DD`,
    INVALID_RESULT_CUSTOM_FIELD_URL: `result custom field ${field} must be a valid http(s) URL`,
    INVALID_RESULT_CUSTOM_FIELD_MULTI_SELECT: `result custom field ${field} has invalid selection`,
    INVALID_RESULT_CUSTOM_FIELD_RATING: `result custom field ${field} has an invalid rating`,
    SYSTEM_RESULT_CUSTOM_FIELD_NOT_EDITABLE: `result custom field ${field} is not editable via custom values`
  };
  return messages[code] ?? null;
}

export function mapValidationErrorToResponse(error: unknown) {
  if (!(error instanceof CustomFieldValidationError)) return null;
  const message = customFieldErrorMessage(error.code, error.field);
  if (!message) return null;
  return { code: error.code, message, field: error.field };
}

export function parseReportFilterValue(rawValue: string, fieldType: string): string | number | boolean | string[] {
  const type = normalizeFieldType(fieldType) ?? fieldType;
  if (type === "integer" || type === "number" || type === "rating") {
    const value = Number(rawValue);
    return Number.isFinite(value) ? value : rawValue;
  }
  if (type === "checkbox") {
    const parsed = parseBooleanInput(rawValue);
    return parsed ?? rawValue;
  }
  if (type === "multi_select") {
    return parseMultiSelectInput(rawValue, []) ?? rawValue;
  }
  return rawValue;
}
