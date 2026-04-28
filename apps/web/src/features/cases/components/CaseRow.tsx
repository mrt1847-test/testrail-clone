import type { CaseVersion, TestCase } from "../types";

import { ExpandableCaseDetail } from "./ExpandableCaseDetail";

type CaseRowProps = {
  item: TestCase;
  isExpanded: boolean;
  mode: "view" | "edit";
  detail: TestCase | null;
  versions?: CaseVersion[];
  onToggle: () => void;
  onEdit: () => void;
  onCloseDetail: () => void;
  onSave: (patch: { title: string; preconditions: string }) => Promise<void>;
  onDelete: () => Promise<void>;
  isSaving?: boolean;
  isDeleting?: boolean;
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
  onToggle,
  onEdit,
  onCloseDetail,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
  onCreateStep,
  onUpdateStep,
  onDeleteStep,
  isStepsBusy
}: CaseRowProps) {
  return (
    <article className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 bg-white px-4 py-3 text-left text-sm hover:bg-slate-50"
      >
        <span className="min-w-0 truncate">
          <span className="font-mono text-xs text-slate-500">{item.caseCode}</span>{" "}
          <span className="text-slate-900">{item.title}</span>
        </span>
        <span className="shrink-0 text-xs text-slate-500">
          {item.type} / {item.priority} / {item.automationStatus} {isExpanded ? "▼" : "▶"}
        </span>
      </button>
      {isExpanded ? (
        <ExpandableCaseDetail
          data={detail ?? item}
          versions={versions ?? []}
          mode={mode}
          onEdit={onEdit}
          onClose={onCloseDetail}
          onSave={onSave}
          onDelete={onDelete}
          isSaving={isSaving}
          isDeleting={isDeleting}
          onCreateStep={onCreateStep}
          onUpdateStep={onUpdateStep}
          onDeleteStep={onDeleteStep}
          isStepsBusy={isStepsBusy}
        />
      ) : null}
    </article>
  );
}
