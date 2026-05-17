import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { downloadPrintHtml } from "../api/printApi";
import { fetchReportPrintDocument, reportTypeForSlug } from "../api/reportPrintApi";
import { PrintDocumentView } from "./PrintDocumentView";
import { PrintShell } from "./PrintShell";

export function ReportPrintPage() {
  const { projectId = "", reportSlug = "" } = useParams();
  const [searchParams] = useSearchParams();
  const reportType = reportTypeForSlug(reportSlug);

  const exportQuery = useMemo(() => {
    const query: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      query[key] = value;
    });
    return query;
  }, [searchParams]);

  const q = useQuery({
    queryKey: ["print", "report", projectId, reportSlug, searchParams.toString()],
    queryFn: () => {
      if (!reportType) throw new Error("Unsupported report");
      return fetchReportPrintDocument(projectId, reportType, exportQuery);
    },
    enabled: Boolean(projectId && reportType)
  });

  const backHref = reportSlug
    ? `/projects/${projectId}/reports/${reportSlug}`
    : `/projects/${projectId}/reports`;

  if (!reportType) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <p className="text-sm text-slate-600">This report does not support print view.</p>
        <Link to={backHref} className="mt-4 inline-block text-sm font-medium text-indigo-800 underline">
          Back to report
        </Link>
      </div>
    );
  }

  if (q.isLoading) return <LoadingState message="Preparing print view..." />;
  if (q.isError || !q.data) {
    return <ErrorState title="Could not load print view" onRetry={() => void q.refetch()} />;
  }

  const apiQuery = new URLSearchParams({ reportType, format: "html", ...exportQuery }).toString();

  return (
    <PrintShell
      backHref={backHref}
      backLabel="Back to report"
      onDownloadHtml={() =>
        void downloadPrintHtml(
          `/api/projects/${projectId}/reports/print?${apiQuery}`,
          `report-${reportSlug}.html`
        )
      }
    >
      <PrintDocumentView document={q.data} />
    </PrintShell>
  );
}
