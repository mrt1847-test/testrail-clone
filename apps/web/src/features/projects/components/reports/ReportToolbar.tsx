import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { OverflowMenu, SaveFeedback } from "../../../../shared/ui";
import type { ReportExportType } from "../../api/reportsApi";
import { downloadReportCsv } from "../../api/reportsApi";
import { requestReportExportJob } from "../../api/importExportApi";
import { createSavedReport, type SavedReportFilters } from "../../api/savedReportsApi";
import { buildReportPrintPath } from "../../../print/api/reportPrintApi";
import { REPORT_ACTIONS_MENU_LABEL, reportResultMenuGroups } from "../../utils/reportHeaderMenu";
import { ReportFilterPresetSelect } from "./ReportFilterPresetSelect";
import { ReportSaveViewDialog } from "./ReportSaveViewDialog";

type Props = {
  projectId: string;
  reportType: ReportExportType;
  filters: SavedReportFilters;
  exportQuery?: Record<string, string | undefined>;
  disabled?: boolean;
  extra?: ReactNode;
};

export function ReportToolbar({ projectId, reportType, filters, exportQuery, disabled, extra }: Props) {
  const { projectId: routeProjectId = projectId } = useParams();
  const qc = useQueryClient();
  const [saveOpen, setSaveOpen] = useState(false);
  const [busy, setBusy] = useState<"download" | "queue" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedExport, setFailedExport] = useState<"download" | "queue" | null>(null);
  const [queuedJobId, setQueuedJobId] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: (name: string) =>
      createSavedReport({
        projectId,
        name,
        reportType,
        filters
      }),
    onSuccess: () => {
      setSaveOpen(false);
      void qc.invalidateQueries({ queryKey: ["saved-reports", projectId] });
    }
  });

  const printPath = buildReportPrintPath(routeProjectId, reportType, exportQuery);

  async function handleDownload() {
    setBusy("download");
    setError(null);
    setFailedExport(null);
    try {
      await downloadReportCsv(projectId, reportType, exportQuery);
    } catch (e) {
      setFailedExport("download");
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleQueue() {
    setBusy("queue");
    setError(null);
    setFailedExport(null);
    try {
      const { jobId } = await requestReportExportJob(projectId, {
        reportType,
        format: "csv",
        ...exportQuery
      });
      setQueuedJobId(jobId);
      void qc.invalidateQueries({ queryKey: ["report-export-jobs", projectId] });
    } catch (e) {
      setFailedExport("queue");
      setError(e instanceof Error ? e.message : "Could not queue export");
    } finally {
      setBusy(null);
    }
  }

  const groups = reportResultMenuGroups({
    printPath,
    disabled: disabled || busy != null,
    onSaveView: () => {
      saveMutation.reset();
      setSaveOpen(true);
    },
    onExportCsv: () => void handleDownload(),
    onQueueExport: () => void handleQueue()
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ReportFilterPresetSelect projectId={projectId} reportType={reportType} />
        <OverflowMenu label={REPORT_ACTIONS_MENU_LABEL} groups={groups} size="sm" />
        {extra}
      </div>
      {queuedJobId ? (
        <p className="text-xs text-emerald-700">
          Export queued (#{queuedJobId}).{" "}
          <Link to={`/projects/${routeProjectId}/reports/saved`} className="font-medium underline">
            View history
          </Link>
        </p>
      ) : null}
      {error ? (
        <SaveFeedback
          status="failed"
          message={error}
          onRetry={() => void (failedExport === "queue" ? handleQueue() : handleDownload())}
        />
      ) : null}
      <ReportSaveViewDialog
        open={saveOpen}
        saving={saveMutation.isPending}
        saveStatus={saveMutation.isPending ? "saving" : saveMutation.isError ? "failed" : "idle"}
        saveError={saveMutation.error instanceof Error ? saveMutation.error.message : undefined}
        onCancel={() => setSaveOpen(false)}
        onSubmit={(name) => void saveMutation.mutateAsync(name)}
      />
    </div>
  );
}
