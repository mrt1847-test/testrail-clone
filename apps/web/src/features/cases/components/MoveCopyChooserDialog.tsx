import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Button } from "../../../shared/ui";
import { trapModalTab, useModalFocus } from "../../../shared/ui/modalFocus";

type MoveCopyChooserDialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  busy?: boolean;
  pendingAction?: "move" | "copy" | null;
  disabled?: boolean;
  moveDisabled?: boolean;
  onMove: () => void;
  onCopy: () => void;
  onCancel: () => void;
};

export function MoveCopyChooserDialog({
  open,
  title,
  description,
  busy = false,
  pendingAction = null,
  disabled = false,
  moveDisabled = false,
  onMove,
  onCopy,
  onCancel
}: MoveCopyChooserDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus({
    open,
    containerRef: dialogRef,
    onClose: onCancel,
    closeOnEscape: !busy
  });

  useEffect(() => {
    if (!open) return;
    const root = document.getElementById("root");
    if (!root) return;
    root.setAttribute("inert", "");
    return () => root.removeAttribute("inert");
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const moveLabel = busy && pendingAction === "move" ? "Moving..." : "Move";
  const copyLabel = busy && pendingAction === "copy" ? "Copying..." : "Copy";
  const buttonsDisabled = busy || disabled;
  const titleId = "move-copy-chooser-title";

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    trapModalTab(dialogRef.current, event);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-lg"
        onKeyDown={handleDialogKeyDown}
      >
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        {description ? <div className="mt-2 text-sm text-slate-600">{description}</div> : null}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={onCopy} disabled={buttonsDisabled}>
            {copyLabel}
          </Button>
          <Button variant="primary" onClick={onMove} disabled={buttonsDisabled || moveDisabled}>
            {moveLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
