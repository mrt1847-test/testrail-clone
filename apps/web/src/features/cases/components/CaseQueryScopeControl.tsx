import type { CaseQueryScope } from "../caseRepositoryView";
import { CASE_QUERY_SCOPES, caseQueryScopeLabel } from "../caseRepositoryView";

type Props = {
  sectionPath: string;
  scope: CaseQueryScope;
  /** Null while the scoped list is still loading so we never announce a stale or zero placeholder. */
  caseCount: number | null;
  onScopeChange: (scope: CaseQueryScope) => void;
  selectAll?: {
    checked: boolean;
    indeterminate: boolean;
    onChange: (checked: boolean) => void;
  };
};

export function formatCaseQueryCountLabel(caseCount: number | null): string {
  if (caseCount == null) return "Updating…";
  return `${caseCount} case${caseCount === 1 ? "" : "s"}`;
}

export function formatCaseQueryCountAnnouncement(
  sectionPath: string,
  scope: CaseQueryScope,
  caseCount: number | null
): string {
  if (caseCount == null) return "Updating case count";
  return `${scope === "all" ? "All sections" : `${sectionPath} · ${caseQueryScopeLabel(scope)}`} · ${formatCaseQueryCountLabel(caseCount)}`;
}

export function CaseQueryScopeControl({
  sectionPath,
  scope,
  caseCount,
  onScopeChange,
  selectAll
}: Props) {
  const countLabel = formatCaseQueryCountLabel(caseCount);
  const countReady = caseCount != null;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-700">
      {selectAll && countReady ? (
        <label className="inline-flex items-center">
          <span className="sr-only">Select all {countLabel} loaded in this list</span>
          <input
            ref={(element) => {
              if (element) element.indeterminate = selectAll.indeterminate;
            }}
            type="checkbox"
            checked={selectAll.checked}
            onChange={(event) => selectAll.onChange(event.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
          />
        </label>
      ) : null}
      {scope !== "all" ? (
        <>
          <span className="min-w-0 break-words font-medium text-slate-800">{sectionPath}</span>
          <span aria-hidden="true" className="text-slate-400">·</span>
        </>
      ) : null}
      <label className="inline-flex min-w-0 items-center gap-1">
        <span className="sr-only">Case query scope</span>
        <select
          aria-label="Case query scope"
          value={scope}
          onChange={(event) => onScopeChange(event.target.value as CaseQueryScope)}
          className="max-w-[min(100%,16rem)] rounded border-0 bg-transparent py-0.5 text-xs font-medium text-slate-800 outline-none ring-1 ring-slate-300 focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          {CASE_QUERY_SCOPES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <span aria-hidden="true" className="text-slate-400">
        ·
      </span>
      <span aria-hidden="true">{countLabel}</span>
      <span className="sr-only" role="status" aria-live="polite">
        {formatCaseQueryCountAnnouncement(sectionPath, scope, caseCount)}
      </span>
    </div>
  );
}
