import { normalizeDefectCreateMode, type DefectCreateMode } from "./defectProviderApi.js";
import type { DefectIntegrationForRefs } from "./referenceUrls.js";
import { resolveReferenceUrl } from "./referenceUrls.js";

export const DEFECT_INTEGRATION_PROVIDERS = ["jira", "github", "azure_devops", "custom"] as const;

export type DefectIntegrationProvider = (typeof DEFECT_INTEGRATION_PROVIDERS)[number];

export type DefectIntegrationConfigInput = DefectIntegrationForRefs & {
  provider: string;
  createMode?: string | null;
  apiBaseUrl?: string | null;
  apiToken?: string | null;
};

export type DefectIntegrationValidationResult = {
  valid: boolean;
  provider: DefectIntegrationProvider;
  errors: string[];
  warnings: string[];
};

export type DefectIntegrationCheck = {
  code: string;
  status: "pass" | "fail" | "warn";
  message: string;
};

export type DefectIntegrationConnectionTestResult = {
  ok: boolean;
  provider: DefectIntegrationProvider;
  checks: DefectIntegrationCheck[];
  sampleUrls: Array<{ key: string; url: string | null }>;
};

const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;

export function normalizeDefectProvider(raw: string): DefectIntegrationProvider {
  const normalized = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "azure" || normalized === "azuredevops") return "azure_devops";
  if ((DEFECT_INTEGRATION_PROVIDERS as readonly string[]).includes(normalized)) {
    return normalized as DefectIntegrationProvider;
  }
  return "custom";
}

export function validateIssueUrlTemplate(template: string): string | null {
  const trimmed = template.trim();
  if (!trimmed.includes("{key}")) {
    return "Issue URL template must include the {key} placeholder.";
  }
  const sample = trimmed.replaceAll("{key}", "SAMPLE-1");
  try {
    const url = new URL(sample);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "Issue URL template must resolve to an http(s) URL.";
    }
    if (!url.hostname) {
      return "Issue URL template must include a host name.";
    }
    return null;
  } catch {
    return "Issue URL template is not a valid URL after substituting a sample issue key.";
  }
}

function providerTemplateWarnings(provider: DefectIntegrationProvider, template: string): string[] {
  const lower = template.toLowerCase();
  const warnings: string[] = [];
  if (provider === "jira" && !lower.includes("browse") && !lower.includes("/issues/")) {
    warnings.push("Jira templates commonly use /browse/{key} or /issues/{key}.");
  }
  if (provider === "github" && !lower.includes("github.com")) {
    warnings.push("GitHub templates commonly use https://github.com/<org>/<repo>/issues/{key}.");
  }
  if (provider === "azure_devops" && !lower.includes("dev.azure.com") && !lower.includes("_workitems")) {
    warnings.push("Azure DevOps templates commonly use dev.azure.com/.../_workitems/edit/{key}.");
  }
  if (template.startsWith("http://")) {
    warnings.push("Prefer https:// for defect tracker links.");
  }
  return warnings;
}

export function validateDefectIntegrationConfig(
  input: DefectIntegrationConfigInput
): DefectIntegrationValidationResult {
  const provider = normalizeDefectProvider(input.provider);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input.isEnabled) {
    return { valid: true, provider, errors, warnings };
  }

  const template = input.issueUrlTemplate?.trim() ?? "";
  if (!template) {
    errors.push("Issue URL template is required when integration is enabled.");
  } else {
    const templateError = validateIssueUrlTemplate(template);
    if (templateError) errors.push(templateError);
    else warnings.push(...providerTemplateWarnings(provider, template));
  }

  const projectKey = input.defaultProjectKey?.trim() ?? "";
  if (provider !== "github" && provider !== "custom" && !projectKey) {
    warnings.push("Default project key helps generate issue search suggestions (e.g. QA).");
  }
  if (projectKey && !PROJECT_KEY_PATTERN.test(projectKey)) {
    warnings.push("Project key is usually uppercase letters, numbers, and underscores (e.g. QA).");
  }

  const createMode: DefectCreateMode = normalizeDefectCreateMode(input.createMode);
  if (createMode === "provider_api") {
    if (provider === "custom") {
      warnings.push("Provider API mode works best with Jira, GitHub, or Azure DevOps providers.");
    }
    if (!input.apiBaseUrl?.trim() || !input.apiToken?.trim()) {
      warnings.push(
        "Provider API mode will use simulated create/sync until API base URL and token are configured."
      );
    } else {
      try {
        const url = new URL(input.apiBaseUrl.trim());
        if (url.protocol !== "https:" && url.protocol !== "http:") {
          warnings.push("API base URL should use http(s).");
        }
      } catch {
        errors.push("API base URL is not a valid URL.");
      }
    }
  }

  return { valid: errors.length === 0, provider, errors, warnings };
}

function sampleIssueKey(setting: DefectIntegrationForRefs, override?: string) {
  const custom = override?.trim();
  if (custom) return custom;
  const prefix = setting.defaultProjectKey?.trim();
  if (prefix) return `${prefix}-1`;
  return "TEST-1";
}

export function testDefectIntegrationConnection(
  input: DefectIntegrationConfigInput,
  options?: { sampleIssueKey?: string }
): DefectIntegrationConnectionTestResult {
  const validation = validateDefectIntegrationConfig(input);
  const createMode = normalizeDefectCreateMode(input.createMode);
  const checks: DefectIntegrationCheck[] = [
    {
      code: "provider",
      status: "pass",
      message: `Provider: ${validation.provider}`
    },
    {
      code: "create_mode",
      status: "pass",
      message:
        createMode === "provider_api"
          ? "Create mode: provider API (create/sync issues)"
          : "Create mode: URL template (link existing issues)"
    }
  ];

  for (const message of validation.errors) {
    checks.push({ code: "config", status: "fail", message });
  }
  for (const message of validation.warnings) {
    checks.push({ code: "config", status: "warn", message });
  }

  const sampleUrls: Array<{ key: string; url: string | null }> = [];

  if (!input.isEnabled) {
    checks.push({
      code: "enabled",
      status: "warn",
      message: "Integration is disabled. Enable it to link defects from test results."
    });
    return { ok: validation.valid, provider: validation.provider, checks, sampleUrls };
  }

  if (validation.valid && input.issueUrlTemplate?.trim()) {
    const key = sampleIssueKey(input, options?.sampleIssueKey);
    const url = resolveReferenceUrl(key, input);
    sampleUrls.push({ key, url });
    checks.push({
      code: "sample_url",
      status: url ? "pass" : "fail",
      message: url
        ? `Sample issue ${key} resolves to ${url}`
        : `Could not build a URL for sample issue ${key}. Check the template and {key} placeholder.`
    });
  }

  const ok = validation.valid && sampleUrls.every((row) => row.url != null);
  if (ok) {
    checks.push({
      code: "connection",
      status: "pass",
      message: "Configuration validated for URL-template defect linking (Jira/GitHub/Azure baseline)."
    });
  }

  return { ok, provider: validation.provider, checks, sampleUrls };
}
