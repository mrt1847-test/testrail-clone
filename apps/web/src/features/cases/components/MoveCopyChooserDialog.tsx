import type { ReactNode } from "react";

type MoveCopyChooserDialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  busy?: boolean;
  pendingAction?: "move" | "copy" | null;
  disabled?: boolean;
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
  onMove,
  onCopy,
  onCancel
}: MoveCopyChooserDialogProps) {
  if (!open) return null;

  const moveLabel = busy && pendingAction === "move" ? "Moving..." : "Move";
  const copyLabel = busy && pendingAction === "copy" ? "Copying..." : "Copy";
  const buttonsDisabled = busy || disabled;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-lg"
      >
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description ? <div className="mt-2 text-sm text-slate-600">{description}</div> : null}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onCopy}
            disabled={buttonsDisabled}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copyLabel}
          </button>
          <button
            type="button"
            onClick={onMove}
            disabled={buttonsDisabled}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {moveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
