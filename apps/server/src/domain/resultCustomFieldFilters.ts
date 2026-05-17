import type { Prisma } from "@prisma/client";
import { Prisma as PrismaRuntime } from "@prisma/client";

import {
  normalizeFieldType,
  parseReportFilterValue,
  type CustomFieldValue
} from "./customFieldTypes.js";

export const RESULT_CUSTOM_FIELD_FILTER_OPERATORS = [
  "eq",
  "neq",
  "contains",
  "not_contains",
  "gt",
  "gte",
  "lt",
  "lte",
  "empty",
  "not_empty"
] as const;

export type ResultCustomFieldFilterOperator = (typeof RESULT_CUSTOM_FIELD_FILTER_OPERATORS)[number];

export type ParsedResultCustomFieldFilter = {
  systemName: string;
  operator: ResultCustomFieldFilterOperator;
  value: string;
};

export function operatorsForResultFieldType(fieldType: string): ResultCustomFieldFilterOperator[] {
  const type = normalizeFieldType(fieldType) ?? "string";
  if (type === "checkbox" || type === "boolean") {
    return ["eq", "neq", "empty", "not_empty"];
  }
  if (type === "integer" || type === "number" || type === "rating") {
    return ["eq", "neq", "gt", "gte", "lt", "lte", "empty", "not_empty"];
  }
  if (type === "date") {
    return ["eq", "neq", "gt", "gte", "lt", "lte", "empty", "not_empty"];
  }
  if (type === "dropdown" || type === "select") {
    return ["eq", "neq", "empty", "not_empty"];
  }
  if (type === "multi_select") {
    return ["eq", "contains", "not_contains", "empty", "not_empty"];
  }
  return ["eq", "neq", "contains", "not_contains", "empty", "not_empty"];
}

export function isResultCustomFieldFilterOperator(value: string): value is ResultCustomFieldFilterOperator {
  return (RESULT_CUSTOM_FIELD_FILTER_OPERATORS as readonly string[]).includes(value);
}

export function parseResultCustomFieldFilterOperator(raw: string | undefined): ResultCustomFieldFilterOperator | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  return isResultCustomFieldFilterOperator(normalized) ? normalized : null;
}

export function parseResultCustomFieldFilterInput(
  systemName: string,
  rawValue: string | undefined,
  rawOperator: string | undefined
): ParsedResultCustomFieldFilter | null {
  const operatorFromParam = parseResultCustomFieldFilterOperator(rawOperator);
  const value = (rawValue ?? "").trim();

  if (operatorFromParam === "empty" || operatorFromParam === "not_empty") {
    return { systemName, operator: operatorFromParam, value: "" };
  }

  if (!operatorFromParam && !value) return null;

  if (!operatorFromParam && (value === "empty" || value === "not_empty")) {
    return { systemName, operator: value, value: "" };
  }

  const operator = operatorFromParam ?? "eq";
  if (!value) return null;

  return { systemName, operator, value };
}

export function extractResultCustomFieldFilters(query: unknown): ParsedResultCustomFieldFilter[] {
  if (!query || typeof query !== "object" || Array.isArray(query)) return [];
  const record = query as Record<string, unknown>;
  const operators = new Map<string, string>();
  const values = new Map<string, string>();

  for (const [key, raw] of Object.entries(record)) {
    if (!key.startsWith("custom_") || typeof raw !== "string") continue;
    const suffix = key.slice("custom_".length);
    if (!suffix) continue;
    if (suffix.endsWith("_op")) {
      const systemName = suffix.slice(0, -"_op".length);
      if (systemName) operators.set(systemName, raw.trim());
      continue;
    }
    values.set(suffix, raw.trim());
  }

  const filters: ParsedResultCustomFieldFilter[] = [];
  for (const [systemName, rawValue] of values) {
    const parsed = parseResultCustomFieldFilterInput(systemName, rawValue, operators.get(systemName));
    if (parsed) filters.push(parsed);
  }

  for (const [systemName, rawOp] of operators) {
    if (values.has(systemName)) continue;
    const parsed = parseResultCustomFieldFilterInput(systemName, "", rawOp);
    if (parsed) filters.push(parsed);
  }

  return filters;
}

