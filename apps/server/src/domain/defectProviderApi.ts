import {
  normalizeDefectProvider,
  type DefectIntegrationProvider
} from "./defectIntegrationValidation.js";
import { resolveReferenceUrl, type DefectIntegrationForRefs } from "./referenceUrls.js";

export const DEFECT_CREATE_MODES = ["url_template", "provider_api"] as const;
export type DefectCreateMode = (typeof DEFECT_CREATE_MODES)[number];

export type DefectIntegrationApiConfig = DefectIntegrationForRefs & {
  provider: string;
  createMode?: string | null;
  defaultProjectKey?: string | null;
  apiBaseUrl?: string | null;
  apiToken?: string | null;
};

export type ProviderIssueCreateInput = {
  title: string;
  description: string;
  defectKey?: string;
  customFields?: Record<string, string>;
};

export type ProviderIssueCreateResult = {
  defectKey: string;
  url: string | null;
  providerIssueId: string;
  remoteStatus: string;
  remoteStatusLabel: string;
  createMode: DefectCreateMode;
  usedRemoteApi: boolean;
};

export type ProviderIssueStatusSnapshot = {
  remoteStatus: string;
  remoteStatusLabel: string;
  syncedAt: Date;
  usedRemoteApi: boolean;
};

export type DefectTemplatePreview = {
  provider: DefectIntegrationProvider;
  createMode: DefectCreateMode;
  sampleIssueKey: string;
  url: string | null;
  providerLabel: string;
  fieldHints: string[];
};

export function normalizeDefectCreateMode(raw?: string | null): DefectCreateMode {
  return raw === "provider_api" ? "provider_api" : "url_template";
}

export function buildDefectTemplatePreview(
  setting: DefectIntegrationApiConfig,
  sampleIssueKey: string
): DefectTemplatePreview {
  const provider = normalizeDefectProvider(setting.provider);
  const createMode = normalizeDefectCreateMode(setting.createMode);
  const key = sampleIssueKey.trim() || sampleIssueKeyForSetting(setting);
  const url = resolveReferenceUrl(key, setting);
  const fieldHints =
    provider === "jira"
      ? ["summary", "description", "issueType", "priority"]
      : provider === "github"
        ? ["title", "body", "labels"]
        : provider === "azure_devops"
          ? ["title", "description", "workItemType", "severity"]
          : ["title", "description"];
  return {
    provider,
    createMode,
    sampleIssueKey: key,
    url,
    providerLabel:
      provider === "jira"
        ? "Jira"
        : provider === "github"
          ? "GitHub Issues"
          : provider === "azure_devops"
            ? "Azure DevOps"
            : "Custom tracker",
    fieldHints
  };
}

function sampleIssueKeyForSetting(setting: DefectIntegrationApiConfig) {
  const prefix = setting.defaultProjectKey?.trim().toUpperCase();
  if (prefix) return `${prefix}-1`;
  return "TEST-1";
}

function defaultStatuses(provider: DefectIntegrationProvider) {
  if (provider === "github") return { status: "open", label: "Open" };
  if (provider === "azure_devops") return { status: "new", label: "New" };
  return { status: "open", label: "Open" };
}

function deriveStatusFromKey(defectKey: string, provider: DefectIntegrationProvider) {
  const bucket = defectKey.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 3;
  if (provider === "github") {
    const labels = [
      { status: "open", label: "Open" },
      { status: "in_progress", label: "In progress" },
      { status: "closed", label: "Closed" }
    ];
    return labels[bucket] ?? labels[0];
  }
  if (provider === "azure_devops") {
    const labels = [
      { status: "new", label: "New" },
      { status: "active", label: "Active" },
      { status: "resolved", label: "Resolved" }
    ];
    return labels[bucket] ?? labels[0];
  }
  const labels = [
    { status: "open", label: "Open" },
    { status: "in_progress", label: "In Progress" },
    { status: "done", label: "Done" }
  ];
  return labels[bucket] ?? labels[0];
}

