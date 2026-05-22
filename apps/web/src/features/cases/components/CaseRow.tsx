import { useEffect, useRef, useState, type DragEvent } from "react";

import { hasRangeMultiSelectModifier } from "../../../shared/selection/rangeMultiSelect";
import { CommentMarkdown } from "../../comments/CommentMarkdown";
import type { CaseExecutionHistoryItem } from "../../runs/types";
import type { CaseListColumn, CaseVersion, TestCase } from "../types";

import type {
  CaseAuthoringCustomFieldDefinition,
  CaseAuthoringTemplateDefinition
} from "./CaseAuthoringForm";
import { formatCustomFieldDisplayValue } from "../utils/formatCustomFieldValue";
import { EntityCopyActions } from "../../../shared/ui/EntityCopyActions";
import { useEntityContextMenu } from "../../../shared/ui/EntityContextMenu";
import { CaseRefTokens } from "./CaseRefTokens";
import { caseRowDensityClasses } from "../../../shared/ui/density/uiDensity";
import type { UiDensity } from "../../../shared/ui/density/uiDensity";
import { ExpandableCaseDetail } from "./ExpandableCaseDetail";

type SummaryColumnPart = { column: CaseListColumn; value: string };
type QuickMetadataPatch = {
  priority?: "low" | "medium" | "high";
  caseType?: "functional" | "integration" | "regression";
};

