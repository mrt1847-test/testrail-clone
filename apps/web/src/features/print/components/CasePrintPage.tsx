import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { buildCaseListPath } from "../../cases/caseRoute";
import { downloadPrintHtml, fetchCasePrintDocument } from "../api/printApi";
import { PrintDocumentView } from "./PrintDocumentView";
import { PrintShell } from "./PrintShell";

export function CasePrintPage() {
  const { projectId = "", caseId = "" } = useParams();
  const sectionId = null;

  const q = useQuery({
    queryKey: ["print", "case", caseId],
    queryFn: () => fetchCasePrintDocument(caseId),
    enabled: Boolean(caseId)
  });

  if (q.isLoading) return <LoadingState message="Preparing print view..." />;
  if (q.isError || !q.data) {
    return <ErrorState title="Could not load print view" onRetry={() => void q.refetch()} />;
  }

  const backHref = projectId
    ? `/projects/${projectId}/cases/${caseId}`
    : buildCaseListPath(projectId, sectionId);

  return (
    <PrintShell
      backHref={backHref}
      backLabel="Back to case"
      onDownloadHtml={() => void downloadPrintHtml(`/api/cases/${caseId}/print`, `case-${caseId}.html`)}
    >
      <PrintDocumentView document={q.data} />
    </PrintShell>
  );
}
