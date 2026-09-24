import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { Button } from "../../../shared/ui/Button";
import { EntityCopyActions } from "../../../shared/ui/EntityCopyActions";
import { useEntityContextMenu } from "../../../shared/ui/EntityContextMenu";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { PrintLinkButton } from "../../print/components/PrintLinkButton";
import { buildCaseDetailPath, buildCaseListPath, buildEditCasePath } from "../caseRoute";
import {
  CASE_LIST_RETURN_PARAM,
  buildCaseListPathFromReturn
} from "../utils/caseListReturnContext";
import { useRecordRecentlyViewed } from "../../projects/hooks/useRecordRecentlyViewed";
import { useCaseDetail } from "../hooks/useCaseDetail";
import { CaseDetailBody } from "./CaseDetailBody";

function parseSectionId(value: string | null): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function CaseDetailPage() {
  const { projectId = "", caseId: caseIdParam = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const caseId = Number(caseIdParam);
  const sectionId = parseSectionId(searchParams.get("sectionId"));
  const suiteId = searchParams.get("suiteId");
  const returnQuery = searchParams.get(CASE_LIST_RETURN_PARAM);
  const listPath = returnQuery
    ? buildCaseListPathFromReturn({
        projectId,
        returnQuery,
        fallback: { suiteId, sectionId }
      })
    : buildCaseListPath(projectId, { sectionId });
  const { data, isLoading, isError, refetch } = useCaseDetail(Number.isNaN(caseId) ? null : caseId);

  useRecordRecentlyViewed(
    projectId,
    data ? { kind: "case", id: String(data.id), title: `${data.caseCode} ${data.title}` } : null
  );

  if (Number.isNaN(caseId)) {
    return <ErrorState title="Invalid case link" onRetry={() => navigate(listPath)} />;
  }

  if (searchParams.get("mode") === "edit") {
    return (
      <Navigate
        to={buildEditCasePath(projectId, caseId, {
          suiteId,
          sectionId,
          from: "page",
          listParams: searchParams
        })}
        replace
      />
    );
  }

  if (isError) {
    return <ErrorState title="Could not load test case" onRetry={() => void refetch()} />;
  }

  if (isLoading || !data) {
    return <LoadingState message="Loading test case..." />;
  }

  const headerTitle = `${data.caseCode} ${data.title}`;
  const { openEntityContextMenu } = useEntityContextMenu();

  return (
    <div
      className="space-y-4"
      onContextMenu={(event) =>
        openEntityContextMenu(event, {
          projectId,
          kind: "case",
          entityId: caseId,
          sectionId,
          caseCode: data.caseCode
        })
      }
    >
      <PageHeader
        eyebrow="Test case"
        title={headerTitle}
        description={data.archivedAt ? `Archived on ${new Date(data.archivedAt).toLocaleString()}` : undefined}
        actions={
          <>
            {!data.archivedAt ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  navigate(
                    buildEditCasePath(projectId, caseId, {
                      suiteId,
                      sectionId,
                      from: "page",
                      listParams: searchParams
                    })
                  )
                }
              >
                Edit
              </Button>
            ) : null}
            <EntityCopyActions
              projectId={projectId}
              kind="case"
              entityId={caseId}
              caseCode={data.caseCode}
              sectionId={sectionId}
            />
            <Link
              to={listPath}
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
            navigate(buildCaseDetailPath(projectId, copiedCaseId, { sectionId, listParams: searchParams }));
          }}
        />
      </section>
    </div>
  );
}
