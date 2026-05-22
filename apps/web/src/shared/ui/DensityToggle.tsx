import type { UiDensity } from "./density/uiDensity";

type DensityToggleProps = {
  value: UiDensity;
  onChange: (value: UiDensity) => void;
  className?: string;
};

const optionClass = (active: boolean) =>
  active
    ? "bg-slate-800 text-white"
    : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800";

export function DensityToggle({ value, onChange, className = "" }: DensityToggleProps) {
  return (
    <div
      className={`inline-flex overflow-hidden rounded border border-slate-400 text-xs dark:border-slate-600 ${className}`.trim()}
      role="group"
      aria-label="Table density"
    >
      <button
        type="button"
        className={`px-2 py-1 font-medium ${optionClass(value === "compact")}`}
        aria-pressed={value === "compact"}
        onClick={() => onChange("compact")}
      >
        Compact
      </button>
      <button
        type="button"
        className={`border-l border-slate-400 px-2 py-1 font-medium dark:border-slate-600 ${optionClass(value === "comfortable")}`}
        aria-pressed={value === "comfortable"}
        onClick={() => onChange("comfortable")}
      >
        Comfortable
      </button>
    </div>
  );
}
