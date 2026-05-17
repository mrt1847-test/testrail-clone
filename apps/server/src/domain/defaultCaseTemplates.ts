export const DEFAULT_CASE_TEMPLATE_SYSTEM_KEYS = [
  "test_case_text",
  "test_case_steps",
  "exploratory_session",
  "behaviour_driven_development",
  "ai_evaluation"
] as const;

export type DefaultCaseTemplateSystemKey = (typeof DEFAULT_CASE_TEMPLATE_SYSTEM_KEYS)[number];

export type DefaultCaseTemplateDefinition = {
  systemKey: DefaultCaseTemplateSystemKey;
  name: string;
  description: string;
  fields: string[];
  isDefault: boolean;
  displayOrder: number;
};

export const DEFAULT_CASE_TEMPLATE_DEFINITIONS: DefaultCaseTemplateDefinition[] = [
  {
    systemKey: "test_case_text",
    name: "Test Case (Text)",
    description: "Single expected result without step table.",
    fields: ["title", "preconditions", "expectedResult", "refs"],
    isDefault: true,
    displayOrder: 0
  },
  {
    systemKey: "test_case_steps",
    name: "Test Case (Steps)",
    description: "Step-by-step actions with expected results.",
    fields: ["title", "preconditions", "steps", "refs"],
    isDefault: false,
    displayOrder: 1
  },
  {
    systemKey: "exploratory_session",
    name: "Exploratory Session",
    description: "Charter-style mission and goals for exploratory testing.",
    fields: ["title", "mission", "goals", "refs"],
    isDefault: false,
    displayOrder: 2
  },
  {
    systemKey: "behaviour_driven_development",
    name: "Behaviour Driven Development",
    description: "Gherkin-style scenario text for BDD cases.",
    fields: ["title", "scenario", "refs"],
    isDefault: false,
    displayOrder: 3
  },
  {
    systemKey: "ai_evaluation",
    name: "AI Evaluation",
    description: "Capture AI prompt, expected output, and evaluation metadata.",
    fields: ["title", "ai_input", "ai_expected_output", "refs"],
    isDefault: false,
    displayOrder: 4
  }
];

const BUILTIN_TEMPLATE_FIELD_LABELS: Record<string, string> = {
  mission: "Mission",
  goals: "Goals",
  scenario: "Scenario",
  ai_input: "Input",
  ai_expected_output: "Expected output",
  ai_quality_rating: "Quality rating",
  ai_latency_ms: "Latency (ms)",
  ai_traces: "Traces"
};

export function isBuiltinTemplateFieldKey(key: string) {
  const normalized = key.trim().toLowerCase();
  return normalized in BUILTIN_TEMPLATE_FIELD_LABELS || normalized === "expectedresult";
}

export function builtinTemplateFieldLabel(key: string) {
  const normalized = key.trim().toLowerCase();
  if (normalized === "expectedresult") return "Expected result";
  return BUILTIN_TEMPLATE_FIELD_LABELS[normalized] ?? key;
}

export function templateFieldUsesSteps(fields: string[]) {
  return fields.some((field) => field.trim().toLowerCase() === "steps");
}

export function templateFieldUsesExpectedResult(fields: string[]) {
  return fields.some((field) => field.trim().toLowerCase() === "expectedresult");
}