function isEmptyValue(value: CustomFieldValue | undefined): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function asString(value: CustomFieldValue): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function asNumber(value: CustomFieldValue): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function compareScalar(
  left: CustomFieldValue | undefined,
  right: string | number | boolean | string[],
  fieldType: string
): number | null {
  const type = normalizeFieldType(fieldType) ?? "string";
  if (type === "integer" || type === "number" || type === "rating") {
    const leftNum = asNumber(left ?? null);
    const rightNum = typeof right === "number" ? right : Number(right);
    if (leftNum == null || !Number.isFinite(rightNum)) return null;
    return leftNum - rightNum;
  }
  if (type === "date") {
    const leftText = asString(left ?? null);
    const rightText = typeof right === "string" ? right : String(right);
    if (!leftText || !rightText) return null;
    return leftText.localeCompare(rightText);
  }
  if (type === "checkbox" || type === "boolean") {
    const leftBool = typeof left === "boolean" ? left : null;
    const rightBool = typeof right === "boolean" ? right : right === "true";
    if (leftBool == null) return null;
    return leftBool === rightBool ? 0 : leftBool ? 1 : -1;
  }
  if (type === "multi_select") {
    const leftItems = Array.isArray(left) ? left : [];
    const rightItems = Array.isArray(right) ? right : [String(right)];
    const leftKey = [...leftItems].sort().join("|");
    const rightKey = [...rightItems].sort().join("|");
    return leftKey.localeCompare(rightKey);
  }
  return asString(left ?? null).localeCompare(asString(right), undefined, { sensitivity: "base" });
}

export function matchesResultCustomFieldFilter(
  stored: CustomFieldValue | undefined,
  fieldType: string,
  filter: ParsedResultCustomFieldFilter
): boolean {
  const operator = filter.operator;
  if (operator === "empty") return isEmptyValue(stored);
  if (operator === "not_empty") return !isEmptyValue(stored);

  const type = normalizeFieldType(fieldType) ?? "string";
  const expected = parseReportFilterValue(filter.value, type);

  if (type === "multi_select") {
    const items = Array.isArray(stored) ? stored : [];
    if (operator === "contains") {
      return items.some((item) => item.toLowerCase() === filter.value.trim().toLowerCase());
    }
    if (operator === "not_contains") {
      return !items.some((item) => item.toLowerCase() === filter.value.trim().toLowerCase());
    }
    if (operator === "eq") {
      const expectedItems = Array.isArray(expected) ? expected : [String(expected)];
      if (items.length !== expectedItems.length) return false;
      const left = [...items].sort();
      const right = [...expectedItems].sort();
      return left.every((item, index) => item === right[index]);
    }
  }

  if (operator === "contains") {
    return asString(stored ?? null).toLowerCase().includes(filter.value.trim().toLowerCase());
  }
  if (operator === "not_contains") {
    return !asString(stored ?? null).toLowerCase().includes(filter.value.trim().toLowerCase());
  }

  const cmp = compareScalar(stored, expected, type);
  if (cmp == null) return false;

  switch (operator) {
    case "eq":
      return cmp === 0;
    case "neq":
      return cmp !== 0;
    case "gt":
      return cmp > 0;
    case "gte":
      return cmp >= 0;
    case "lt":
      return cmp < 0;
    case "lte":
      return cmp <= 0;
    default:
      return false;
  }
}

function emptyValueWhere(path: string[]): Prisma.TestResultWhereInput {
  return {
    OR: [
      { customValues: { path, equals: PrismaRuntime.JsonNull } },
      { customValues: { path, equals: PrismaRuntime.DbNull } },
      { customValues: { path, equals: "" } },
      { customValues: { path, equals: [] } }
    ]
  };
}

export function buildPrismaResultCustomValueWhere(
  systemName: string,
  fieldType: string,
  filter: ParsedResultCustomFieldFilter
): Prisma.TestResultWhereInput | null {
  const path = [systemName];
  const type = normalizeFieldType(fieldType) ?? "string";
  const operator = filter.operator;

  if (operator === "empty") {
    return emptyValueWhere(path);
  }
  if (operator === "not_empty") {
    return { NOT: emptyValueWhere(path) };
  }

  const scalar = parseReportFilterValue(filter.value, type);

  if (type === "multi_select") {
    if (operator === "contains") {
      return { customValues: { path, array_contains: [filter.value.trim()] } };
    }
    if (operator === "not_contains") {
      return { NOT: { customValues: { path, array_contains: [filter.value.trim()] } } };
    }
    if (operator === "eq") {
      const items = Array.isArray(scalar) ? scalar : [String(scalar)];
      return { customValues: { path, equals: items } };
    }
  }

  if (operator === "contains") {
    return { customValues: { path, string_contains: filter.value.trim(), mode: "insensitive" } };
  }
  if (operator === "not_contains") {
    return {
      NOT: { customValues: { path, string_contains: filter.value.trim(), mode: "insensitive" } }
    };
  }

  switch (operator) {
    case "eq":
      return { customValues: { path, equals: scalar } };
    case "neq":
      return { NOT: { customValues: { path, equals: scalar } } };
    case "gt":
      return { customValues: { path, gt: scalar } };
    case "gte":
      return { customValues: { path, gte: scalar } };
    case "lt":
      return { customValues: { path, lt: scalar } };
    case "lte":
      return { customValues: { path, lte: scalar } };
    default:
      return null;
  }
}
