import { useState } from "react";

import { buildAbsoluteShareUrl, buildEntitySharePath, formatEntityDisplayId } from "../../features/projects/utils/entityShare";
import type { EntityJumpKind } from "../../features/projects/utils/entityJump";
import { copyTextToClipboard } from "../utils/clipboard";
import { Button } from "./Button";
import { useToast } from "./toast/ToastProvider";

type EntityCopyActionsProps = {
  projectId: string;
  kind: EntityJumpKind;
  entityId: string | number;
  displayId?: string;
  caseCode?: string | null;
  sectionId?: number | null;
  sharePath?: string;
  compact?: boolean;
  className?: string;
};

const compactButtonClass =
  "rounded border border-slate-300 bg-white px-1 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300";

export function EntityCopyActions({
  projectId,
  kind,
  entityId,
  displayId,
  caseCode,
  sectionId,
  sharePath,
  compact = false,
  className = ""
}: EntityCopyActionsProps) {
  const { showToast } = useToast();
  const [idStatus, setIdStatus] = useState<"idle" | "copied" | "error">("idle");
  const [linkStatus, setLinkStatus] = useState<"idle" | "copied" | "error">("idle");

  const idText = displayId ?? formatEntityDisplayId(kind, entityId, { caseCode });
  const relativePath =
    sharePath ?? buildEntitySharePath(projectId, kind, entityId, kind === "case" ? { sectionId } : undefined);
  const shareUrl = buildAbsoluteShareUrl(relativePath);

  async function copyId() {
    const ok = await copyTextToClipboard(idText);
    setIdStatus(ok ? "copied" : "error");
    showToast(ok ? `Copied ${idText}` : "Could not copy ID", ok ? "success" : "error");
    window.setTimeout(() => setIdStatus("idle"), 2000);
  }

  async function copyLink() {
    const ok = await copyTextToClipboard(shareUrl);
    setLinkStatus(ok ? "copied" : "error");
    showToast(ok ? "Link copied to clipboard" : "Could not copy link", ok ? "success" : "error");
    window.setTimeout(() => setLinkStatus("idle"), 2000);
  }

  if (compact) {
    return (
      <span
        className={["inline-flex shrink-0 items-center gap-0.5", className].filter(Boolean).join(" ")}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={compactButtonClass}
          title={`Copy ID ${idText}`}
          aria-label={`Copy ID ${idText}`}
          onClick={() => void copyId()}
        >
          {idStatus === "copied" ? "✓" : "ID"}
        </button>
        <button
          type="button"
          className={compactButtonClass}
          title="Copy link"
          aria-label="Copy link"
          onClick={() => void copyLink()}
        >
          {linkStatus === "copied" ? "✓" : "⧉"}
        </button>
      </span>
    );
  }

  return (
    <span className={["inline-flex flex-wrap items-center gap-1.5", className].filter(Boolean).join(" ")}>
      <Button variant="secondary" size="sm" onClick={() => void copyId()}>
        {idStatus === "copied" ? "Copied ID" : "Copy ID"}
      </Button>
      <Button variant="secondary" size="sm" onClick={() => void copyLink()}>
        {linkStatus === "copied" ? "Copied link" : "Copy link"}
      </Button>
    </span>
  );
}
