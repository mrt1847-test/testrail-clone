import { parseCaseRefs } from "./caseRefs.js";

export type DefectIntegrationForRefs = {
  isEnabled: boolean;
  issueUrlTemplate: string | null;
  defaultProjectKey: string | null;
};

export function resolveReferenceUrl(key: string, setting: DefectIntegrationForRefs): string | null {
  const trimmedKey = key.trim();
  if (!trimmedKey || !setting.isEnabled) return null;
  const template = setting.issueUrlTemplate?.trim();
  if (!template || !template.includes("{key}")) return null;
  return template.replaceAll("{key}", encodeURIComponent(trimmedKey));
}

export function resolveReferenceUrls(
  keys: string[],
  setting: DefectIntegrationForRefs
): Array<{ key: string; url: string | null }> {
  return keys.map((key) => ({ key, url: resolveReferenceUrl(key, setting) }));
}
