import type { ChangeEvent } from "react";

import {
  CASE_AUTHORING_ATTACHMENT_ACCEPT,
  CASE_AUTHORING_ATTACHMENT_MAX_FILES,
  canRemoveStagedCaseAttachment,
  stagedCaseAttachmentStatusLabel,
  type StagedCaseAttachment
} from "../utils/caseAuthoringAttachmentStaging";

type Props = {
  files: StagedCaseAttachment[];
  disabled?: boolean;
  rejectMessage?: string | null;
  onAddFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
};

export function CaseAttachmentStagingPanel({
  files,
  disabled = false,
  rejectMessage = null,
  onAddFiles,
  onRemove
}: Props) {
  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";
    if (list.length) onAddFiles(list);
  };

  return (
    <div
      className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-3"
      data-case-attachment-staging
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Case images</p>
          <p className="mt-0.5 text-xs text-slate-600">
            Stage up to {CASE_AUTHORING_ATTACHMENT_MAX_FILES} images. They upload only after the case is saved.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">
          Add images
          <input
            type="file"
            accept={CASE_AUTHORING_ATTACHMENT_ACCEPT}
            multiple
            className="sr-only"
            disabled={disabled || files.length >= CASE_AUTHORING_ATTACHMENT_MAX_FILES}
            onChange={onPick}
          />
        </label>
      </div>

      {files.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500" data-case-attachment-staging-empty>
          No images staged.
        </p>
      ) : (
        <ul className="mt-2 grid gap-1">
          {files.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white px-2 py-1.5"
              data-staged-case-attachment=""
              data-staged-case-attachment-status={row.status}
            >
              <span className="min-w-0 truncate text-xs text-slate-700">
                {row.file.name}
                <span className="ml-2 text-slate-400">
                  {stagedCaseAttachmentStatusLabel(row.status, row.progress)}
                </span>
              </span>
              {canRemoveStagedCaseAttachment(row.status) && row.status !== "uploading" ? (
                <button
                  type="button"
                  disabled={disabled}
                  className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  onClick={() => onRemove(row.id)}
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {rejectMessage ? (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {rejectMessage}
        </p>
      ) : null}
    </div>
  );
}
