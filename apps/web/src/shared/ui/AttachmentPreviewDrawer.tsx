import { Button } from "./Button";
import { Drawer } from "./Drawer";

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
  const subtitle = [attachment.contentType ?? "unknown type", size].filter(Boolean).join(" · ");

  return (
    <Drawer
      open={open}
      title={attachment.fileName}
      subtitle={`${title}${subtitle ? ` · ${subtitle}` : ""}`}
      onClose={onClose}
      footer={
        <>
          {!readOnly && onDelete ? (
            <Button variant="danger" disabled={isDeleting} onClick={() => onDelete(attachment.id)}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          ) : null}
          <Button loading={isOpening} onClick={() => onOpen(attachment.id)}>
            Open
          </Button>
        </>
      }
    >
      <div className="flex min-h-72 items-center justify-center rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
        {isPreviewLoading ? (
          <p className="text-sm text-slate-500">Loading preview...</p>
        ) : canPreview && previewUrl ? (
          <img src={previewUrl} alt={attachment.fileName} className="max-h-[60vh] max-w-full object-contain" />
        ) : canPreview ? (
          <p className="text-sm text-slate-500">Preview is not available yet. Open the file to inspect it.</p>
        ) : (
          <div className="px-6 text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No inline preview for this file type.</p>
            <p className="mt-1 text-xs text-slate-500">Open the attachment to inspect or download it.</p>
          </div>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Storage path</dt>
          <dd className="mt-1 break-all text-slate-700 dark:text-slate-200">{attachment.storagePath ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Created</dt>
          <dd className="mt-1 text-slate-700 dark:text-slate-200">
            {attachment.createdAt ? new Date(attachment.createdAt).toLocaleString() : "-"}
          </dd>
        </div>
      </dl>
      {error ? <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40">{error}</p> : null}
    </Drawer>
  );
}
