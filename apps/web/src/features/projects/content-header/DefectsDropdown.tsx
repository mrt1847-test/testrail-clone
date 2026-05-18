import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { fetchDefectIntegrationSettings, fetchDefectTemplatePreview } from "../api/settingsApi";
import { buildReportPageHref } from "../reports/reportRoutes";
import { HeaderDropdown, type HeaderDropdownItem } from "./HeaderDropdown";

type Props = {
  projectId: string;
  runId?: string;
  onPushDefect?: () => void;
};

export function DefectsDropdown({ projectId, runId, onPushDefect }: Props) {
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

  const addDefectUrl = previewQuery.data?.url ?? null;
  const items: HeaderDropdownItem[] = [];

  if (integrationEnabled && usesUrlTemplate && addDefectUrl) {
    items.push({
      id: "add-defect",
      label: "Add defect",
      href: addDefectUrl,
      external: true,
      description: `Open ${previewQuery.data?.providerLabel ?? "issue tracker"} in a new tab`
    });
  } else if (integrationEnabled && settings?.createMode === "provider_api") {
    if (onPushDefect) {
      items.push({
        id: "push-defect",
        label: "Push defect for selected test",
        description: "Create or link an issue for the selected result",
        onSelect: onPushDefect
      });
    } else {
      items.push({
        id: "push-defect-hint",
        label: "Push defect",
        disabled: true,
        description: "Select a test in a run to push a defect"
      });
    }
  }

  items.push({
    id: "defect-summary",
    label: "Defect summary report",
    href: buildReportPageHref(
      projectId,
      "defect_summary",
      runId ? { runId, scopeType: "run", scopeId: runId } : undefined
    )
  });

  items.push({
    id: "defect-coverage",
    label: "Defect coverage report",
    href: buildReportPageHref(projectId, "defect_coverage")
  });

  return (
    <HeaderDropdown
      label="Defects"
      items={items}
      footer={
        <Link
          to={`/projects/${projectId}/settings/defect-integration`}
          className="text-xs font-medium text-blue-700 hover:underline"
        >
          Defect integration settings
        </Link>
      }
    />
  );
}
