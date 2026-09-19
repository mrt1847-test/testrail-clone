import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button, OverflowMenu, WorkbenchPageHeader, type OverflowMenuGroup } from "../../../shared/ui";
import { useProjectArchived } from "../context/ProjectArchiveContext";
import { reportMenuItems, type ContentHeaderReportContext } from "./contentHeaderReportMenus";
import { contentHeaderActionClass } from "./contentHeaderStyles";
import { DefectsDropdown, useDefectDropdownItems } from "./DefectsDropdown";
import { ReportsDropdown } from "./ReportsDropdown";

export type ProjectContentHeaderVariant = ContentHeaderReportContext;

type Props = {
  projectId: string;
  title: string;
  subtitle?: string;
  variant: ProjectContentHeaderVariant;
  suiteId?: string;
  runId?: string;
  onPushDefect?: () => void;
  primaryActions?: ReactNode;
  secondaryActions?: ReactNode;
};

export function ProjectContentHeader({
  projectId,
  title,
  subtitle,
  variant,
  suiteId,
  runId,
  onPushDefect,
  primaryActions,
  secondaryActions
}: Props) {
  const showSharedSteps = variant === "cases";

  return (
    <div className="border border-slate-300 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {primaryActions}
          <ReportsDropdown projectId={projectId} context={variant} suiteId={suiteId} runId={runId} />
          <DefectsDropdown projectId={projectId} runId={runId} onPushDefect={onPushDefect} />
          {showSharedSteps ? (
            <Link to={`/projects/${projectId}/shared-steps`} className={contentHeaderActionClass}>
              Shared Steps
            </Link>
          ) : null}
        </div>
      </div>
      {secondaryActions ? (
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">{secondaryActions}</div>
      ) : null}
    </div>
  );
}

type CaseRepositoryHeaderProps = {
  projectId: string;
  suiteId: string;
  onAddCase: () => void;
  onCopyMoveCases?: () => void;
};

export function CaseRepositoryContentHeader({
  projectId,
  suiteId,
  onAddCase,
  onCopyMoveCases
}: CaseRepositoryHeaderProps) {
  const isProjectArchived = useProjectArchived();
  const defectItems = useDefectDropdownItems({ projectId });
  const reportItems = reportMenuItems(projectId, "cases", { suiteId });
  const groups: OverflowMenuGroup[] = [
    {
      id: "workflow",
      label: "Workflow",
      items: [
        {
          id: "run-test",
          label: "Run this suite",
          description: "Create a test run from the current suite",
          to: `/projects/${projectId}/runs/new?suiteId=${suiteId}`
        },
        {
          id: "shared-steps",
          label: "Shared steps",
          description: "Manage reusable steps for this project",
          to: `/projects/${projectId}/shared-steps`
        }
      ]
    },
    {
      id: "reports",
      label: "Reports",
      items: [
        ...reportItems.map((item, index) => ({
          id: `report-${index}`,
          label: item.label,
          description: item.description,
          to: item.href
        })),
        {
          id: "all-reports",
          label: "All reports",
          description: "Open the reports catalog",
          to: `/projects/${projectId}/reports`
        }
      ]
    },
    {
      id: "defects",
      label: "Defects",
      items: [
        ...defectItems.map((item) => ({
          ...item,
          to: item.external ? undefined : item.href,
          href: item.external ? item.href : undefined
        })),
        {
          id: "defect-settings",
          label: "Defect integration settings",
          to: `/projects/${projectId}/settings/defect-integration`
        }
      ]
    },
    {
      id: "manage",
      label: "Manage and output",
      items: [
        {
          id: "copy-move",
          label: "Copy or move cases",
          description: "Choose cases, then move or copy them to another section",
          disabled: !onCopyMoveCases,
          onSelect: onCopyMoveCases
        },
        {
          id: "import",
          label: "Import cases",
          to: `/projects/${projectId}/import-export?kind=import&suiteId=${suiteId}`
        },
        {
          id: "export",
          label: "Export cases",
          to: `/projects/${projectId}/import-export?kind=export&suiteId=${suiteId}`
        },
        {
          id: "print",
          label: "Print view",
          to: `/projects/${projectId}/cases/print`
        }
      ]
    }
  ];

  return (
    <WorkbenchPageHeader
      title="Test Cases"
      compact
      primaryAction={
        <Button
          size="md"
          disabled={isProjectArchived}
          title={isProjectArchived ? "Archived projects are read-only" : "Add a case to the selected section"}
          onClick={onAddCase}
        >
          Add Case
        </Button>
      }
      utilityAction={<OverflowMenu groups={groups} />}
    />
  );
}
