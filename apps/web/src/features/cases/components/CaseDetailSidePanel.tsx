import { useNavigate } from "react-router-dom";

import { Button } from "../../../shared/ui/Button";
import { EntityCopyActions } from "../../../shared/ui/EntityCopyActions";
import { useEntityContextMenu } from "../../../shared/ui/EntityContextMenu";
import { useCaseDetail } from "../hooks/useCaseDetail";
import { PrintLinkButton } from "../../print/components/PrintLinkButton";
import { buildCaseDetailPath, buildCaseListPath } from "../caseRoute";
import { CaseDetailBody } from "./CaseDetailBody";

type Props = {
  projectId: string;
  caseId: number;
  sectionId: number | null;
  mode: "view" | "edit";
  onClose: () => void;
  onEdit: () => void;
  onDuplicated: (copiedCaseId: number) => void;
};

export function CaseDetailSidePanel({
  projectId,
  caseId,
  sectionId,
  mode,
  onClose,
  onEdit,
  onDuplicated
}: Props) {
  const navigate = useNavigate();
  const isEditing = mode === "edit";
  const { data: casePreview } = useCaseDetail(caseId);
  const { openEntityContextMenu } = useEntityContextMenu();

  return (
    <aside
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:max-h-[calc(100vh-8rem)]"
      aria-label="Test case preview"
      onContextMenu={(event) =>
        openEntityContextMenu(event, {
          projectId,
          kind: "case",
          entityId: caseId,
          sectionId,
          caseCode: casePreview?.caseCode
        })
      }
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {isEditing ? "Preview (editing in drawer)" : "Preview"}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {casePreview ? (
            <EntityCopyActions
              projectId={projectId}
              kind="case"
              entityId={caseId}
              caseCode={casePreview.caseCode}
              sectionId={sectionId}
              compact
            />
          ) : null}
          {!isEditing ? (
            <Button variant="secondary" size="sm" onClick={onEdit}>
              Edit
            </Button>
          ) : null}
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            title="Open full page"
            onClick={() =>
              navigate(
                buildCaseDetailPath(projectId, caseId, {
                  sectionId,
                  mode: isEditing ? "edit" : "view"
                })
              )
            }
          >
            Open case
          </button>
          <PrintLinkButton to={`/projects/${projectId}/cases/${caseId}/print`} className="!px-2 !py-1 !text-xs" />
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <CaseDetailBody
          projectId={projectId}
          caseId={caseId}
          layout="panel"
          onClose={onClose}
          onDeleted={() => navigate(buildCaseListPath(projectId, { sectionId }))}
          onDuplicated={onDuplicated}
        />
      </div>
    </aside>
  );
}
