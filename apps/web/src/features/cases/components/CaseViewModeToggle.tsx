import type { CaseViewMode } from "../caseViewMode";

type Props = {
  value: CaseViewMode;
  onChange: (mode: CaseViewMode) => void;
  compact?: boolean;
};

const OPTIONS: Array<{ id: CaseViewMode; label: string; hint: string }> = [
  { id: "panel", label: "Side panel", hint: "List and case detail together (TestRail-style)" },
  { id: "page", label: "Full page", hint: "Open each case on its own page" }
];

export function CaseViewModeToggle({ value, onChange, compact = false }: Props) {
  return (
    <div
      role="group"
      aria-label="Case detail display"
      className={compact ? "inline-flex rounded-md border border-slate-300 bg-white p-0.5" : "flex flex-col gap-2"}
    >
      {!compact ? (
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Case display</p>
      ) : null}
      <div className={compact ? "flex" : "flex flex-wrap gap-2"}>
        {OPTIONS.map((option) => {
          const active = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              title={option.hint}
              aria-pressed={active}
              onClick={() => onChange(option.id)}
              className={[
                compact
                  ? "rounded px-2.5 py-1 text-xs font-medium"
                  : "rounded-md border px-3 py-2 text-left text-sm",
                active
                  ? compact
                    ? "bg-slate-900 text-white"
                    : "border-slate-900 bg-slate-900 text-white"
                  : compact
                    ? "text-slate-700 hover:bg-slate-100"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              ].join(" ")}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
