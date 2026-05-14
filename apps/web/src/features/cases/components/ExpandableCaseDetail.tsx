import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import {
  deleteCaseAttachment,
  fetchCaseAttachments,
  fetchCaseAttachmentDownloadUrl,
  fetchCaseStepAttachments,
  uploadCaseAttachmentViaPresign,
  uploadCaseStepAttachmentViaPresign
} from "../api/catalogApi";
import type { CaseAttachmentItem, CaseStep, CaseVersion, TestCase } from "../types";
import {
  CaseAuthoringForm,
  type CaseAuthoringCustomFieldDefinition,
  type CaseAuthoringTemplateDefinition
} from "./CaseAuthoringForm";

type ExpandableCaseDetailProps = {
  data: TestCase;
  versions: CaseVersion[];
  customFields?: CaseAuthoringCustomFieldDefinition[];
  caseTemplates?: CaseAuthoringTemplateDefinition[];
  mode: "view" | "edit";
  onEdit: () => void;
  onClose: () => void;
  onSave: (patch: {
    title: string;
    preconditions: string;
    customValues: Record<string, string | number | boolean | null>;
  }) => Promise<void>;
  onDelete: () => Promise<void>;
  onRestoreVersion?: (versionId: number) => Promise<void>;
  isSaving?: boolean;
  submitError?: string | null;
  restoreError?: string | null;
  isDeleting?: boolean;
  isRestoring?: boolean;
  onCreateStep?: (input: { content: string; expected: string }) => Promise<void>;
  onUpdateStep?: (
    stepId: number,
    patch: { content?: string; expectedResult?: string | null; stepOrder?: number }
  ) => Promise<void>;
  onDeleteStep?: (stepId: number) => Promise<void>;
  isStepsBusy?: boolean;
};

type LocalStep = { id?: number; description: string; expected: string };
type DiffRow = { label: string; current: string; version: string; changed: boolean };
type StepDiffRow = {
  stepOrder: number;
  status: "added" | "removed" | "changed" | "unchanged";
  currentAction: string;
  currentExpected: string;
  versionAction: string;
  versionExpected: string;
};

function formatExpectedText(expected: string | null | undefined): string {
  const t = (expected ?? "").trim();
  if (t === "" || t === "-") return "—";
  return t;
}

function formatDiffValue(value: unknown): string {
  if (value == null || value === "") return "—";
  return String(value);
}

