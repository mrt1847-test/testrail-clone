import type { ReactNode } from "react";

import type { ReportExportType } from "../../api/reportsApi";
import type { SavedReportFilters } from "../../api/savedReportsApi";
import { ReportExportActions, ReportSaveViewButton } from "./ReportChrome";
import { ReportFilterPresetSelect } from "./ReportFilterPresetSelect";

type Props = {
  projectId: string;
  reportType: ReportExportType;
  filters: SavedReportFilters;
  exportQuery?: Record<string, string | undefined>;
  disabled?: boolean;
  extra?: ReactNode;
};

export function ReportToolbar({ projectId, reportType, filters, exportQuery, disabled, extra }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <ReportFilterPresetSelect projectId={projectId} reportType={reportType} />
      <ReportSaveViewButton
        projectId={projectId}
        reportType={reportType}
        filters={filters}
        disabled={disabled}
      />
      <ReportExportActions
        projectId={projectId}
        reportType={reportType}
        exportQuery={exportQuery}
        disabled={disabled}
      />
      {extra}
    </div>
  );
}
