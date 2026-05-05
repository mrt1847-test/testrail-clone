import type { CaseVersion, TestCase } from "../types";

import type {
  CaseAuthoringCustomFieldDefinition,
  CaseAuthoringTemplateDefinition
} from "./CaseAuthoringForm";
import { ExpandableCaseDetail } from "./ExpandableCaseDetail";

type CaseRowProps = {
  item: TestCase;
  isExpanded: boolean;
  mode: "view" | "edit";
  detail: TestCase | null;
  versions?: CaseVersion[];
  customFields?: CaseAuthoringCustomFieldDefinition[];
  caseTemplates?: CaseAuthoringTemplateDefinition[];
  isSelected?: boolean;
  onSelectChange?: (checked: boolean) => void;
  onToggle: () => void;
  onEdit: () => void;
  onCloseDetail: () => void;
  onSave: (patch: {
    title: string;
    preconditions: string;
    customValues: Record<string, string | number | boolean | null>;
  }) => Promise<void>;
  onDelete: () => Promise<void>;
  onRestoreVersion?: (versionId: number) => Promise<void>;
  isSaving?: boolean;
  submitError?: string | null;
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

export function CaseRow({
  item,
  isExpanded,
  mode,
  detail,
  versions,
  customFields,
  caseTemplates,
  isSelected = false,
  onSelectChange,
  onToggle,
  onEdit,
  onCloseDetail,
  onSave,
  onDelete,
  onRestoreVersion,
  isSaving,
  submitError,
  isDeleting,
  isRestoring,
  onCreateStep,
  onUpdateStep,
  onDeleteStep,
  isStepsBusy
}: CaseRowProps) {
  const activeCustomFields = (customFields ?? []).filter((field) => field.isActive);
  const visibleCustomValueChips = activeCustomFields
    .map((field) => {
      const value = item.customValues[field.systemName];
      if (value == null || value === "") return null;
      return { key: field.systemName, label: field.name, value: String(value) };
    })
    .filter((chip): chip is { key: string; label: string; value: string } => chip != null)
    .slice(0, 3);
  const hiddenCustomValueCount = Math.max(0, activeCustomFields.filter((field) => item.customValues[field.systemName] != null && item.customValues[field.systemName] !== "").length - visibleCustomValueChips.length);
  const visibleLabels = item.labels.slice(0, 3);
  const hiddenLabelCount = Math.max(0, item.labels.length - visibleLabels.length);
  const hasMetaLine =
    item.references.trim().length > 0 ||
    item.automationKey.trim().length > 0 ||
    visibleLabels.length > 0 ||
    visibleCustomValueChips.length > 0;

  return (
    <article className="border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-2 bg-white pl-3 hover:bg-slate-50">
        <input
          type="checkbox"
          aria-label={`Select ${item.caseCode}`}
          checked={isSelected}
          onChange={(e) => onSelectChange?.(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
        />
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
                {item.references.trim().length > 0 ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5">Refs: {item.references}</span>
                ) : null}
                {item.automationKey.trim().length > 0 ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                    Auto: {item.automationKey}
                  </span>
                ) : null}
                {visibleLabels.map((label) => (
                  <span key={label} className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">
                    {label}
                  </span>
                ))}
                {hiddenLabelCount > 0 ? (
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">+{hiddenLabelCount} labels</span>
                ) : null}
                {visibleCustomValueChips.map((chip) => (
                  <span key={chip.key} className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">
                    {chip.label}: {chip.value}
                  </span>
                ))}
                {hiddenCustomValueCount > 0 ? (
                  <span className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">
                    +{hiddenCustomValueCount} fields
                  </span>
                ) : null}
              </span>
            ) : null}
          </span>
          <span className="shrink-0 text-xs text-slate-500">
            {item.type} / {item.priority} / {item.automationStatus}
            {item.estimate !== "-" ? ` / ${item.estimate}` : ""} {isExpanded ? "-" : "+"}
          </span>
        </button>
      </div>
      {isExpanded ? (
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
