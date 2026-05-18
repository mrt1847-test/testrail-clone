import { useState, type ReactNode } from "react";

export type RunQPaneTab = "results" | "history" | "defects";

const TABS: Array<{ id: RunQPaneTab; label: string }> = [
  { id: "results", label: "Results" },
  { id: "history", label: "History" },
  { id: "defects", label: "Defects" }
];

type Props = {
  results: ReactNode;
  history: ReactNode;
  defects: ReactNode;
  defaultTab?: RunQPaneTab;
};

export function RunQPanePanel({ results, history, defects, defaultTab = "results" }: Props) {
  const [tab, setTab] = useState<RunQPaneTab>(defaultTab);

  return (
    <div className="mt-2">
      <div className="flex gap-0 border-b border-slate-200" role="tablist" aria-label="Test detail">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`border-b-2 px-3 py-1.5 text-xs font-medium ${
              tab === item.id
                ? "border-slate-800 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="pt-3" role="tabpanel">
        {tab === "results" ? results : null}
        {tab === "history" ? history : null}
        {tab === "defects" ? defects : null}
      </div>
    </div>
  );
}
