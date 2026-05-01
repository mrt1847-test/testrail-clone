import { useState } from "react";

import type { ResultAttachmentItem, ResultDefectLinkItem, TestResultHistoryItem, TestResultStepItem } from "../types";

type ResultHistoryListProps = {
  history: TestResultHistoryItem[];
  isHistoryLoading: boolean;
  selectedResultId: string | null;
  onSelectResult: (resultId: string) => void;
  steps: TestResultStepItem[];
  isStepsLoading: boolean;
  attachments: ResultAttachmentItem[];
  isAttachmentsLoading: boolean;
  defects: ResultDefectLinkItem[];
  isDefectsLoading: boolean;
  isAddingAttachment: boolean;
  isOpeningAttachmentDownload: boolean;
  isDeletingAttachment: boolean;
  isAddingDefect: boolean;
  isPushingDefect: boolean;
  isDeletingDefect: boolean;
  pushedDefectMessage?: string | null;
  onAddAttachment: (file: File) => void;
  onOpenAttachmentDownload: (attachmentId: string) => void;
  onDeleteAttachment: (attachmentId: string) => void;
  onAddDefect: (input: { defectKey: string; url?: string }) => void;
  onPushDefect: (input: { defectKey?: string; title?: string; description?: string; provider?: string }) => void;
  onDeleteDefect: (defectLinkId: string) => void;
};

function customValueEntries(item: TestResultHistoryItem) {
  return Object.entries(item.customValues ?? {}).filter(([, value]) => value !== null && value !== "");
}

