import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import type { ContentHeaderReportContext } from "./contentHeaderReportMenus";
import {
  contentHeaderActionClass,
  contentHeaderDisabledClass,
  contentHeaderPrimaryClass
} from "./contentHeaderStyles";
import { DefectsDropdown } from "./DefectsDropdown";
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
  onCopyMoveCases?: () => void;
};

export function CaseRepositoryContentHeader({ projectId, suiteId, onCopyMoveCases }: CaseRepositoryHeaderProps) {
  return (
    <ProjectContentHeader
      projectId={projectId}
      title="Test Cases"
      subtitle="Suite repository view, grouped by section."
      variant="cases"
      suiteId={suiteId}
      primaryActions={
        <Link
          to={`/projects/${projectId}/runs/new?suiteId=${suiteId}`}
          className={contentHeaderPrimaryClass}
        >
          Run Test
        </Link>
      }
      secondaryActions={
        <>
          <Link to={`/projects/${projectId}/cases/print`} className={contentHeaderActionClass}>
            Print
          </Link>
          <HeaderExportImportMenu projectId={projectId} suiteId={suiteId} />
          <button
            type="button"
            className={onCopyMoveCases ? contentHeaderActionClass : contentHeaderDisabledClass}
            disabled={!onCopyMoveCases}
            title={
              onCopyMoveCases
                ? "Copy or move selected test cases to another section"
                : "Copy/move is unavailable"
            }
            onClick={onCopyMoveCases}
          >
            Copy/Move Cases
          </button>
        </>
      }
    />
  );
}

function HeaderExportImportMenu({ projectId, suiteId }: { projectId: string; suiteId: string }) {
  const exportBase = `/projects/${projectId}/import-export?kind=export&suiteId=${suiteId}`;
  const importBase = `/projects/${projectId}/import-export?kind=import&suiteId=${suiteId}`;

  return (
    <>
      <Link to={exportBase} className={contentHeaderActionClass}>
        Export
      </Link>
      <Link to={importBase} className={contentHeaderActionClass}>
        Import
      </Link>
    </>
  );
}
