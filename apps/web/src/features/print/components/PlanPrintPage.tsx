import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { downloadPrintHtml, fetchPlanPrintDocument } from "../api/printApi";
import { PrintDocumentView } from "./PrintDocumentView";
import { PrintShell } from "./PrintShell";

export function PlanPrintPage() {
  const { projectId = "", planId = "" } = useParams();

  const q = useQuery({
    queryKey: ["print", "plan", projectId, planId],
    queryFn: () => fetchPlanPrintDocument(projectId, planId),
    enabled: Boolean(projectId && planId)
  });

  if (q.isLoading) return <LoadingState message="Preparing print view..." />;
  if (q.isError || !q.data) {
    return <ErrorState title="Could not load print view" onRetry={() => void q.refetch()} />;
  }

  return (
    <PrintShell
      backHref={`/projects/${projectId}/plans/${planId}`}
      backLabel="Back to plan"
      onDownloadHtml={() =>
        void downloadPrintHtml(
          `/api/projects/${projectId}/plans/${planId}/print`,
          `plan-${planId}.html`
        )
      }
    >
      <PrintDocumentView document={q.data} />
    </PrintShell>
  );
}
