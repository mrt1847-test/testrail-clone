import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { downloadPrintHtml, fetchMilestonePrintDocument } from "../api/printApi";
import { PrintDocumentView } from "./PrintDocumentView";
import { PrintShell } from "./PrintShell";

export function MilestonePrintPage() {
  const { projectId = "", milestoneId = "" } = useParams();

  const q = useQuery({
    queryKey: ["print", "milestone", projectId, milestoneId],
    queryFn: () => fetchMilestonePrintDocument(projectId, milestoneId),
    enabled: Boolean(projectId && milestoneId)
  });

  if (q.isLoading) return <LoadingState message="Preparing print view..." />;
  if (q.isError || !q.data) {
    return <ErrorState title="Could not load print view" onRetry={() => void q.refetch()} />;
  }

  return (
    <PrintShell
      backHref={`/projects/${projectId}/milestones/${milestoneId}`}
      backLabel="Back to milestone"
      onDownloadHtml={() =>
        void downloadPrintHtml(
          `/api/projects/${projectId}/milestones/${milestoneId}/print`,
          `milestone-${milestoneId}.html`
        )
      }
    >
      <PrintDocumentView document={q.data} />
    </PrintShell>
  );
}
