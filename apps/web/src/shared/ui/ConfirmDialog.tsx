import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

import { Button } from "./Button";
import { Panel } from "./Panel";
import { trapModalTab, useModalFocus } from "./modalFocus";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "danger" | "default";
  confirmDisabled?: boolean;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  variant = "default",
  confirmDisabled = false
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useModalFocus({
    open,
    containerRef: dialogRef,
    initialFocusRef: cancelButtonRef,
    onClose: onCancel,
    closeOnEscape: true
  });

  if (!open) return null;

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    trapModalTab(dialogRef.current, event);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="w-full max-w-md"
        onKeyDown={handleDialogKeyDown}
      >
        <Panel title={<span id={titleId}>{title}</span>}>
          {description ? (
            <div id={descriptionId} className="text-sm text-slate-600 dark:text-slate-400">
              {description}
            </div>
          ) : null}
          <div className={`flex justify-end gap-2 ${description ? "mt-6" : "mt-2"}`}>
            <Button ref={cancelButtonRef} variant="secondary" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button
              variant={variant === "danger" ? "danger" : "primary"}
              disabled={confirmDisabled}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
