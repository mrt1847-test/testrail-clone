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

export type UserDefinableFieldType = (typeof USER_DEFINABLE_FIELD_TYPES)[number];

export type CustomFieldDefinition = {
  systemName: string;
  name: string;
  fieldType: string;
  options: string[];
  isRequired: boolean;
};

export type CustomFieldScalar = string | number | boolean | string[] | null;

const LABELS: Record<string, string> = {
  string: "String",
  text: "Text",
  url: "URL",
  integer: "Integer",
  number: "Number",
  checkbox: "Checkbox",
  boolean: "Checkbox",
  date: "Date",
  dropdown: "Dropdown",
  select: "Dropdown",
  multi_select: "Multi-select",
  user: "User",
  milestone: "Milestone",
  rating: "Rating"
};

export function fieldTypeLabel(fieldType: string) {
  return LABELS[fieldType] ?? fieldType;
}

export function fieldTypeUsesOptions(fieldType: string) {
  return fieldType === "dropdown" || fieldType === "select" || fieldType === "multi_select" || fieldType === "rating";
}

export function isCheckboxField(fieldType: string) {
  return fieldType === "checkbox" || fieldType === "boolean";
}

export function isNumericField(fieldType: string) {
  return fieldType === "number" || fieldType === "integer" || fieldType === "rating";
}

export function maxRating(options: string[]) {
  const parsed = options.map((item) => Number(item.trim())).find((n) => Number.isInteger(n) && n >= 1);
  return parsed ?? 5;
}

export function validateCustomFieldDraft(field: CustomFieldDefinition, value: CustomFieldScalar): string | null {
  if (field.isRequired && (value == null || value === "" || (Array.isArray(value) && value.length === 0))) {
    return `${field.name} is required.`;
  }
  if (value == null || value === "") return null;
  if (field.fieldType === "integer" && typeof value === "number" && !Number.isInteger(value)) {
    return `${field.name} must be an integer.`;
  }
  if (isNumericField(field.fieldType) && typeof value === "number" && !Number.isFinite(value)) {
    return `${field.name} must be a number.`;
  }
  if (field.fieldType === "url" && typeof value === "string") {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return `${field.name} must be a valid URL.`;
    } catch {
      return `${field.name} must be a valid URL.`;
    }
  }
  if (field.fieldType === "rating" && typeof value === "number") {
    const max = maxRating(field.options);
    if (!Number.isInteger(value) || value < 1 || value > max) {
      return `${field.name} must be between 1 and ${max}.`;
    }
  }
  return null;
}

export function stringDraftFromValue(value: CustomFieldScalar): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return String(value);
  return String(value);
}

export function parseDraftToScalar(field: CustomFieldDefinition, draft: string): CustomFieldScalar {
  const trimmed = draft.trim();
  if (!trimmed) return null;
  if (isCheckboxField(field.fieldType)) {
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    return null;
  }
  if (field.fieldType === "multi_select") {
    return trimmed
      .split(/[,;|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (isNumericField(field.fieldType)) {
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }
  return trimmed;
}
