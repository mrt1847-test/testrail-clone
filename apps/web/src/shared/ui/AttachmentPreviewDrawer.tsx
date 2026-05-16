type AttachmentPreviewItem = {
  id: string;
  fileName: string;
  contentType?: string | null;
  storagePath?: string | null;
  fileSize?: string | null;
  createdAt?: string | null;
};

type AttachmentPreviewDrawerProps = {
  open: boolean;
  attachment: AttachmentPreviewItem | null;
  title: string;
  readOnly?: boolean;
  previewUrl?: string | null;
  isPreviewLoading?: boolean;
  isOpening?: boolean;
  isDeleting?: boolean;
  error?: string | null;
  onClose: () => void;
  onOpen: (attachmentId: string) => void;
  onDelete?: (attachmentId: string) => void;
};

function formatFileSize(size?: string | null) {
  if (!size) return null;
  const value = Number(size);
  if (!Number.isFinite(value)) return size;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(contentType?: string | null) {
  return Boolean(contentType?.toLowerCase().startsWith("image/"));
}

export function AttachmentPreviewDrawer({
  open,
  attachment,
  title,
  readOnly = false,
  previewUrl,
  isPreviewLoading = false,
  isOpening = false,
  isDeleting = false,
  error,
  onClose,
  onOpen,
  onDelete
}: AttachmentPreviewDrawerProps) {
  if (!open || !attachment) return null;

  const size = formatFileSize(attachment.fileSize);
  const canPreview = isImage(attachment.contentType);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30" role="presentation" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
            <h2 className="mt-1 truncate text-base font-semibold text-slate-900">{attachment.fileName}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {attachment.contentType ?? "unknown type"}
              {size ? ` · ${size}` : ""}
            </p>
          </div>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          <div className="flex min-h-72 items-center justify-center rounded-md border border-slate-200 bg-slate-50">
            {isPreviewLoading ? (
              <p className="text-sm text-slate-500">Loading preview...</p>
            ) : canPreview && previewUrl ? (
              <img src={previewUrl} alt={attachment.fileName} className="max-h-[60vh] max-w-full object-contain" />
            ) : canPreview ? (
              <p className="text-sm text-slate-500">Preview is not available yet. Open the file to inspect it.</p>
            ) : (
              <div className="px-6 text-center">
                <p className="text-sm font-medium text-slate-700">No inline preview for this file type.</p>
                <p className="mt-1 text-xs text-slate-500">Open the attachment to inspect or download it.</p>
              </div>
            )}
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Storage path</dt>
              <dd className="mt-1 break-all text-slate-700">{attachment.storagePath ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Created</dt>
              <dd className="mt-1 text-slate-700">
                {attachment.createdAt ? new Date(attachment.createdAt).toLocaleString() : "-"}
              </dd>
            </div>
          </dl>
          {error ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          {!readOnly && onDelete ? (
            <button
              type="button"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
              disabled={isDeleting}
              onClick={() => onDelete(attachment.id)}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            disabled={isOpening}
            onClick={() => onOpen(attachment.id)}
          >
            {isOpening ? "Opening..." : "Open"}
          </button>
        </div>
      </aside>
    </div>
  );
}
