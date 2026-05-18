import { useQuery } from "@tanstack/react-query";

import { fetchDefectIntegrationSettings, fetchDefectTemplatePreview } from "../../projects/api/settingsApi";

export function useDefectAddUrl(projectId: string) {
  const settingsQuery = useQuery({
    queryKey: ["defect-integration-settings", projectId],
    queryFn: () => fetchDefectIntegrationSettings(projectId),
    enabled: Boolean(projectId)
  });

  const settings = settingsQuery.data;
  const integrationEnabled = Boolean(settings?.isEnabled);
  const usesUrlTemplate = settings?.createMode === "url_template";

  const previewQuery = useQuery({
    queryKey: [
      "defect-template-preview",
      projectId,
      settings?.provider,
      settings?.createMode,
      settings?.issueUrlTemplate,
      settings?.defaultProjectKey
    ],
    queryFn: () =>
      fetchDefectTemplatePreview(projectId, {
        provider: settings?.provider,
        createMode: settings?.createMode,
        issueUrlTemplate: settings?.issueUrlTemplate,
        defaultProjectKey: settings?.defaultProjectKey
      }),
    enabled: Boolean(projectId && integrationEnabled && usesUrlTemplate)
  });

  return previewQuery.data?.url ?? null;
}
