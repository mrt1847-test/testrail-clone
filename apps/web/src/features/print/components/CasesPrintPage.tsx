import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { downloadPrintHtml, fetchCasesPrintDocument } from "../api/printApi";
import { PrintDocumentView } from "./PrintDocumentView";
import { PrintShell } from "./PrintShell";

function parseCaseIds(raw: string | null) {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function CasesPrintPage() {
  const { projectId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const caseIds = useMemo(() => parseCaseIds(searchParams.get("ids")), [searchParams]);

  const q = useQuery({
    queryKey: ["print", "cases", projectId, caseIds.join(",")],
    queryFn: () => fetchCasesPrintDocument(projectId, caseIds),
    enabled: Boolean(projectId) && caseIds.length > 0
  });

  if (!caseIds.length) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <p className="text-sm text-slate-600">Select one or more cases in the repository, then choose Print selected.</p>
        <Link to={`/projects/${projectId}/cases`} className="mt-4 inline-block text-sm font-medium text-indigo-800 underline">
          Back to cases
        </Link>
      </div>
    );
  }

  if (q.isLoading) return <LoadingState message="Preparing print view..." />;
  if (q.isError || !q.data) {
    return <ErrorState title="Could not load print view" onRetry={() => void q.refetch()} />;
  }

  const idsQuery = encodeURIComponent(caseIds.join(","));

  return (
    <PrintShell
      backHref={`/projects/${projectId}/cases`}
      backLabel="Back to cases"
      onDownloadHtml={() =>
        void downloadPrintHtml(
          `/api/projects/${projectId}/cases/print?caseIds=${idsQuery}`,
          `cases-${projectId}.html`
        )
      }
    >
      <PrintDocumentView document={q.data} />
    </PrintShell>
  );
}