type CaseRowProps = {
  projectId?: string;
  item: TestCase;
  isExpanded: boolean;
  isPanelOpen?: boolean;
  isKeyboardFocused?: boolean;
  mode: "view" | "edit";
  detail: TestCase | null;
  versions?: CaseVersion[];
  customFields?: CaseAuthoringCustomFieldDefinition[];
  caseTemplates?: CaseAuthoringTemplateDefinition[];
  visibleColumns: CaseListColumn[];
  columnWidths: Record<CaseListColumn, number>;
  isPreviewOpen?: boolean;
  previewDetail?: TestCase | null;
  previewLatestResult?: CaseExecutionHistoryItem | null;
  isPreviewDetailLoading?: boolean;
  isPreviewResultLoading?: boolean;
  isPreviewResultError?: boolean;
  onPreviewEnter?: () => void;
  onPreviewLeave?: () => void;
  isSelected?: boolean;
  onSelectChange?: (checked: boolean) => void;
  onSelectClick?: (event: React.MouseEvent<HTMLInputElement>) => void;
  onOpenCase: () => void;
  onRenameTitle?: (title: string) => Promise<void>;
  isRenamingTitle?: boolean;
  onQuickUpdateMetadata?: (patch: QuickMetadataPatch) => Promise<void>;
  isQuickUpdatingMetadata?: boolean;
  onTogglePanel: () => void;
  onEdit: () => void;
  onCloseDetail: () => void;
  onSave: (patch: {
    title: string;
    preconditions: string;
    references: string;
    expectedResult: string;
    templateId: string | null;
    customValues: Record<string, string | number | boolean | string[] | null>;
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
  renderDetailInline?: boolean;
  density?: UiDensity;
  draggable?: boolean;
  isDraggingThis?: boolean;
  dropIndicator?: "before" | "after" | null;
  onRowDragStart?: (event: DragEvent<HTMLElement>) => void;
  onRowDragEnd?: (event: DragEvent<HTMLElement>) => void;
  onRowDragOver?: (event: DragEvent<HTMLElement>) => void;
  onRowDragLeave?: (event: DragEvent<HTMLElement>) => void;
  onRowDrop?: (event: DragEvent<HTMLElement>) => void;
};

function previewText(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : "-";
}

function previewDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function resultStatusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "passed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "failed") return "border-red-200 bg-red-50 text-red-700";
  if (normalized === "blocked") return "border-amber-200 bg-amber-50 text-amber-700";
  if (normalized === "retest") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

type CaseHoverPreviewProps = {
  item: TestCase;
  detail?: TestCase | null;
  latestResult?: CaseExecutionHistoryItem | null;
  isDetailLoading?: boolean;
  isResultLoading?: boolean;
  isResultError?: boolean;
};

function CaseHoverPreview({
  item,
  detail,
  latestResult,
  isDetailLoading = false,
  isResultLoading = false,
  isResultError = false
}: CaseHoverPreviewProps) {
  const source = detail ?? item;
  const steps = source.steps.slice(0, 2);

  return (
    <div className="pointer-events-none absolute left-9 top-[calc(100%-0.25rem)] z-30 hidden w-[min(32rem,calc(100vw-4rem))] rounded-md border border-slate-200 bg-white p-3 text-left text-xs text-slate-700 shadow-lg sm:block">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-slate-500">{item.caseCode}</p>
          <p className="mt-0.5 max-h-10 overflow-hidden text-sm font-semibold text-slate-900">{source.title}</p>
        </div>
        <span className="shrink-0 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
          {source.priority}
        </span>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_0.9fr]">
        <div className="space-y-2">
          <div>
            <p className="font-medium text-slate-500">Preconditions</p>
            <p className="mt-0.5 max-h-12 overflow-hidden whitespace-pre-wrap text-slate-800">
              {isDetailLoading && !detail ? "Loading..." : previewText(source.preconditions)}
            </p>
          </div>
          <div>
            <p className="font-medium text-slate-500">Steps</p>
            {isDetailLoading && !detail ? (
              <p className="mt-0.5 text-slate-500">Loading...</p>
            ) : steps.length > 0 ? (
              <ol className="mt-1 space-y-1">
                {steps.map((step, index) => (
                  <li key={`${step.id ?? step.stepOrder ?? index}:${index}`} className="grid grid-cols-[1rem_1fr] gap-1">
                    <span className="text-slate-400">{index + 1}.</span>
                    <span className="max-h-10 overflow-hidden whitespace-pre-wrap text-slate-800">
                      {previewText(step.description)}
                      {previewText(step.expected) !== "-" ? (
                        <span className="block text-slate-500">Expected: {previewText(step.expected)}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
                {source.steps.length > steps.length ? (
                  <li className="pl-5 text-slate-500">+{source.steps.length - steps.length} more steps</li>
                ) : null}
              </ol>
            ) : (
              <p className="mt-0.5 text-slate-500">No steps registered.</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <p className="font-medium text-slate-500">Expected result</p>
            <p className="mt-0.5 max-h-12 overflow-hidden whitespace-pre-wrap text-slate-800">
              {isDetailLoading && !detail ? "Loading..." : previewText(source.expectedResult)}
            </p>
          </div>
          <div>
            <p className="font-medium text-slate-500">Latest result</p>
            {isResultLoading ? (
              <p className="mt-0.5 text-slate-500">Loading...</p>
            ) : isResultError ? (
              <p className="mt-0.5 text-slate-500">Unavailable.</p>
            ) : latestResult ? (
              <div className="mt-1 space-y-1">
                <span className={`inline-flex rounded border px-2 py-0.5 font-medium ${resultStatusClass(latestResult.status)}`}>
                  {latestResult.status}
                </span>
                <p className="text-slate-700">{latestResult.runName}</p>
                <p className="text-slate-500">{previewDate(latestResult.createdAt)}</p>
                {latestResult.comment ? (
                  <div className="max-h-10 overflow-hidden text-slate-700">
                    <CommentMarkdown content={latestResult.comment} className="text-sm" />
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-0.5 text-slate-500">No recorded result yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CaseRow({
  projectId,
  item,
  isExpanded,
  isPanelOpen = false,
  isKeyboardFocused = false,
  mode,
  detail,
  versions,
  customFields,
  caseTemplates,
  visibleColumns,
  columnWidths,
  isPreviewOpen = false,
  previewDetail = null,
  previewLatestResult = null,
  isPreviewDetailLoading = false,
  isPreviewResultLoading = false,
  isPreviewResultError = false,
  onPreviewEnter,
  onPreviewLeave,
  isSelected = false,
  onSelectChange,
  onSelectClick,
  onOpenCase,
  onRenameTitle,
  isRenamingTitle = false,
  onQuickUpdateMetadata,
  isQuickUpdatingMetadata = false,
  onTogglePanel,
  onEdit,
  onCloseDetail,
  onSave,
  onDelete,
  onRestoreVersion,
  isSaving,
  submitError,
  restoreError,
  isDeleting,
  isRestoring,
  onCreateStep,
  onUpdateStep,
  onDeleteStep,
  isStepsBusy,
  renderDetailInline = true,
  density = "comfortable",
  draggable = false,
  isDraggingThis = false,
  dropIndicator = null,
  onRowDragStart,
  onRowDragEnd,
  onRowDragOver,
  onRowDragLeave,
  onRowDrop
}: CaseRowProps) {
  const { openEntityContextMenu } = useEntityContextMenu();
  const skipNextSelectChangeRef = useRef(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(item.title);

  useEffect(() => {
    if (!editingTitle) setTitleDraft(item.title);
  }, [editingTitle, item.title]);

  const visibleColumnSet = new Set(visibleColumns);
  const activeCustomFields = (customFields ?? []).filter((field) => field.isActive);
  const visibleCustomValueChips = activeCustomFields
    .map((field) => {
      const value = item.customValues[field.systemName];
      if (value == null || value === "") return null;
      const formatted = formatCustomFieldDisplayValue(value);
      if (!formatted) return null;
      return { key: field.systemName, label: field.name, value: formatted };
    })
    .filter((chip): chip is { key: string; label: string; value: string } => chip != null)
    .slice(0, 3);
  const hiddenCustomValueCount = Math.max(0, activeCustomFields.filter((field) => item.customValues[field.systemName] != null && item.customValues[field.systemName] !== "").length - visibleCustomValueChips.length);
  const visibleLabels = item.labels.slice(0, 3);
  const hiddenLabelCount = Math.max(0, item.labels.length - visibleLabels.length);
  const hasMetaLine =
    (visibleColumnSet.has("refs") && item.references.trim().length > 0) ||
    (visibleColumnSet.has("automation") && item.automationKey.trim().length > 0) ||
    (visibleColumnSet.has("labels") && visibleLabels.length > 0) ||
    (visibleColumnSet.has("customValues") && visibleCustomValueChips.length > 0);
  const summaryParts: SummaryColumnPart[] = [];
  if (visibleColumnSet.has("type")) summaryParts.push({ column: "type", value: item.type });
  if (visibleColumnSet.has("priority")) summaryParts.push({ column: "priority", value: item.priority });
  if (visibleColumnSet.has("automation")) summaryParts.push({ column: "automation", value: item.automationStatus });
  if (visibleColumnSet.has("estimate") && item.estimate !== "-") {
    summaryParts.push({ column: "estimate", value: item.estimate });
  }

  const columnStyle = (column: CaseListColumn) => ({
    width: `${columnWidths[column]}px`,
    maxWidth: `${columnWidths[column]}px`
  });
  const canQuickEditMetadata = Boolean(onQuickUpdateMetadata) && !item.archivedAt;
  const priorityValue = item.priority.toLowerCase() as "low" | "medium" | "high";
  const caseTypeValue = item.type.toLowerCase() as "functional" | "integration" | "regression";
  const inlineSelectClass =
    "rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs text-slate-700 disabled:bg-slate-100 disabled:text-slate-400";

  const densityStyles = caseRowDensityClasses(density ?? "comfortable");

  const rowClasses = [
    "relative flex items-center gap-2 pl-3 transition-colors",
    isPanelOpen
      ? "bg-sky-50 ring-2 ring-inset ring-sky-200"
      : isKeyboardFocused
        ? "bg-amber-50/80 ring-2 ring-inset ring-amber-300"
        : isExpanded
          ? "bg-slate-50"
          : "bg-white hover:bg-slate-50",
    isDraggingThis ? "opacity-50" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      data-case-row-id={item.id}
      className="relative border-b border-slate-100 last:border-0"
      onContextMenu={
        projectId
          ? (event) =>
              openEntityContextMenu(event, {
                projectId,
                kind: "case",
                entityId: item.id,
                caseCode: item.caseCode
              })
          : undefined
      }
      onDragOver={onRowDragOver}
      onDragLeave={onRowDragLeave}
      onDrop={onRowDrop}
    >
      {dropIndicator === "before" ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-3 top-0 h-0.5 -translate-y-px bg-sky-500"
        />
      ) : null}
      {dropIndicator === "after" ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-3 bottom-0 h-0.5 translate-y-px bg-sky-500"
        />
      ) : null}
      <div
        className={rowClasses}
        draggable={draggable}
        onMouseEnter={onPreviewEnter}
        onMouseLeave={onPreviewLeave}
        onDragStart={onRowDragStart}
        onDragEnd={onRowDragEnd}
      >
        <input
          type="checkbox"
          aria-label={`Select ${item.caseCode}`}
          checked={isSelected}
          onChange={(e) => {
            if (skipNextSelectChangeRef.current) {
              skipNextSelectChangeRef.current = false;
              return;
            }
            onSelectChange?.(e.target.checked);
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (hasRangeMultiSelectModifier(e)) {
              skipNextSelectChangeRef.current = true;
              onSelectClick?.(e);
            }
          }}
          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
        />
        {draggable ? (
          <span
            aria-hidden="true"
            title="Drag to move or copy"
            className="select-none text-slate-300 transition-colors hover:text-slate-500"
          >
            ⠿
          </span>
        ) : null}
        <button
          type="button"
          onClick={onOpenCase}
          className={`flex min-w-0 flex-1 items-center text-left ${densityStyles.rowButton}`}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate">
              <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-500">
                {item.caseCode}
                {projectId ? (
                  <EntityCopyActions
                    projectId={projectId}
                    kind="case"
                    entityId={item.id}
                    caseCode={item.caseCode}
                    compact
                  />
                ) : null}
              </span>{" "}
              {editingTitle && onRenameTitle ? (
                <input
                  type="text"
                  value={titleDraft}
                  disabled={isRenamingTitle}
                  autoFocus
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Escape") {
                      setTitleDraft(item.title);
                      setEditingTitle(false);
                    }
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void (async () => {
                        const next = titleDraft.trim();
                        if (next.length === 0 || next === item.title) {
                          setEditingTitle(false);
                          setTitleDraft(item.title);
                          return;
                        }
                        await onRenameTitle(next);
                        setEditingTitle(false);
                      })();
                    }
                  }}
                  onBlur={() => {
                    setTitleDraft(item.title);
                    setEditingTitle(false);
                  }}
                  className="ml-1 w-[min(100%,28rem)] rounded border border-slate-300 px-1.5 py-0.5 text-sm text-slate-900"
                />
              ) : (
                <span
                  className="text-slate-900"
                  onDoubleClick={(event) => {
                    if (!onRenameTitle || item.archivedAt) return;
                    event.preventDefault();
                    event.stopPropagation();
                    setTitleDraft(item.title);
                    setEditingTitle(true);
                  }}
                  title={onRenameTitle ? "Double-click to edit title" : undefined}
                >
                  {item.title}
                </span>
              )}
              {item.archivedAt ? (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  Deleted
                </span>
              ) : null}
            </span>
            {hasMetaLine ? (
              <span className="mt-1 flex flex-wrap gap-1 text-[11px] text-slate-600">
                {visibleColumnSet.has("refs") && item.references.trim().length > 0 ? (
                  <span
                    className="inline-flex max-w-full shrink-0 flex-wrap items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5"
                    style={columnStyle("refs")}
                  >
                    <span className="font-medium text-slate-600">Refs:</span>
                    <CaseRefTokens refsValue={item.references} />
                  </span>
                ) : null}
                {visibleColumnSet.has("automation") && item.automationKey.trim().length > 0 ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                    Auto: {item.automationKey}
                  </span>
                ) : null}
                {visibleColumnSet.has("labels") && visibleLabels.length > 0 ? (
                  <span className="inline-flex shrink-0 flex-wrap gap-1" style={columnStyle("labels")}>
                    {visibleLabels.map((label) => (
                      <span key={label} className="truncate rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">
                        {label}
                      </span>
                    ))}
                  </span>
                ) : null}
                {visibleColumnSet.has("labels") && hiddenLabelCount > 0 ? (
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">+{hiddenLabelCount} labels</span>
                ) : null}
                {visibleColumnSet.has("customValues") && visibleCustomValueChips.length > 0 ? (
                  <span className="inline-flex shrink-0 flex-wrap gap-1" style={columnStyle("customValues")}>
                    {visibleCustomValueChips.map((chip) => (
                      <span key={chip.key} className="truncate rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">
                        {chip.label}: {chip.value}
                      </span>
                    ))}
                  </span>
                ) : null}
                {visibleColumnSet.has("customValues") && hiddenCustomValueCount > 0 ? (
                  <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">
                    +{hiddenCustomValueCount} fields
                  </span>
                ) : null}
              </span>
            ) : null}
          </span>
        </button>
        <span className="hidden shrink-0 items-center justify-end gap-1 px-2 text-right text-xs text-slate-500 sm:flex">
          {visibleColumnSet.has("type") ? (
            <select
              aria-label={`Type for ${item.caseCode}`}
              value={caseTypeValue}
              disabled={!canQuickEditMetadata || isQuickUpdatingMetadata}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => {
                const next = event.target.value as QuickMetadataPatch["caseType"];
                if (next && next !== caseTypeValue) void onQuickUpdateMetadata?.({ caseType: next });
              }}
              className={`${inlineSelectClass} shrink-0`}
              style={columnStyle("type")}
            >
              <option value="functional">Functional</option>
              <option value="integration">Integration</option>
              <option value="regression">Regression</option>
            </select>
          ) : null}
          {visibleColumnSet.has("priority") ? (
            <select
              aria-label={`Priority for ${item.caseCode}`}
              value={priorityValue}
              disabled={!canQuickEditMetadata || isQuickUpdatingMetadata}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => {
                const next = event.target.value as QuickMetadataPatch["priority"];
                if (next && next !== priorityValue) void onQuickUpdateMetadata?.({ priority: next });
              }}
              className={`${inlineSelectClass} shrink-0`}
              style={columnStyle("priority")}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          ) : null}
          {summaryParts.map((part) => (
            part.column === "type" || part.column === "priority" ? null : (
            <span key={part.column} className="shrink-0 truncate" style={columnStyle(part.column)}>
              {part.value}
            </span>
            )
          ))}
        </span>
        <button
          type="button"
          aria-label={isPanelOpen ? "Close side preview" : "Open side preview"}
          aria-expanded={isPanelOpen}
          title={isPanelOpen ? "Close side preview" : "Open side preview"}
          onClick={(event) => {
            event.stopPropagation();
            onTogglePanel();
          }}
          className={[
            "mr-2 flex h-8 w-7 shrink-0 items-center justify-center rounded border text-sm transition-colors",
            isPanelOpen
              ? "border-sky-300 bg-sky-100 text-sky-800"
              : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
          ].join(" ")}
        >
          {isPanelOpen ? "›" : "‹"}
        </button>
        {isPreviewOpen ? (
          <CaseHoverPreview
            item={item}
            detail={previewDetail}
            latestResult={previewLatestResult}
            isDetailLoading={isPreviewDetailLoading}
            isResultLoading={isPreviewResultLoading}
            isResultError={isPreviewResultError}
          />
        ) : null}
      </div>
      {renderDetailInline && isExpanded ? (
        <ExpandableCaseDetail
          data={detail ?? item}
          versions={versions ?? []}
          customFields={customFields ?? []}
          caseTemplates={caseTemplates ?? []}
          mode={mode}
          onEdit={onEdit}
          onClose={onCloseDetail}
          onSave={onSave}
          onDelete={onDelete}
          onRestoreVersion={onRestoreVersion}
          isSaving={isSaving}
          submitError={submitError}
          restoreError={restoreError}
          isDeleting={isDeleting}
          isRestoring={isRestoring}
          onCreateStep={onCreateStep}
          onUpdateStep={onUpdateStep}
          onDeleteStep={onDeleteStep}
          isStepsBusy={isStepsBusy}
        />
      ) : null}
    </article>
  );
}
