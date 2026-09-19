import type { Ref } from "react";
import type { ProjectStatusOption } from "../utils/projectStatuses";

type Props = {
  options: ProjectStatusOption[];
  selectedId: string;
  onSelect: (option: ProjectStatusOption) => void;
  disableUntested?: boolean;
  disabled?: boolean;
  columns?: 2 | 3;
  variant?: "tiles" | "select";
  controlId?: string;
  firstFieldRef?: Ref<HTMLElement>;
};

function textColorForBackground(hex: string) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return "#0f172a";
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#0f172a" : "#ffffff";
}

export function StatusPicker({
  options,
  selectedId,
  onSelect,
  disableUntested = false,
  disabled = false,
  columns = 2,
  variant = "tiles",
  controlId,
  firstFieldRef
}: Props) {
  if (variant === "select") {
    return (
      <select
        ref={firstFieldRef as Ref<HTMLSelectElement>}
        id={controlId}
        aria-label="Status"
        disabled={disabled}
        value={selectedId}
        className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-400 disabled:bg-slate-50"
        onChange={(event) => {
          const next = options.find((option) => option.id === event.target.value);
          if (next) onSelect(next);
        }}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id} disabled={disableUntested && option.isUntested}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  const gridClass = columns === 3 ? "grid grid-cols-3 gap-1.5" : "grid grid-cols-2 gap-1.5";

  return (
    <div className={gridClass}>
      {options.map((option, index) => {
        const selected = selectedId === option.id;
        const optionDisabled = disabled || (disableUntested && option.isUntested);
        const color = textColorForBackground(option.color);
        const isFirstEnabled = options.findIndex((item) => !(disableUntested && item.isUntested)) === index;
        return (
          <button
            key={option.id}
            ref={isFirstEnabled ? (firstFieldRef as Ref<HTMLButtonElement>) : undefined}
            type="button"
            title={
              disabled
                ? "Status changes are read-only"
                : optionDisabled
                  ? "Untested cannot be set after a result exists"
                  : option.isFinal
                    ? "Final status"
                    : undefined
            }
            aria-pressed={selected}
            data-canonical-status={option.canonicalStatus}
            disabled={optionDisabled}
            className={`rounded border px-2 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
              selected ? "ring-2 ring-slate-900 ring-offset-1" : "border-transparent"
            }`}
            style={{ backgroundColor: option.color, color }}
            onClick={() => onSelect(option)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function pickDefaultStatusOption(options: ProjectStatusOption[], preferredCanonical = "passed") {
  return (
    options.find((option) => option.canonicalStatus === preferredCanonical && !option.isUntested) ??
    options.find((option) => !option.isUntested) ??
    options[0]
  );
}