function buildIssueKey(setting: DefectIntegrationApiConfig, requested?: string) {
  const trimmed = requested?.trim();
  if (trimmed) return trimmed;
  const prefix = (setting.defaultProjectKey ?? "DEF").trim().toUpperCase();
  const provider = normalizeDefectProvider(setting.provider);
  if (provider === "github") return String(Math.floor(Date.now() / 1000) % 100000);
  if (provider === "azure_devops") return String(Math.floor(Date.now() / 1000));
  return `${prefix}-${Math.floor(Date.now() / 1000)}`;
}

function issuesEndpoint(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return `${trimmed}/issues`;
}

function issueEndpoint(baseUrl: string, issueId: string) {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return `${trimmed}/issues/${encodeURIComponent(issueId)}`;
}

async function tryRemoteCreate(
  setting: DefectIntegrationApiConfig,
  input: ProviderIssueCreateInput
): Promise<ProviderIssueCreateResult | null> {
  const baseUrl = setting.apiBaseUrl?.trim();
  const token = setting.apiToken?.trim();
  if (!baseUrl || !token) return null;

  const response = await fetch(issuesEndpoint(baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      title: input.title,
      description: input.description,
      defectKey: input.defectKey,
      projectKey: setting.defaultProjectKey,
      customFields: input.customFields ?? {}
    }),
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) return null;

  const body = (await response.json()) as {
    key?: string;
    id?: string;
    url?: string;
    status?: string;
    statusLabel?: string;
  };
  const defectKey = body.key?.trim() || input.defectKey?.trim();
  if (!defectKey) return null;
  const providerIssueId = body.id?.trim() || defectKey;
  const url = body.url?.trim() || resolveReferenceUrl(defectKey, setting);
  const status = body.status?.trim() || defaultStatuses(normalizeDefectProvider(setting.provider)).status;
  const statusLabel =
    body.statusLabel?.trim() || defaultStatuses(normalizeDefectProvider(setting.provider)).label;
  return {
    defectKey,
    url,
    providerIssueId,
    remoteStatus: status,
    remoteStatusLabel: statusLabel,
    createMode: "provider_api",
    usedRemoteApi: true
  };
}

async function tryRemoteSync(
  setting: DefectIntegrationApiConfig,
  link: { providerIssueId?: string | null; defectKey: string }
): Promise<ProviderIssueStatusSnapshot | null> {
  const baseUrl = setting.apiBaseUrl?.trim();
  const token = setting.apiToken?.trim();
  const issueId = link.providerIssueId?.trim() || link.defectKey.trim();
  if (!baseUrl || !token || !issueId) return null;

  const response = await fetch(issueEndpoint(baseUrl, issueId), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) return null;

  const body = (await response.json()) as { status?: string; statusLabel?: string };
  const provider = normalizeDefectProvider(setting.provider);
  const status = body.status?.trim() || defaultStatuses(provider).status;
  const statusLabel = body.statusLabel?.trim() || defaultStatuses(provider).label;
  return {
    remoteStatus: status,
    remoteStatusLabel: statusLabel,
    syncedAt: new Date(),
    usedRemoteApi: true
  };
}

export async function createProviderIssue(
  setting: DefectIntegrationApiConfig,
  input: ProviderIssueCreateInput
): Promise<ProviderIssueCreateResult> {
  const remote = await tryRemoteCreate(setting, input);
  if (remote) return remote;

  const provider = normalizeDefectProvider(setting.provider);
  const defectKey = buildIssueKey(setting, input.defectKey);
  const url = resolveReferenceUrl(defectKey, setting);
  const status = defaultStatuses(provider);
  return {
    defectKey,
    url,
    providerIssueId: `${provider}:${defectKey}`,
    remoteStatus: status.status,
    remoteStatusLabel: status.label,
    createMode: "provider_api",
    usedRemoteApi: false
  };
}

export async function syncProviderIssueStatus(
  setting: DefectIntegrationApiConfig,
  link: { providerIssueId?: string | null; defectKey: string }
): Promise<ProviderIssueStatusSnapshot> {
  const remote = await tryRemoteSync(setting, link);
  if (remote) return remote;

  const provider = normalizeDefectProvider(setting.provider);
  const derived = deriveStatusFromKey(link.defectKey, provider);
  return {
    remoteStatus: derived.status,
    remoteStatusLabel: derived.label,
    syncedAt: new Date(),
    usedRemoteApi: false
  };
}
