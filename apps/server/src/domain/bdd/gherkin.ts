export type ParsedGherkinScenario = {
  name: string;
  content: string;
};

export type ParsedGherkinFeature = {
  name: string;
  scenarios: ParsedGherkinScenario[];
};

const SCENARIO_PREFIX = /^\s*(Scenario(?:\s+Outline)?|Rule):\s*(.+)\s*$/i;
const FEATURE_PREFIX = /^\s*Feature:\s*(.+)\s*$/i;

function isStepLine(line: string) {
  return /^\s*(Given|When|Then|And|But|\*)\s+/i.test(line);
}

function buildScenarioContent(name: string, bodyLines: string[]) {
  const trimmed = bodyLines.map((line) => line.trimEnd()).filter((line, index, arr) => {
    if (line.length > 0) return true;
    return index > 0 && arr.slice(index + 1).some((next) => next.trim().length > 0);
  });
  const steps = trimmed.filter((line) => line.trim().length > 0);
  return [`Scenario: ${name}`, ...steps].join("\n");
}

export function parseGherkinFeatureText(source: string): ParsedGherkinFeature[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const features: ParsedGherkinFeature[] = [];
  let currentFeature: ParsedGherkinFeature | null = null;
  let currentScenario: ParsedGherkinScenario | null = null;
  let scenarioBody: string[] = [];

  const flushScenario = () => {
    if (!currentFeature || !currentScenario) return;
    currentFeature.scenarios.push({
      name: currentScenario.name,
      content: buildScenarioContent(currentScenario.name, scenarioBody)
    });
    currentScenario = null;
    scenarioBody = [];
  };

  const flushFeature = () => {
    flushScenario();
    if (currentFeature && currentFeature.scenarios.length > 0) {
      features.push(currentFeature);
    }
    currentFeature = null;
  };

  for (const line of lines) {
    const featureMatch = line.match(FEATURE_PREFIX);
    if (featureMatch) {
      flushFeature();
      currentFeature = { name: featureMatch[1]!.trim(), scenarios: [] };
      continue;
    }
    const scenarioMatch = line.match(SCENARIO_PREFIX);
    if (scenarioMatch && currentFeature) {
      flushScenario();
      currentScenario = { name: scenarioMatch[2]!.trim(), content: "" };
      continue;
    }
    if (currentScenario && (isStepLine(line) || (line.trim().length > 0 && scenarioBody.length > 0))) {
      scenarioBody.push(line);
    }
  }

  flushFeature();
  if (features.length > 0) return features;

  const fallbackBody = lines.filter((line) => line.trim().length > 0);
  if (fallbackBody.length === 0) return [];
  return [
    {
      name: "Imported feature",
      scenarios: [
        {
          name: "Imported scenario",
          content: fallbackBody.join("\n")
        }
      ]
    }
  ];
}

export function serializeFeatureFile(input: {
  featureName: string;
  scenarios: Array<{ name: string; content: string }>;
}): string {
  const blocks = input.scenarios.map((scenario) => {
    const lines = scenario.content.replace(/\r\n/g, "\n").split("\n");
    const body = lines
      .filter((line, index) => index !== 0 || !SCENARIO_PREFIX.test(line))
      .join("\n")
      .trim();
    return body.length > 0 ? `Scenario: ${scenario.name}\n${body}` : `Scenario: ${scenario.name}`;
  });
  return [`Feature: ${input.featureName}`, ...blocks, ""].join("\n\n");
}
