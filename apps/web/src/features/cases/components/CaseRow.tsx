import { useRef, type DragEvent } from "react";

import { hasRangeMultiSelectModifier } from "../../../shared/selection/rangeMultiSelect";
import type { CaseListColumn, CaseVersion, TestCase } from "../types";

import type {
  CaseAuthoringCustomFieldDefinition,
  CaseAuthoringTemplateDefinition
} from "./CaseAuthoringForm";
import { formatCustomFieldDisplayValue } from "../utils/formatCustomFieldValue";
import { CaseRefTokens } from "./CaseRefTokens";
import { ExpandableCaseDetail } from "./ExpandableCaseDetail";

type CaseRowProps = {
  item: TestCase;
  isExpanded: boolean;
  mode: "view" | "edit";
  detail: TestCase | null;
  versions?: CaseVersion[];
  customFields?: CaseAuthoringCustomFieldDefinition[];
  caseTemplates?: CaseAuthoringTemplateDefinition[];
  visibleColumns: CaseListColumn[];
  isSelected?: boolean;
  onSelectChange?: (checked: boolean) => void;
  onSelectClick?: (event: React.MouseEvent<HTMLInputElement>) => void;
  onToggle: () => void;
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
  opensInDetailPage?: boolean;
  draggable?: boolean;
  isDraggingThis?: boolean;
  dropIndicator?: "before" | "after" | null;
  onRowDragStart?: (event: DragEvent<HTMLElement>) => void;
  onRowDragEnd?: (event: DragEvent<HTMLElement>) => void;
  onRowDragOver?: (event: DragEvent<HTMLElement>) => void;
  onRowDragLeave?: (event: DragEvent<HTMLElement>) => void;
  onRowDrop?: (event: DragEvent<HTMLElement>) => void;
};

export function CaseRow({
  item,
  isExpanded,
  mode,
  detail,
  versions,
  customFields,
  caseTemplates,
  visibleColumns,
  isSelected = false,
  onSelectChange,
  onSelectClick,
  onToggle,
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
  opensInDetailPage = false,
  draggable = false,
  isDraggingThis = false,
  dropIndicator = null,
  onRowDragStart,
  onRowDragEnd,
  onRowDragOver,
  onRowDragLeave,
  onRowDrop
}: CaseRowProps) {
  const skipNextSelectChangeRef = useRef(false);
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
  const summaryParts = [
    visibleColumnSet.has("type") ? item.type : null,
    visibleColumnSet.has("priority") ? item.priority : null,
    visibleColumnSet.has("automation") ? item.automationStatus : null,
    visibleColumnSet.has("estimate") && item.estimate !== "-" ? item.estimate : null
  ].filter((part): part is string => part != null);

  const rowClasses = [
    "relative flex items-center gap-2 pl-3 transition-colors",
    isExpanded ? "bg-slate-50" : "bg-white hover:bg-slate-50",
    isDraggingThis ? "opacity-50" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className="relative border-b border-slate-100 last:border-0"
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
      <div className={rowClasses} draggable={draggable} onDragStart={onRowDragStart} onDragEnd={onRowDragEnd}>
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
          aria-expanded={isExpanded}
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 px-1 py-3 pr-4 text-left text-sm"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate">
              <span className="font-mono text-xs text-slate-500">{item.caseCode}</span>{" "}
              <span className="text-slate-900">{item.title}</span>
              {item.archivedAt ? (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  Archived
                </span>
              ) : null}
            </span>
            {hasMetaLine ? (
              <span className="mt-1 flex flex-wrap gap-1 text-[11px] text-slate-600">
                {visibleColumnSet.has("refs") && item.references.trim().length > 0 ? (
                  <span className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                    <span className="font-medium text-slate-600">Refs:</span>
                    <CaseRefTokens refsValue={item.references} />
                  </span>
                ) : null}
                {visibleColumnSet.has("automation") && item.automationKey.trim().length > 0 ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                    Auto: {item.automationKey}
                  </span>
                ) : null}
                {visibleColumnSet.has("labels") ? visibleLabels.map((label) => (
                  <span key={label} className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">
                    {label}
                  </span>
                )) : null}
                {visibleColumnSet.has("labels") && hiddenLabelCount > 0 ? (
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">+{hiddenLabelCount} labels</span>
                ) : null}
                {visibleColumnSet.has("customValues") ? visibleCustomValueChips.map((chip) => (
                  <span key={chip.key} className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">
                    {chip.label}: {chip.value}
                  </span>
                )) : null}
                {visibleColumnSet.has("customValues") && hiddenCustomValueCount > 0 ? (
                  <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">
                    +{hiddenCustomValueCount} fields
                  </span>
                ) : null}
              </span>
            ) : null}
          </span>
          <span className="shrink-0 text-right text-xs text-slate-500">
            {summaryParts.length > 0 ? summaryParts.join(" / ") : item.caseCode}{" "}
            {opensInDetailPage ? "Open →" : isExpanded ? "▾" : "▸"}
          </span>
        </button>
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
