import { useEffect } from "react";

export type ShortcutRow = {
  keys: string[];
  description: string;
};

type KeyboardShortcutsDialogProps = {
  open: boolean;
  title?: string;
  shortcuts: ShortcutRow[];
  onClose: () => void;
};

export function KeyboardShortcutsDialog({
  open,
  title = "Keyboard shortcuts",
  shortcuts,
  onClose
}: KeyboardShortcutsDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-shortcuts-title"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="keyboard-shortcuts-title" className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
        <ul className="mt-4 space-y-2">
          {shortcuts.map((row) => (
            <li key={row.description} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-600">{row.description}</span>
              <span className="flex shrink-0 gap-1">
                {row.keys.map((key) => (
                  <kbd
                    key={key}
                    className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-xs text-slate-800"
                  >
                    {key}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-500">Press Esc to close. Shortcuts are disabled while typing in a field.</p>
      </div>
    </div>
  );
}
