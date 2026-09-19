import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { IconButton } from "./IconButton";
import { trapModalTab, useModalFocus } from "./modalFocus";

type DialogProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  disableClose?: boolean;
  titleId?: string;
  initialFocusRef?: { current: HTMLElement | null };
  panelClassName?: string;
};

export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
  closeOnEscape = true,
  closeOnBackdrop = false,
  disableClose = false,
  titleId,
  initialFocusRef,
  panelClassName
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const generatedTitleId = useId();
  const labelledBy = titleId ?? generatedTitleId;

  useModalFocus({
    open,
    containerRef: dialogRef,
    initialFocusRef: initialFocusRef ?? closeButtonRef,
    onClose,
    closeOnEscape: closeOnEscape && !disableClose
  });

  useEffect(() => {
    if (!open) return;
    const root = document.getElementById("root");
    if (!root) return;
    const previousInert = root.inert;
    root.inert = true;
    root.setAttribute("aria-hidden", "true");
    return () => {
      root.inert = previousInert;
      root.removeAttribute("aria-hidden");
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    trapModalTab(dialogRef.current, event);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-3 sm:items-center sm:p-4"
      role="presentation"
      onClick={closeOnBackdrop && !disableClose ? onClose : undefined}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        data-shared-dialog=""
        className={`flex max-h-[calc(100dvh-32px)] w-full max-w-[680px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 ${panelClassName ?? ""}`.trim()}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2
            id={labelledBy}
            className="min-w-0 text-base font-semibold leading-6 text-slate-900 dark:text-slate-100"
          >
            {title}
          </h2>
          <IconButton ref={closeButtonRef} label="Close" disabled={disableClose} onClick={onClose}>
            <span aria-hidden className="text-lg leading-none">
              ×
            </span>
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-slate-200 px-4 py-3 dark:border-slate-700">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
