import type { ReactNode } from "react";

import { Button } from "./Button";
import { Panel } from "./Panel";

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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
      <div role="dialog" aria-modal="true" className="w-full max-w-md">
        <Panel title={title}>
          {description ? <div className="text-sm text-slate-600 dark:text-slate-400">{description}</div> : null}
          <div className={`flex justify-end gap-2 ${description ? "mt-6" : "mt-2"}`}>
            <Button variant="secondary" onClick={onCancel}>
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