function formatFileSize(size: string | null): string {
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 1024 / 102.4) / 10} MB`;
}

function buildFieldDiffs(data: TestCase, version: CaseVersion): DiffRow[] {
  return [
    { label: "Title", current: data.title, version: version.title },
    { label: "Priority", current: data.priority, version: formatDiffValue(version.priority) },
    { label: "Type", current: data.type, version: formatDiffValue(version.caseType) },
    {
      label: "Preconditions",
      current: formatDiffValue(data.preconditions),
      version: formatDiffValue(version.preconditions)
    }
  ].map((row) => ({ ...row, changed: row.current !== row.version }));
}

function buildCustomFieldDiffs(
  data: TestCase,
  version: CaseVersion,
  fields: CaseAuthoringCustomFieldDefinition[]
): DiffRow[] {
  return fields
    .filter((field) => field.isActive)
    .map((field) => {
      const current = formatDiffValue(data.customValues[field.systemName]);
      const snapshot = formatDiffValue(version.customValuesSnapshot?.[field.systemName]);
      return { label: field.name, current, version: snapshot, changed: current !== snapshot };
    });
}

function buildStepDiffs(data: TestCase, version: CaseVersion): StepDiffRow[] {
  const currentByOrder = new Map(data.steps.map((step, index) => [step.stepOrder ?? index + 1, step]));
  const versionByOrder = new Map((version.stepsSnapshot ?? []).map((step) => [step.stepOrder, step]));
  const stepOrders = Array.from(new Set([...currentByOrder.keys(), ...versionByOrder.keys()])).sort((a, b) => a - b);
  return stepOrders.map((stepOrder) => {
    const current = currentByOrder.get(stepOrder);
    const snapshot = versionByOrder.get(stepOrder);
    const currentAction = formatDiffValue(current?.description);
    const currentExpected = formatExpectedText(current?.expected);
    const versionAction = formatDiffValue(snapshot?.content);
    const versionExpected = formatExpectedText(snapshot?.expectedResult);
    const status =
      current && !snapshot
        ? "added"
        : !current && snapshot
          ? "removed"
          : currentAction !== versionAction || currentExpected !== versionExpected
            ? "changed"
            : "unchanged";
    return { stepOrder, status, currentAction, currentExpected, versionAction, versionExpected };
  });
}

/** View mode: Action / Expected 를 카드 두 칸으로 분리 */
function CaseAttachmentControls({
  entityType,
  entityId,
  label,
  readOnly = false
}: {
  entityType: "case" | "case_step";
  entityId: number;
  label: string;
  readOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const queryKey = ["case-attachments", entityType, entityId] as const;

  const attachmentsQuery = useQuery({
    queryKey,
    queryFn: () => (entityType === "case" ? fetchCaseAttachments(entityId) : fetchCaseStepAttachments(entityId))
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) =>
      entityType === "case" ? uploadCaseAttachmentViaPresign(entityId, file) : uploadCaseStepAttachmentViaPresign(entityId, file),
    onSuccess: async () => {
      setSelectedFile(null);
      await queryClient.invalidateQueries({ queryKey });
    }
  });

  const openMutation = useMutation({
    mutationFn: fetchCaseAttachmentDownloadUrl,
    onSuccess: (url) => {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCaseAttachment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    }
  });

  const attachments = attachmentsQuery.data ?? [];
  const isBusy = uploadMutation.isPending || openMutation.isPending || deleteMutation.isPending;
  const error =
    attachmentsQuery.error instanceof Error
      ? attachmentsQuery.error.message
      : uploadMutation.error instanceof Error
        ? uploadMutation.error.message
        : openMutation.error instanceof Error
          ? openMutation.error.message
          : deleteMutation.error instanceof Error
            ? deleteMutation.error.message
            : null;

  if (readOnly && !attachmentsQuery.isLoading && attachments.length === 0 && !error) return null;

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        {!readOnly ? (
          <>
            <input
              type="file"
              accept="image/*"
              className="max-w-[220px] text-xs text-slate-600 file:mr-2 file:rounded file:border file:border-slate-200 file:bg-white file:px-2 file:py-1 file:text-xs file:font-medium file:text-slate-700"
              disabled={isBusy}
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              disabled={!selectedFile || isBusy}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              onClick={() => selectedFile && uploadMutation.mutate(selectedFile)}
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload"}
            </button>
          </>
        ) : null}
      </div>

      {attachments.length > 0 ? (
        <ul className="mt-2 grid gap-1">
          {attachments.map((attachment: CaseAttachmentItem) => {
            const size = formatFileSize(attachment.fileSize);
            return (
              <li
                key={attachment.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white px-2 py-1"
              >
                <span className="min-w-0 truncate text-xs text-slate-700">
                  {attachment.fileName}
                  {size ? <span className="ml-1 text-slate-400">({size})</span> : null}
                </span>
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    disabled={isBusy}
                    className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    onClick={() => openMutation.mutate(attachment.id)}
                  >
                    Open
                  </button>
                  {!readOnly ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-800 hover:bg-red-100 disabled:opacity-50"
                      onClick={() => deleteMutation.mutate(attachment.id)}
                    >
                      Delete
                    </button>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : attachmentsQuery.isLoading ? (
        <p className="mt-1 text-xs text-slate-500">Loading images...</p>
      ) : readOnly ? null : (
        <p className="mt-1 text-xs text-slate-500">No images attached.</p>
      )}
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}

function CaseStepReadOnlyBoxes({
  index,
  action,
  expected,
  stepId
}: {
  index: number;
  action: string;
  expected: string | null | undefined;
  stepId?: number;
}) {
  const actionText = action.trim() || "—";
  return (
    <li className="list-none">
      <div className="flex gap-2.5">
        <span
          className="mt-0.5 flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-700"
          aria-hidden
        >
          {index + 1}
        </span>
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-slate-200 bg-white px-2.5 py-2 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Action</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-snug text-slate-800">{actionText}</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Expected</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-snug text-slate-700">
              {formatExpectedText(expected)}
            </p>
          </div>
        </div>
      </div>
      {stepId != null ? (
        <div className="ml-8 mt-2">
          <CaseAttachmentControls entityType="case_step" entityId={stepId} label="Images" readOnly />
        </div>
      ) : null}
    </li>
  );
}

function toLocalSteps(steps: CaseStep[]): LocalStep[] {
  return steps.map((s) => ({
    id: s.id,
    description: s.description,
    expected: s.expected === "-" ? "" : s.expected
  }));
}

function VersionDetailDrawer({
  version,
  customFields,
  onClose,
  onCompare,
  onRestore,
  isRestoring
}: {
  version: CaseVersion | null;
  customFields: CaseAuthoringCustomFieldDefinition[];
  onClose: () => void;
  onCompare: () => void;
  onRestore?: () => void;
  isRestoring: boolean;
}) {
  if (!version) return null;

  const activeCustomFields = customFields.filter((field) => field.isActive);
  const versionSteps = version.stepsSnapshot ?? [];
  const versionAttachments = version.attachmentSnapshots ?? [];
  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-slate-900/30"
        aria-label="Close version details"
        onClick={onClose}
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Version snapshot</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">v{version.versionNo}</h3>
              <p className="mt-1 text-sm text-slate-500">
                {version.changeReason ?? "updated"} on {new Date(version.createdAt).toLocaleString()}
              </p>
            </div>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-600 hover:bg-slate-50"
              onClick={onClose}
            >
              Close
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={onCompare}
            >
              Compare
            </button>
            {onRestore ? (
              <button
                type="button"
                disabled={isRestoring}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                onClick={onRestore}
              >
                {isRestoring ? "Restoring..." : "Restore"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <section className="rounded-md border border-slate-200">
            <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
              Fields
            </div>
            <dl className="grid gap-3 p-3 text-sm text-slate-700">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Title</dt>
                <dd className="mt-1 whitespace-pre-wrap">{version.title || "-"}</dd>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Priority</dt>
                  <dd className="mt-1">{formatDiffValue(version.priority)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Type</dt>
                  <dd className="mt-1">{formatDiffValue(version.caseType)}</dd>
                </div>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Preconditions</dt>
                <dd className="mt-1 whitespace-pre-wrap">{formatDiffValue(version.preconditions)}</dd>
              </div>
            </dl>
          </section>

          {activeCustomFields.length > 0 ? (
            <section className="mt-3 rounded-md border border-slate-200">
              <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
                Custom Fields
              </div>
              <dl className="grid gap-3 p-3 text-sm text-slate-700 sm:grid-cols-2">
                {activeCustomFields.map((field) => (
                  <div key={field.systemName}>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{field.name}</dt>
                    <dd className="mt-1 break-words">
                      {formatDiffValue(version.customValuesSnapshot?.[field.systemName])}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          <section className="mt-3 rounded-md border border-slate-200">
            <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
              Steps
            </div>
            {versionSteps.length === 0 ? (
              <p className="p-3 text-sm text-slate-500">No steps captured in this version.</p>
            ) : (
              <ol className="grid gap-3 p-3">
                {versionSteps.map((step) => (
                  <li key={`${version.id}-${step.stepOrder}`} className="rounded-md border border-slate-100 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Step {step.stepOrder}
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium text-slate-500">Action</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                          {formatDiffValue(step.content)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500">Expected</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                          {formatExpectedText(step.expectedResult)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="mt-3 rounded-md border border-slate-200">
            <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
              Attachment Context
            </div>
            {versionAttachments.length === 0 ? (
              <p className="p-3 text-sm text-slate-500">No case or step attachments captured in this version.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm text-slate-700">
                {versionAttachments.map((attachment) => (
                  <li key={`${attachment.entityType}-${attachment.id}`} className="grid gap-1 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-slate-800">{attachment.fileName}</span>
                      <span className="text-xs text-slate-500">
                        {attachment.entityType === "case_step" && attachment.stepOrder != null
                          ? `Step ${attachment.stepOrder}`
                          : "Case"}
                      </span>
                    </div>
                    <p className="break-all text-xs text-slate-500">
                      {attachment.contentType ?? "file"} · {attachment.fileSize ?? "-"} bytes · {attachment.storagePath}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}

export function ExpandableCaseDetail({
  data,
  versions,
  customFields = [],
  caseTemplates = [],
  mode,
  onEdit,
  onClose,
  onSave,
  onDelete,
  onRestoreVersion,
  isSaving = false,
  submitError = null,
  restoreError = null,
  isDeleting = false,
  isRestoring = false,
  onCreateStep,
  onUpdateStep,
  onDeleteStep,
  isStepsBusy = false
}: ExpandableCaseDetailProps) {
  const [title, setTitle] = useState(data.title);
  const [preconditions, setPreconditions] = useState(data.preconditions);
  const [customValues, setCustomValues] = useState<Record<string, string | number | boolean | null>>(
    () => data.customValues ?? {}
  );
  const [localSteps, setLocalSteps] = useState<LocalStep[]>(() => toLocalSteps(data.steps));
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [stepDeleteId, setStepDeleteId] = useState<number | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [detailVersionId, setDetailVersionId] = useState<number | null>(null);
  const [restoreVersionId, setRestoreVersionId] = useState<number | null>(null);
  const selectedVersion = versions.find((version) => version.id === selectedVersionId) ?? null;
  const detailVersion = versions.find((version) => version.id === detailVersionId) ?? null;
  const selectedFieldDiffs = selectedVersion ? buildFieldDiffs(data, selectedVersion) : [];
  const selectedCustomDiffs = selectedVersion ? buildCustomFieldDiffs(data, selectedVersion, customFields) : [];
  const selectedStepDiffs = selectedVersion ? buildStepDiffs(data, selectedVersion) : [];
  const selectedChangedDiffs = [...selectedFieldDiffs, ...selectedCustomDiffs].filter((row) => row.changed);
  const selectedChangedStepDiffs = selectedStepDiffs.filter((row) => row.status !== "unchanged");
  const selectedChangeCount = selectedChangedDiffs.length + selectedChangedStepDiffs.length;

  useEffect(() => {
    setTitle(data.title);
    setPreconditions(data.preconditions);
    setCustomValues(data.customValues ?? {});
  }, [data.id, data.title, data.preconditions, data.customValues]);

  useEffect(() => {
    if (mode === "edit") {
      setLocalSteps(toLocalSteps(data.steps));
    }
  }, [mode, data.id, data.steps]);

  function moveStep(stepId: number, direction: "up" | "down") {
    const idx = localSteps.findIndex((s) => s.id === stepId);
    if (idx < 0) return;
    const swap = direction === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= localSteps.length) return;
    if (localSteps[swap]?.id == null) return;
    void onUpdateStep?.(stepId, { stepOrder: swap + 1 });
  }

  function persistStepIfChanged(step: LocalStep, index: number) {
    if (step.id == null || !onUpdateStep) return;
    const original = data.steps.find((s) => s.id === step.id);
    if (!original) return;

    const content = step.description.trim();
    const expected = step.expected.trim();
    const originalExpected = original.expected === "-" ? "" : original.expected;
    if (original.description !== content || originalExpected !== expected) {
      void onUpdateStep(step.id, {
        content,
        expectedResult: expected.length ? expected : null,
        stepOrder: index + 1
      });
    }
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50 px-4 py-4">
      <h4 className="text-sm font-semibold text-slate-900">
        {data.caseCode} {data.title}
      </h4>
      {data.archivedAt ? (
        <p className="mt-1 text-xs font-medium text-amber-700">
          Archived on {new Date(data.archivedAt).toLocaleString()}
        </p>
      ) : null}

      {mode === "edit" ? (
        <div className="mt-3 grid gap-3">
          <CaseAttachmentControls entityType="case" entityId={data.id} label="Case images" />
          <CaseAuthoringForm
            valueKey={`${data.id}:${data.lockVersion}:${mode}`}
            initialTitle={title}
            initialPreconditions={preconditions}
            initialCustomValues={customValues}
            customFields={customFields}
            templates={caseTemplates}
            submitLabel={isSaving ? "Saving..." : "Save"}
            isSubmitting={isSaving}
            submitError={submitError}
            stepsSection={
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-800">Steps</span>
                  <button
                    type="button"
                    disabled={isStepsBusy || !onCreateStep}
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    onClick={() => void onCreateStep?.({ content: "New step", expected: "" })}
                  >
                    {isStepsBusy ? "Saving..." : "Add step"}
                  </button>
                </div>
                {localSteps.length === 0 ? (
                  <p className="text-xs text-slate-500">No steps yet.</p>
                ) : (
                  <ol className="list-decimal space-y-3 pl-5 text-sm">
                    {localSteps.map((step, index) => (
                      <li
                        key={step.id ?? `local-${index}`}
                        className="grid gap-2 rounded-md border border-slate-200 bg-white p-2"
                      >
                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            disabled={isStepsBusy || step.id == null || index === 0}
                            className="rounded border border-slate-200 px-1.5 py-0.5 text-xs disabled:opacity-40"
                            onClick={() => step.id != null && moveStep(step.id, "up")}
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            disabled={isStepsBusy || step.id == null || index === localSteps.length - 1}
                            className="rounded border border-slate-200 px-1.5 py-0.5 text-xs disabled:opacity-40"
                            onClick={() => step.id != null && moveStep(step.id, "down")}
                          >
                            Down
                          </button>
                          {step.id != null ? (
                            <button
                              type="button"
                              disabled={isStepsBusy}
                              className="ml-auto rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-xs text-red-800"
                              onClick={() => setStepDeleteId(step.id!)}
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>

                        <label className="grid gap-0.5 text-xs text-slate-600">
                          Action
                          <textarea
                            value={step.description}
                            disabled={isStepsBusy}
                            onChange={(e) => {
                              const value = e.target.value;
                              setLocalSteps((prev) =>
                                prev.map((s, i) => (i === index ? { ...s, description: value } : s))
                              );
                            }}
                            onBlur={() => persistStepIfChanged(step, index)}
                            className="min-h-[56px] rounded border border-slate-200 px-2 py-1 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-slate-400"
                          />
                        </label>

                        <label className="grid gap-0.5 text-xs text-slate-600">
                          Expected
                          <textarea
                            value={step.expected}
                            disabled={isStepsBusy}
                            onChange={(e) => {
                              const value = e.target.value;
                              setLocalSteps((prev) => prev.map((s, i) => (i === index ? { ...s, expected: value } : s)));
                            }}
                            onBlur={() => persistStepIfChanged(step, index)}
                            className="min-h-[44px] rounded border border-slate-200 px-2 py-1 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-slate-400"
                          />
                        </label>
                        {step.id != null ? (
                          <CaseAttachmentControls entityType="case_step" entityId={step.id} label="Images" />
                        ) : (
                          <p className="text-xs text-slate-500">Save the step before adding images.</p>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </>
            }
            onSubmit={async (input) => {
              await onSave({
                title: input.title,
                preconditions: input.preconditions,
                customValues: input.customValues
              });
            }}
            onCancel={onClose}
          />
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-medium">Type:</span> {data.type} / <span className="font-medium">Priority:</span>{" "}
            {data.priority} / <span className="font-medium">Estimate:</span> {data.estimate}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium">References:</span> {data.references || "-"} /{" "}
            <span className="font-medium">Automation key:</span> {data.automationKey || "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium">Labels:</span> {data.labels.length > 0 ? data.labels.join(", ") : "-"}
          </p>
          <p className="text-sm text-slate-700">
            <span className="font-medium">Preconditions:</span> {data.preconditions || "-"}
          </p>
          <div className="mt-2">
            <CaseAttachmentControls entityType="case" entityId={data.id} label="Case images" readOnly />
          </div>

          <details className="group mt-2 overflow-hidden rounded-md border border-slate-200 bg-white">
            <summary className="cursor-pointer list-none px-2.5 py-2 text-xs text-slate-500 marker:hidden [&::-webkit-details-marker]:hidden">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-medium text-slate-600">Version history</span>
                  {versions.length > 0 ? (
                    <span className="text-slate-400"> · {versions.length} snapshot{versions.length === 1 ? "" : "s"}</span>
                  ) : null}
                  <p className="mt-0.5 text-[11px] font-normal text-slate-400">Click to show or hide</p>
                </div>
                <span
                  className="shrink-0 pt-0.5 text-slate-400 transition group-open:rotate-90"
                  aria-hidden
                >
                  ▸
                </span>
              </div>
            </summary>
            <div className="border-t border-slate-100 px-2.5 pb-2.5 pt-2">
              <div className="mb-2 flex items-center justify-end gap-2">
                {selectedVersion ? (
                  <button
                    type="button"
                    className="text-[11px] font-medium text-slate-600 underline"
                    onClick={() => setSelectedVersionId(null)}
                  >
                    Clear selection
                  </button>
                ) : null}
              </div>
              {versions.length === 0 ? (
                <p className="text-xs text-slate-500">No versions yet.</p>
              ) : (
                <ul className="space-y-1 text-xs text-slate-600">
                  {versions.map((v) => (
                    <li key={v.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <button
                        type="button"
                        className={
                          selectedVersionId === v.id
                            ? "font-medium text-slate-900 underline"
                            : "font-medium text-slate-700 underline"
                        }
                        onClick={() => setSelectedVersionId(v.id)}
                      >
                        v{v.versionNo}
                      </button>
                      <span className="text-slate-500">{v.changeReason ?? "updated"}</span>
                      <span className="text-slate-400">{new Date(v.createdAt).toLocaleString()}</span>
                      <button
                        type="button"
                        className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                        onClick={() => setDetailVersionId(v.id)}
                      >
                        Details
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>

          {selectedVersion ? (
            <div className="mt-2 rounded border border-slate-200 bg-white p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-slate-700">Compare with v{selectedVersion.versionNo}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {selectedChangeCount === 0
                      ? "No differences from the current case."
                      : `${selectedChangeCount} difference${selectedChangeCount === 1 ? "" : "s"} found.`}
                  </p>
                </div>
                {onRestoreVersion ? (
                  <button
                    type="button"
                    disabled={isRestoring}
                    className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-50"
                    onClick={() => setRestoreVersionId(selectedVersion.id)}
                  >
                    {isRestoring ? "Restoring..." : "Restore"}
                  </button>
                ) : null}
              </div>
              {restoreError ? (
                <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {restoreError}
                </div>
              ) : null}
              {selectedChangedDiffs.length > 0 ? (
                <dl className="mt-2 grid gap-2 text-xs text-slate-600">
                  {selectedChangedDiffs.map((row) => (
                    <div
                      key={row.label}
                      className="grid gap-1 rounded border border-amber-200 bg-amber-50/50 p-2 sm:grid-cols-[120px_1fr_1fr]"
                    >
                      <dt className="font-medium text-slate-700">{row.label}</dt>
                      <dd>
                        <span className="font-medium text-slate-500">Current:</span> {row.current}
                      </dd>
                      <dd>
                        <span className="font-medium text-slate-500">Version:</span> {row.version}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {selectedChangedStepDiffs.length > 0 ? (
                <div className="mt-2 grid gap-2 text-xs text-slate-600">
                  {selectedChangedStepDiffs.map((row) => (
                    <div key={row.stepOrder} className="rounded border border-slate-100 p-2">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-slate-700">Step {row.stepOrder}</p>
                        <span
                          className={
                            row.status === "added"
                              ? "rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800"
                              : row.status === "removed"
                                ? "rounded bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800"
                                : "rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                          }
                        >
                          {row.status}
                        </span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded border border-slate-100 bg-slate-50 p-2">
                          <p className="font-medium text-slate-700">Current</p>
                          <p className="mt-1 whitespace-pre-wrap">{row.currentAction}</p>
                          <p className="mt-2 text-slate-500">Expected</p>
                          <p className="whitespace-pre-wrap">{row.currentExpected}</p>
                        </div>
                        <div className="rounded border border-slate-100 bg-white p-2">
                          <p className="font-medium text-slate-700">Version</p>
                          <p className="mt-1 whitespace-pre-wrap">{row.versionAction}</p>
                          <p className="mt-2 text-slate-500">Expected</p>
                          <p className="whitespace-pre-wrap">{row.versionExpected}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              <details className="mt-2 rounded border border-slate-100 bg-slate-50">
                <summary className="cursor-pointer px-2 py-1.5 text-xs font-medium text-slate-600">
                  Show unchanged fields and steps
                </summary>
                <div className="grid gap-2 border-t border-slate-100 p-2 text-xs text-slate-600">
                  {[...selectedFieldDiffs, ...selectedCustomDiffs]
                    .filter((row) => !row.changed)
                    .map((row) => (
                      <div key={row.label} className="grid gap-1 sm:grid-cols-[120px_1fr_1fr]">
                        <span className="font-medium text-slate-700">{row.label}</span>
                        <span>Current: {row.current}</span>
                        <span>Version: {row.version}</span>
                      </div>
                    ))}
                  {selectedStepDiffs.filter((row) => row.status === "unchanged").length > 0 ? (
                    <p>{selectedStepDiffs.filter((row) => row.status === "unchanged").length} unchanged step(s)</p>
                  ) : null}
                </div>
              </details>
            </div>
          ) : null}

          {customFields.filter((field) => field.isActive).length > 0 ? (
            <div className="mt-2 rounded border border-slate-200 bg-white p-2">
              <p className="text-xs font-medium text-slate-700">Custom fields</p>
              <dl className="mt-1 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                {customFields
                  .filter((field) => field.isActive)
                  .map((field) => (
                    <div key={field.systemName} className="flex gap-1">
                      <dt className="font-medium">{field.name}:</dt>
                      <dd>{data.customValues[field.systemName] == null ? "-" : String(data.customValues[field.systemName])}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          ) : null}

          {data.steps.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No steps registered.</p>
          ) : (
            <div className="mt-3">
              <p className="text-xs font-medium text-slate-700">Steps</p>
              <ol className="mt-2 space-y-3">
                {data.steps.map((step, index) => (
                  <CaseStepReadOnlyBoxes
                    key={step.id ?? `${data.id}-s-${index}`}
                    index={index}
                    action={step.description}
                    expected={step.expected}
                    stepId={step.id}
                  />
                ))}
              </ol>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Edit
            </button>
            <button
              type="button"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-800 hover:bg-red-100"
              onClick={() => setConfirmDeleteOpen(true)}
            >
              Delete
            </button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete this test case?"
        description="This action cannot be undone."
        confirmLabel={isDeleting ? "Deleting..." : "Delete"}
        confirmDisabled={isDeleting}
        variant="danger"
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          void onDelete();
        }}
      />

      <ConfirmDialog
        open={stepDeleteId != null}
        title="Remove this step?"
        description="The remaining steps will be renumbered."
        confirmLabel={isStepsBusy ? "Removing..." : "Remove"}
        confirmDisabled={isStepsBusy}
        variant="danger"
        onCancel={() => setStepDeleteId(null)}
        onConfirm={() => {
          const id = stepDeleteId;
          setStepDeleteId(null);
          if (id != null) void onDeleteStep?.(id);
        }}
      />

      <ConfirmDialog
        open={restoreVersionId != null}
        title="Restore this version?"
        description="The selected snapshot will become the current case and a new version will be created."
        confirmLabel={isRestoring ? "Restoring..." : "Restore"}
        confirmDisabled={isRestoring}
        onCancel={() => setRestoreVersionId(null)}
        onConfirm={() => {
          const id = restoreVersionId;
          setRestoreVersionId(null);
          if (id != null) void onRestoreVersion?.(id);
        }}
      />

      <VersionDetailDrawer
        version={detailVersion}
        customFields={customFields}
        isRestoring={isRestoring}
        onClose={() => setDetailVersionId(null)}
        onCompare={() => {
          if (detailVersion) {
            setSelectedVersionId(detailVersion.id);
            setDetailVersionId(null);
          }
        }}
        onRestore={
          onRestoreVersion && detailVersion
            ? () => {
                setRestoreVersionId(detailVersion.id);
                setDetailVersionId(null);
              }
            : undefined
        }
      />
    </div>
  );
}
