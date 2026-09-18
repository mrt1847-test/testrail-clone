import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

import { Button } from "./Button";
import { IconButton } from "./IconButton";

type DrawerProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  side?: "right" | "left";
  widthClassName?: string;
};

export function Drawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  side = "right",
  widthClassName = "max-w-xl"
}: DrawerProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => previouslyFocused?.focus());
    };
  }, [open]);

  if (!open) return null;

  const position = side === "right" ? "justify-end" : "justify-start";
  const handleDialogKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) ?? []
    ).filter((element) => element.offsetParent !== null);
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex ${position} bg-slate-900/30`}
      role="presentation"
      onClick={onClose}
    >
      <aside
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex h-full w-full ${widthClassName} flex-col border-slate-200 bg-white shadow-xl dark:bg-slate-900 ${
          side === "right" ? "border-l" : "border-r"
        } dark:border-slate-700`}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
            {subtitle ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
          </div>
          <IconButton ref={closeButtonRef} label="Close drawer" onClick={onClose}>
            <span aria-hidden className="text-lg leading-none">
              ×
            </span>
          </IconButton>
        </div>
        <div className="flex-1 overflow-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">{footer}</div>
        ) : (
          <div className="flex justify-end border-t border-slate-200 px-5 py-4 dark:border-slate-700">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </aside>
    </div>
  );
}
