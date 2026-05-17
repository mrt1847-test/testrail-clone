import {
  createProviderIssue,
  normalizeDefectCreateMode,
  type DefectIntegrationApiConfig
} from "../../domain/defectProviderApi.js";
import { resolveReferenceUrl } from "../../domain/referenceUrls.js";
import type { DefectIntegrationRow } from "./defectIntegration.service.js";

export type DefectPushOutcomeInput = {
  title: string;
  description: string;
  defectKey?: string;
  customFields?: Record<string, string>;
};

export type DefectPushOutcome = {
  defectKey: string;
  url: string | null;
  providerIssueId: string | null;
  remoteStatus: string | null;
  remoteStatusLabel: string | null;
  remoteStatusSyncedAt: Date | null;
  createMode: string;
};

export function toDefectApiConfig(row: DefectIntegrationRow): DefectIntegrationApiConfig {
  return {
    provider: row.provider,
    isEnabled: row.isEnabled,
    createMode: row.createMode,
    issueUrlTemplate: row.issueUrlTemplate,
    defaultProjectKey: row.defaultProjectKey,
    apiBaseUrl: row.apiBaseUrl,
    apiToken: row.apiToken
  };
}

export async function resolveDefectPushOutcome(
  setting: DefectIntegrationRow,
  input: DefectPushOutcomeInput
): Promise<DefectPushOutcome> {
  const createMode = normalizeDefectCreateMode(setting.createMode);
  if (createMode === "provider_api") {
    const created = await createProviderIssue(toDefectApiConfig(setting), {
      title: input.title,
      description: input.description,
      defectKey: input.defectKey,
      customFields: input.customFields
    });
    const syncedAt = new Date();
    return {
      defectKey: created.defectKey,
      url: created.url,
      providerIssueId: created.providerIssueId,
      remoteStatus: created.remoteStatus,
      remoteStatusLabel: created.remoteStatusLabel,
      remoteStatusSyncedAt: syncedAt,
      createMode: created.createMode
    };
  }

  const generatedKey =
    input.defectKey?.trim() ||
    `${(setting.defaultProjectKey ?? "DEF").toUpperCase()}-${Math.floor(Date.now() / 1000)}`;
  const url = resolveReferenceUrl(generatedKey, setting);
  return {
    defectKey: generatedKey,
    url,
    providerIssueId: null,
    remoteStatus: null,
    remoteStatusLabel: null,
    remoteStatusSyncedAt: null,
    createMode: "url_template"
  };
}
