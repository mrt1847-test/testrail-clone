import { useNavigate } from "react-router-dom";

import { PrintLinkButton } from "../../print/components/PrintLinkButton";
import { buildCaseDetailPath, buildCaseListPath } from "../caseRoute";
import { CaseDetailBody } from "./CaseDetailBody";

type Props = {
  projectId: string;
  caseId: number;
  sectionId: number | null;
  mode: "view" | "edit";
  onClose: () => void;
  onDuplicated: (copiedCaseId: number) => void;
};

export function CaseDetailSidePanel({
  projectId,
  caseId,
  sectionId,
  mode,
  onClose,
  onDuplicated
}: Props) {
  const navigate = useNavigate();

  return (
    <aside
      className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:max-h-[calc(100vh-8rem)]"
      aria-label="Test case preview"
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            title="Open full page"
            onClick={() =>
              navigate(
                buildCaseDetailPath(projectId, caseId, {
                  sectionId,
                  mode: mode === "edit" ? "edit" : "view"
                })
              )
            }
          >
            Open case
          </button>
          <PrintLinkButton to={`/projects/${projectId}/cases/${caseId}/print`} className="!px-2 !py-1 !text-xs" />
          <button
            type="button"
            aria-label="Close preview"
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            Close
          </button>
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
