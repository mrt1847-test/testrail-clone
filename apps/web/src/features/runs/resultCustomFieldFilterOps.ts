export type ResultCustomFieldFilterOperator =
  | "eq"
  | "neq"
  | "contains"
  | "not_contains"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "empty"
  | "not_empty";

export type ResultCustomFilterEntry = {
  op: ResultCustomFieldFilterOperator;
  value: string;
};

export const RESULT_CUSTOM_FILTER_OPERATOR_LABELS: Record<ResultCustomFieldFilterOperator, string> = {
  eq: "equals",
  neq: "not equals",
  contains: "contains",
  not_contains: "does not contain",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  empty: "is empty",
  not_empty: "is not empty"
};

export function operatorsForResultFieldType(fieldType: string): ResultCustomFieldFilterOperator[] {
  if (fieldType === "checkbox" || fieldType === "boolean") {
    return ["eq", "neq", "empty", "not_empty"];
  }
  if (fieldType === "integer" || fieldType === "number" || fieldType === "rating") {
    return ["eq", "neq", "gt", "gte", "lt", "lte", "empty", "not_empty"];
  }
  if (fieldType === "date") {
    return ["eq", "neq", "gt", "gte", "lt", "lte", "empty", "not_empty"];
  }
  if (fieldType === "dropdown" || fieldType === "select") {
    return ["eq", "neq", "empty", "not_empty"];
  }
  if (fieldType === "multi_select") {
    return ["eq", "contains", "not_contains", "empty", "not_empty"];
  }
  return ["eq", "neq", "contains", "not_contains", "empty", "not_empty"];
}

export function isValuelessResultFilterOp(op: ResultCustomFieldFilterOperator): boolean {
  return op === "empty" || op === "not_empty";
}

export function hasActiveResultCustomFilter(entry: ResultCustomFilterEntry | undefined): boolean {
  if (!entry) return false;
  if (isValuelessResultFilterOp(entry.op)) return true;
  return entry.value.trim().length > 0;
}
