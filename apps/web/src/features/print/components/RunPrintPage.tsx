import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { downloadPrintHtml, fetchRunPrintDocument } from "../api/printApi";
import { PrintDocumentView } from "./PrintDocumentView";
import { PrintShell } from "./PrintShell";

export function RunPrintPage() {
  const { projectId = "", runId = "" } = useParams();

  const q = useQuery({
    queryKey: ["print", "run", projectId, runId],
    queryFn: () => fetchRunPrintDocument(projectId, runId),
    enabled: Boolean(projectId && runId)
  });

  if (q.isLoading) return <LoadingState message="Preparing print view..." />;
  if (q.isError || !q.data) {
    return <ErrorState title="Could not load print view" onRetry={() => void q.refetch()} />;
  }

  return (
    <PrintShell
      backHref={`/projects/${projectId}/runs/${runId}`}
      backLabel="Back to run"
      onDownloadHtml={() =>
        void downloadPrintHtml(
          `/api/projects/${projectId}/runs/${runId}/print`,
          `run-${runId}.html`
        )
      }
    >
      <PrintDocumentView document={q.data} />
    </PrintShell>
  );
}
