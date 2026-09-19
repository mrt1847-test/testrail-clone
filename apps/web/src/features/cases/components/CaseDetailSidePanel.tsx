import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "../../../shared/ui/Button";
import { Drawer } from "../../../shared/ui/Drawer";
import { OverflowMenu } from "../../../shared/ui/OverflowMenu";
import { useEntityContextMenu } from "../../../shared/ui/EntityContextMenu";
import { useToast } from "../../../shared/ui/toast/ToastProvider";
import { copyTextToClipboard } from "../../../shared/utils/clipboard";
import { buildAbsoluteShareUrl, buildEntitySharePath, formatEntityDisplayId } from "../../projects/utils/entityShare";
import { useCaseDetail } from "../hooks/useCaseDetail";
import { buildCaseListPath } from "../caseRoute";
import { caseDetailPanelTitle, caseDetailUtilityMenuGroups } from "../utils/caseDetailPanelHeader";
import { CaseDetailBody } from "./CaseDetailBody";

type Props = {
  projectId: string;
  caseId: number;
  sectionId: number | null;
  mode: "view" | "edit";
  onClose: () => void;
  onEdit: () => void;
  onDuplicated: (copiedCaseId: number) => void;
  presentation?: "inline" | "drawer";
};

export function CaseDetailSidePanel({
  projectId,
  caseId,
  sectionId,
  mode,
  onClose,
  onEdit,
  onDuplicated,
  presentation = "inline"
}: Props) {
  const navigate = useNavigate();
  const isEditing = mode === "edit";
  const { data: casePreview } = useCaseDetail(caseId);
  const { openEntityContextMenu } = useEntityContextMenu();
  const { showToast } = useToast();
  const heading = caseDetailPanelTitle(casePreview?.caseCode, casePreview?.title);

  const utilityGroups = useMemo(() => {
    const groups = caseDetailUtilityMenuGroups({ projectId, caseId, sectionId, isEditing });
    const idText = formatEntityDisplayId("case", caseId, { caseCode: casePreview?.caseCode });
    const shareUrl = buildAbsoluteShareUrl(
      buildEntitySharePath(projectId, "case", caseId, { sectionId })
    );
    return groups.map((group) => ({
      ...group,
      items: group.items.map((item) => {
        if (item.id === "copy-id") {
          return {
            ...item,
            onSelect: () => {
              void copyTextToClipboard(idText).then((ok) => {
                showToast(ok ? `Copied ${idText}` : "Could not copy ID", ok ? "success" : "error");
              });
            }
          };
        }
        if (item.id === "copy-link") {
          return {
            ...item,
            onSelect: () => {
              void copyTextToClipboard(shareUrl).then((ok) => {
                showToast(ok ? "Link copied to clipboard" : "Could not copy link", ok ? "success" : "error");
              });
            }
          };
        }
        return item;
      })
    }));
  }, [caseId, casePreview?.caseCode, isEditing, projectId, sectionId, showToast]);

  const primaryActions = (
    <div className="flex shrink-0 flex-nowrap items-center gap-1.5">
      {!isEditing ? (
        <Button variant="secondary" size="sm" onClick={onEdit}>
          Edit
        </Button>
      ) : null}
      <OverflowMenu label="Case utilities" size="sm" compact groups={utilityGroups} />
    </div>
  );

  const body = (
    <CaseDetailBody
      projectId={projectId}
      caseId={caseId}
      layout="panel"
      showHeading={false}
      onClose={onClose}
      onDeleted={() => navigate(buildCaseListPath(projectId, { sectionId }))}
      onDuplicated={onDuplicated}
    />
  );

  if (presentation === "drawer") {
    return (
      <Drawer
        open
        title={heading}
        onClose={onClose}
        widthClassName="max-w-2xl"
        footer={null}
      >
        <div className="mb-3 flex flex-nowrap items-center justify-end gap-1.5">{primaryActions}</div>
        {body}
      </Drawer>
    );
  }

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
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{heading}</h2>
        {primaryActions}
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
    </aside>
  );
}