export function ResultHistoryList({
  history,
  isHistoryLoading,
  selectedResultId,
  onSelectResult,
  steps,
  isStepsLoading,
  attachments,
  isAttachmentsLoading,
  defects,
  isDefectsLoading,
  isAddingAttachment,
  isOpeningAttachmentDownload,
  isDeletingAttachment,
  isAddingDefect,
  isPushingDefect,
  isDeletingDefect,
  pushedDefectMessage,
  onAddAttachment,
  onOpenAttachmentDownload,
  onDeleteAttachment,
  onAddDefect,
  onPushDefect,
  onDeleteDefect
}: ResultHistoryListProps) {
  const [selectedAttachmentFile, setSelectedAttachmentFile] = useState<File | null>(null);
  const [defectKey, setDefectKey] = useState("");
  const [defectUrl, setDefectUrl] = useState("");
  const [pushProvider, setPushProvider] = useState("custom");

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-slate-600">Result history</p>
        <div className="mt-2 max-h-64 space-y-2 overflow-auto">
          {isHistoryLoading ? (
            <p className="text-xs text-slate-500">Loading history...</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-slate-500">No results yet.</p>
          ) : (
            history.map((item) => {
              const values = customValueEntries(item);
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  className={
                    selectedResultId === item.id
                      ? "cursor-pointer rounded border border-slate-400 bg-slate-50 p-2"
                      : "cursor-pointer rounded border border-slate-200 p-2"
                  }
                  onClick={() => onSelectResult(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectResult(item.id);
                    }
                  }}
                >
                  <p className="text-xs font-medium text-slate-800">
                    {item.status} - {new Date(item.createdAt).toLocaleString()}
                  </p>
                  {item.comment ? <p className="text-xs text-slate-700">{item.comment}</p> : null}
                  <p className="text-[11px] text-slate-500">
                    source={item.source}
                    {item.elapsed ? ` - elapsed=${item.elapsed}` : ""}
                    {item.version ? ` - version=${item.version}` : ""}
                  </p>
                  {values.length > 0 ? (
                    <p className="text-[11px] text-slate-500">
                      fields: {values.map(([key, value]) => `${key}=${String(value)}`).join(", ")}
                    </p>
                  ) : null}
                  {item.defects.length > 0 ? (
                    <p className="text-[11px] text-slate-500">defects: {item.defects.join(", ")}</p>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="rounded border border-slate-200 p-2">
        <p className="text-xs font-medium text-slate-700">Step results</p>
        {!selectedResultId ? (
          <p className="mt-1 text-xs text-slate-500">Select a history item to inspect per-step results.</p>
        ) : isStepsLoading ? (
          <p className="mt-1 text-xs text-slate-500">Loading step results...</p>
        ) : steps.length === 0 ? (
          <p className="mt-1 text-xs text-slate-500">No step results for this result.</p>
        ) : (
          <div className="mt-2 max-h-40 space-y-1 overflow-auto">
            {steps.map((step) => (
              <div key={step.id} className="rounded border border-slate-100 p-2">
                <p className="text-[11px] font-medium text-slate-700">
                  Step {step.stepOrder} - {step.status}
                </p>
                {step.actualResult ? <p className="text-[11px] text-slate-600">{step.actualResult}</p> : null}
                {step.comment ? <p className="text-[11px] text-slate-500">{step.comment}</p> : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded border border-slate-200 p-2">
        <p className="text-xs font-medium text-slate-700">Evidence attachments</p>
        {!selectedResultId ? (
          <p className="mt-1 text-xs text-slate-500">Select a result to view or add attachments.</p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                type="file"
                className="min-w-32 flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                onChange={(e) => setSelectedAttachmentFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                disabled={isAddingAttachment || !selectedAttachmentFile}
                onClick={() => {
                  if (!selectedAttachmentFile) return;
                  onAddAttachment(selectedAttachmentFile);
                  setSelectedAttachmentFile(null);
                }}
              >
                {isAddingAttachment ? "Uploading..." : "Upload"}
              </button>
            </div>
            <div className="mt-2 max-h-32 space-y-1 overflow-auto">
              {isAttachmentsLoading ? (
                <p className="text-xs text-slate-500">Loading attachments...</p>
              ) : attachments.length === 0 ? (
                <p className="text-xs text-slate-500">No attachments yet.</p>
              ) : (
                attachments.map((item) => (
                  <div key={item.id} className="rounded border border-slate-100 px-2 py-1 text-[11px] text-slate-600">
                    <p>
                      {item.fileName} - {item.contentType ?? "unknown"} - {item.storagePath}
                    </p>
                    <div className="mt-1 flex gap-1">
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] disabled:opacity-50"
                        disabled={isOpeningAttachmentDownload}
                        onClick={() => onOpenAttachmentDownload(item.id)}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        className="rounded border border-rose-300 px-1.5 py-0.5 text-[11px] text-rose-700 disabled:opacity-50"
                        disabled={isDeletingAttachment}
                        onClick={() => onDeleteAttachment(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <div className="rounded border border-slate-200 p-2">
        <p className="text-xs font-medium text-slate-700">Defect links</p>
        {!selectedResultId ? (
          <p className="mt-1 text-xs text-slate-500">Select a result to view or add defect links.</p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                className="min-w-28 rounded border border-slate-300 px-2 py-1 text-xs"
                placeholder="defect key"
                value={defectKey}
                onChange={(e) => setDefectKey(e.target.value)}
              />
              <input
                className="min-w-32 flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                placeholder="url (optional)"
                value={defectUrl}
                onChange={(e) => setDefectUrl(e.target.value)}
              />
              <select
                className="rounded border border-slate-300 px-2 py-1 text-xs"
                value={pushProvider}
                onChange={(e) => setPushProvider(e.target.value)}
              >
                <option value="custom">custom</option>
                <option value="jira">jira</option>
                <option value="github">github</option>
                <option value="azure">azure</option>
              </select>
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
                disabled={isAddingDefect || !defectKey.trim()}
                onClick={() => {
                  onAddDefect({
                    defectKey: defectKey.trim(),
                    url: defectUrl.trim() || undefined
                  });
                  setDefectKey("");
                  setDefectUrl("");
                }}
              >
                {isAddingDefect ? "Adding..." : "Add"}
              </button>
              <button
                type="button"
                className="rounded border border-indigo-300 px-2 py-1 text-xs text-indigo-700 disabled:opacity-50"
                disabled={isPushingDefect}
                onClick={() =>
                  onPushDefect({
                    defectKey: defectKey.trim() || undefined,
                    title: "Defect from test result",
                    description: selectedResultId ? `Pushed from result ${selectedResultId}` : undefined,
                    provider: pushProvider
                  })
                }
              >
                {isPushingDefect ? "Pushing..." : "Push"}
              </button>
            </div>
            {pushedDefectMessage ? <p className="mt-2 text-[11px] text-emerald-700">{pushedDefectMessage}</p> : null}
            <div className="mt-2 max-h-32 space-y-1 overflow-auto">
              {isDefectsLoading ? (
                <p className="text-xs text-slate-500">Loading defect links...</p>
              ) : defects.length === 0 ? (
                <p className="text-xs text-slate-500">No defect links yet.</p>
              ) : (
                defects.map((item) => (
                  <div key={item.id} className="rounded border border-slate-100 px-2 py-1 text-[11px] text-slate-600">
                    <p>
                      {item.defectKey}
                      {item.url ? ` - ${item.url}` : ""}
                    </p>
                    <button
                      type="button"
                      className="mt-1 rounded border border-rose-300 px-1.5 py-0.5 text-[11px] text-rose-700 disabled:opacity-50"
                      disabled={isDeletingDefect}
                      onClick={() => onDeleteDefect(item.id)}
                    >
                      Unlink
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
