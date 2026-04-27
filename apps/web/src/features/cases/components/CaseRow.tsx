import type { TestCase } from "../types";

import { ExpandableCaseDetail } from "./ExpandableCaseDetail";

type CaseRowProps = {
  item: TestCase;
  isExpanded: boolean;
  mode: "view" | "edit";
  detail: TestCase | null;
  onToggle: () => void;
  onEdit: () => void;
  onCloseDetail: () => void;
};

export function CaseRow({ item, isExpanded, mode, detail, onToggle, onEdit, onCloseDetail }: CaseRowProps) {
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
      {isExpanded ? <ExpandableCaseDetail data={detail ?? item} mode={mode} onEdit={onEdit} onClose={onCloseDetail} /> : null}
    </article>
  );
}
