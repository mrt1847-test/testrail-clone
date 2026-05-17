import { normalizeDefectProvider, type DefectIntegrationProvider } from "./defectIntegrationValidation.js";

export type DefectPushFieldType = "text" | "textarea" | "select";

export type DefectPushFieldDefinition = {
  key: string;
  label: string;
  type: DefectPushFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  mapsTo?: "defectKey" | "title" | "description";
};

export type DefectPushFieldValues = Record<string, string>;

export type DefectPushContext = {
  projectId: string;
  runId: string;
  runName: string;
  testId: string;
  testTitle: string;
  resultId: string;
  resultStatus: string;
  resultComment?: string | null;
};

const JIRA_FIELDS: DefectPushFieldDefinition[] = [
  {
    key: "defectKey",
    label: "Issue key",
    type: "text",
    placeholder: "QA-123 (optional — generated if empty)",
    mapsTo: "defectKey"
  },
  {
    key: "summary",
    label: "Summary",
    type: "text",
    required: true,
    mapsTo: "title"
  },
  {
    key: "description",
    label: "Description",
    type: "textarea",
    required: true,
    mapsTo: "description"
  },
  {
    key: "issueType",
    label: "Issue type",
    type: "select",
    options: ["Bug", "Task", "Story"],
    required: true
  },
  {
    key: "priority",
    label: "Priority",
    type: "select",
    options: ["Highest", "High", "Medium", "Low"],
    required: true
  }
];

const GITHUB_FIELDS: DefectPushFieldDefinition[] = [
  {
    key: "defectKey",
    label: "Issue number",
    type: "text",
    placeholder: "42 (optional)",
    mapsTo: "defectKey"
  },
  {
    key: "title",
    label: "Title",
    type: "text",
    required: true,
    mapsTo: "title"
  },
  {
    key: "body",
    label: "Body",
    type: "textarea",
    required: true,
    mapsTo: "description"
  },
  {
    key: "labels",
    label: "Labels",
    type: "text",
    placeholder: "bug, regression"
  }
];

const AZURE_FIELDS: DefectPushFieldDefinition[] = [
  {
    key: "defectKey",
    label: "Work item ID",
    type: "text",
    placeholder: "Optional — generated if empty",
    mapsTo: "defectKey"
  },
  {
    key: "title",
    label: "Title",
    type: "text",
    required: true,
    mapsTo: "title"
  },
  {
    key: "description",
    label: "Description",
    type: "textarea",
    required: true,
    mapsTo: "description"
  },
  {
    key: "workItemType",
    label: "Work item type",
    type: "select",
    options: ["Bug", "Task", "User Story"],
    required: true
  },
  {
    key: "priority",
    label: "Priority",
    type: "select",
    options: ["1", "2", "3", "4"],
    required: true
  }
];

const CUSTOM_FIELDS: DefectPushFieldDefinition[] = [
  {
    key: "defectKey",
    label: "Defect key",
    type: "text",
    placeholder: "DEF-1 (optional)",
    mapsTo: "defectKey"
  },
  {
    key: "title",
    label: "Title",
    type: "text",
    required: true,
    mapsTo: "title"
  },
  {
    key: "description",
    label: "Description",
    type: "textarea",
    required: true,
    mapsTo: "description"
  }
];

export function defectPushFieldsForProvider(provider: string): DefectPushFieldDefinition[] {
  switch (normalizeDefectProvider(provider)) {
    case "jira":
      return JIRA_FIELDS;
    case "github":
      return GITHUB_FIELDS;
    case "azure_devops":
      return AZURE_FIELDS;
    default:
      return CUSTOM_FIELDS;
  }
}

export function buildDefaultDefectPushValues(
  fields: DefectPushFieldDefinition[],
  context: DefectPushContext,
  defaultProjectKey?: string | null
): DefectPushFieldValues {
  const prefix = defaultProjectKey?.trim().toUpperCase();
  const suggestedKey = prefix ? `${prefix}-` : "";
  const traceback = buildResultTraceback(context);
  const values: DefectPushFieldValues = {};

  for (const field of fields) {
    if (field.mapsTo === "defectKey") {
      values[field.key] = suggestedKey;
    } else if (field.mapsTo === "title") {
      values[field.key] = `[${context.resultStatus}] ${context.testTitle}`;
    } else if (field.mapsTo === "description") {
      values[field.key] = traceback;
    } else if (field.key === "issueType" || field.key === "workItemType") {
      values[field.key] = "Bug";
    } else if (field.key === "priority") {
      values[field.key] = context.resultStatus === "failed" ? "High" : "Medium";
    } else if (field.key === "labels") {
      values[field.key] = `testrail,${context.resultStatus}`;
    } else {
      values[field.key] = field.options?.[0] ?? "";
    }
  }

  return values;
}

export function buildResultTraceback(context: DefectPushContext) {
  const lines = [
    `Test: ${context.testTitle}`,
    `Run: ${context.runName}`,
    `Result: #${context.resultId} (${context.resultStatus})`,
    context.resultComment?.trim() ? `Comment: ${context.resultComment.trim()}` : null,
    "",
    `Open in TestRail clone: /projects/${context.projectId}/runs/${context.runId}?testId=${context.testId}&resultId=${context.resultId}`
  ].filter((line) => line !== null);
  return lines.join("\n");
}

export function validateDefectPushValues(
  fields: DefectPushFieldDefinition[],
  values: DefectPushFieldValues
): string[] {
  const errors: string[] = [];
  for (const field of fields) {
    if (!field.required) continue;
    const value = values[field.key]?.trim() ?? "";
    if (!value) errors.push(`${field.label} is required.`);
  }
  return errors;
}

export function mapDefectPushValuesToPayload(
  provider: string,
  fields: DefectPushFieldDefinition[],
  values: DefectPushFieldValues
) {
  const normalized = normalizeDefectProvider(provider);
  let defectKey: string | undefined;
  let title: string | undefined;
  let description: string | undefined;
  const customFields: Record<string, string> = {};

  for (const field of fields) {
    const value = values[field.key]?.trim() ?? "";
    if (!value) continue;
    if (field.mapsTo === "defectKey") defectKey = value;
    else if (field.mapsTo === "title") title = value;
    else if (field.mapsTo === "description") description = value;
    else customFields[field.key] = value;
  }

  return {
    provider: normalized as DefectIntegrationProvider,
    defectKey,
    title,
    description,
    customFields
  };
}

export function appendCustomFieldsToDescription(
  description: string,
  customFields: Record<string, string>
) {
  const rows = Object.entries(customFields).filter(([, value]) => value.trim().length > 0);
  if (rows.length === 0) return description;
  const block = rows.map(([key, value]) => `- ${key}: ${value}`).join("\n");
  return `${description}\n\nProvider fields:\n${block}`;
}
