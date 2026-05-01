import type { CaseVersion, TestCase } from "../types";

import { ExpandableCaseDetail } from "./ExpandableCaseDetail";

type CaseCustomFieldDefinition = {
  systemName: string;
  name: string;
  fieldType: "text" | "number" | "select" | "boolean";
  options: string[];
  isRequired: boolean;
  isActive: boolean;
};

type CaseRowProps = {
  item: TestCase;
  isExpanded: boolean;
  mode: "view" | "edit";
  detail: TestCase | null;
  versions?: CaseVersion[];
  customFields?: CaseCustomFieldDefinition[];
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
  isSelected = false,
  onSelectChange,
  onToggle,
  onEdit,
  onCloseDetail,
  onSave,
  onDelete,
  onRestoreVersion,
  isSaving,
  isDeleting,
  isRestoring,
  onCreateStep,
  onUpdateStep,
  onDeleteStep,
  isStepsBusy
}: CaseRowProps) {
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
          <span className="min-w-0 truncate">
            <span className="font-mono text-xs text-slate-500">{item.caseCode}</span>{" "}
            <span className="text-slate-900">{item.title}</span>
          </span>
          <span className="shrink-0 text-xs text-slate-500">
            {item.type} / {item.priority} / {item.automationStatus} {isExpanded ? "-" : "+"}
          </span>
        </button>
      </div>
      {isExpanded ? (
        <ExpandableCaseDetail
          data={detail ?? item}
          versions={versions ?? []}
          customFields={customFields ?? []}
          mode={mode}
          onEdit={onEdit}
          onClose={onCloseDetail}
          onSave={onSave}
          onDelete={onDelete}
          onRestoreVersion={onRestoreVersion}
          isSaving={isSaving}
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
