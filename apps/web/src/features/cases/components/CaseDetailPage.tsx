import { useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { PrintLinkButton } from "../../print/components/PrintLinkButton";
import { buildCaseDetailPath, buildCaseListPath } from "../caseRoute";
import { useCaseViewMode } from "../hooks/useCaseViewMode";
import { useCaseDetail } from "../hooks/useCaseDetail";
import { CaseDetailBody } from "./CaseDetailBody";
import { CaseViewModeToggle } from "./CaseViewModeToggle";

function parseSectionId(value: string | null): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function CaseDetailPage() {
  const { projectId = "", caseId: caseIdParam = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { viewMode, setViewMode } = useCaseViewMode();
  const caseId = Number(caseIdParam);
  const sectionId = parseSectionId(searchParams.get("sectionId"));
  const listPath = buildCaseListPath(projectId, { sectionId });
  const { data, isLoading } = useCaseDetail(Number.isNaN(caseId) ? null : caseId);

  useEffect(() => {
    if (viewMode !== "panel" || Number.isNaN(caseId)) return;
    navigate(
      buildCaseListPath(projectId, {
        sectionId,
        caseId,
        mode: searchParams.get("mode") === "edit" ? "edit" : "view"
      }),
      { replace: true }
    );
  }, [caseId, navigate, projectId, searchParams, sectionId, viewMode]);

  if (Number.isNaN(caseId)) {
    return <ErrorState title="Invalid case link" onRetry={() => navigate(listPath)} />;
  }

  if (viewMode === "panel") {
    return <LoadingState message="Opening case in side panel…" />;
  }

  if (isLoading || !data) {
    return <LoadingState message="Loading test case..." />;
  }

  const headerTitle = `${data.caseCode} ${data.title}`;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Test case"
        title={headerTitle}
        description={data.archivedAt ? `Archived on ${new Date(data.archivedAt).toLocaleString()}` : undefined}
        actions={
          <>
            <CaseViewModeToggle
              value={viewMode}
              onChange={(mode) => {
                setViewMode(mode);
                if (mode === "panel") {
                  navigate(
                    buildCaseListPath(projectId, {
                      sectionId,
                      caseId,
                      mode: searchParams.get("mode") === "edit" ? "edit" : "view"
                    }),
                    { replace: true }
                  );
                }
              }}
              compact
            />
            <Link
              to={buildCaseListPath(projectId, { sectionId, caseId, mode: "view" })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to cases
            </Link>
            <PrintLinkButton to={`/projects/${projectId}/cases/${caseId}/print`} />
          </>
        }
      />

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <CaseDetailBody
          projectId={projectId}
          caseId={caseId}
          layout="page"
          onClose={() => navigate(listPath)}
          onDeleted={() => navigate(listPath)}
          onDuplicated={(copiedCaseId) => {
            navigate(buildCaseDetailPath(projectId, copiedCaseId, { sectionId }));
          }}
        />
      </section>
    </div>
  );
}
