import { CASE_CSV_REFS_COLUMN, caseRefsCsvAliases } from "./caseRefs.js";

export type CaseCsvFieldDefinition = {
  key: string;
  label: string;
  aliases: readonly string[];
  required?: boolean;
  description?: string;
};

export const CASE_CSV_IGNORE_TARGET = "";

export const CASE_CSV_CORE_FIELDS: readonly CaseCsvFieldDefinition[] = [
  {
    key: "section_id",
    label: "Section ID",
    aliases: ["section_id", "sectionId", "Section ID", "section", "Section"],
    description: "Target section for new cases when the row omits section_id."
  },
  {
    key: "title",
    label: "Title",
    aliases: ["title", "Title", "name", "Name", "test case", "Test Case", "case", "Case"],
    required: true,
    description: "Case title (required)."
  },
  {
    key: "preconditions",
    label: "Preconditions",
    aliases: ["preconditions", "Preconditions", "precondition", "Precondition"]
  },
  {
    key: "priority",
    label: "Priority",
    aliases: ["priority", "Priority"]
  },
  {
    key: "type",
    label: "Type",
    aliases: ["type", "Type", "case_type", "caseType", "Case Type"]
  },
  {
    key: CASE_CSV_REFS_COLUMN,
    label: "References",
    aliases: caseRefsCsvAliases(),
    description: "External reference IDs (comma/semicolon separated)."
  },
  {
    key: "labels",
    label: "Labels",
    aliases: ["labels", "Labels", "tags", "Tags"]
  },
  {
    key: "automation_key",
    label: "Automation key",
    aliases: ["automation_key", "automationKey", "Automation Key", "automation id", "Automation ID"]
  },
  {
    key: "external_id",
    label: "External ID",
    aliases: ["external_id", "externalId", "External ID", "external key", "External Key"]
  },
  {
    key: "steps",
    label: "Steps",
    aliases: ["steps", "Steps", "test steps", "Test Steps"],
    description: 'Pipe-separated steps; use "=>" between step content and expected result.'
  }
] as const;

export function customCsvFieldKey(systemName: string) {
  return `custom_${systemName}`;
}

export function normalizeCaseCsvHeaderKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function fieldTargets(customFields: Array<{ systemName: string; label?: string | null }>) {
  return [
    ...CASE_CSV_CORE_FIELDS,
    ...customFields.map((field) => ({
      key: customCsvFieldKey(field.systemName),
      label: field.label ?? field.systemName,
      aliases: [field.systemName, customCsvFieldKey(field.systemName), field.label ?? ""].filter(Boolean) as string[]
    }))
  ];
}

export function suggestCaseCsvColumnMapping(
  headers: string[],
  customFields: Array<{ systemName: string; label?: string | null }> = []
): Record<string, string> {
  const targets = fieldTargets(customFields);
  const mapping: Record<string, string> = {};

  for (const header of headers) {
    const trimmed = header.trim();
    if (!trimmed) continue;
    const normalizedHeader = normalizeCaseCsvHeaderKey(trimmed);
    let matched: string | undefined;

    for (const field of targets) {
      if (normalizeCaseCsvHeaderKey(field.key) === normalizedHeader) {
        matched = field.key;
        break;
      }
      if (field.aliases.some((alias) => normalizeCaseCsvHeaderKey(alias) === normalizedHeader)) {
        matched = field.key;
        break;
      }
    }

    mapping[trimmed] = matched ?? CASE_CSV_IGNORE_TARGET;
  }

  return mapping;
}

export function applyCaseCsvColumnMapping(
  rows: Array<Record<string, string>>,
  mapping?: Record<string, string>
): Array<Record<string, string>> {
  if (!mapping || Object.keys(mapping).length === 0) return rows;

  return rows.map((row) => {
    const out: Record<string, string> = {};
    for (const [sourceHeader, value] of Object.entries(row)) {
      const target = mapping[sourceHeader];
      if (target === undefined) {
        out[sourceHeader] = value;
        continue;
      }
      if (!target) continue;
      if (!out[target] || out[target].length === 0) {
        out[target] = value;
      } else if (value.length > 0) {
        out[target] = value;
      }
    }
    return out;
  });
}

export type CaseCsvMappingIssue = {
  code: string;
  field?: string;
  message: string;
};

export function validateCaseCsvColumnMapping(
  mapping: Record<string, string>,
  customFields: Array<{ systemName: string; isRequired?: boolean }> = []
): CaseCsvMappingIssue[] {
  const issues: CaseCsvMappingIssue[] = [];
  const targets = new Set(Object.values(mapping).filter((value) => value.length > 0));

  if (!targets.has("title")) {
    issues.push({
      code: "MAPPING_REQUIRED",
      field: "title",
      message: "Map at least one CSV column to Title before importing."
    });
  }

  for (const field of customFields) {
    if (!field.isRequired) continue;
    const key = customCsvFieldKey(field.systemName);
    if (!targets.has(key)) {
      issues.push({
        code: "MAPPING_REQUIRED",
        field: key,
        message: `Map a CSV column to required custom field ${field.systemName}.`
      });
    }
  }

  return issues;
}

/** Reads the first non-empty CSV row as column headers. */
export function extractCsvHeaders(input: string): string[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    const next = input[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      break;
    } else if (ch !== "\r") {
      field += ch;
    }
  }

  if (rows.length === 0) {
    row.push(field);
    rows.push(row);
  }

  const headerRow = rows[0] ?? [];
  return headerRow.map((cell) => cell.trim()).filter((cell, index, all) => cell.length > 0 || all.length > 1);
}

export function buildCaseCsvImportProfile(customFields: Array<{
  systemName: string;
  label: string;
  fieldType: string;
  isRequired: boolean;
}>) {
  return {
    coreFields: CASE_CSV_CORE_FIELDS.map((field) => ({
      key: field.key,
      label: field.label,
      required: Boolean(field.required),
      description: field.description ?? null,
      aliases: [...field.aliases]
    })),
    customFields: customFields.map((field) => ({
      key: customCsvFieldKey(field.systemName),
      systemName: field.systemName,
      label: field.label,
      fieldType: field.fieldType,
      required: field.isRequired
    })),
    exportHeaders: [
      "id",
      "section_id",
      "title",
      "preconditions",
      "priority",
      "type",
      CASE_CSV_REFS_COLUMN,
      "labels",
      "automation_key",
      "external_id",
      ...customFields.map((field) => customCsvFieldKey(field.systemName)),
      "steps"
    ]
  };
}
