import type { ProjectStatusOption } from "../utils/projectStatuses";

type Props = {
  options: ProjectStatusOption[];
  selectedId: string;
  onSelect: (option: ProjectStatusOption) => void;
  disableUntested?: boolean;
  columns?: 2 | 3;
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

export function StatusPicker({ options, selectedId, onSelect, disableUntested = false, columns = 2 }: Props) {
  const gridClass = columns === 3 ? "grid grid-cols-3 gap-1.5" : "grid grid-cols-2 gap-1.5";

  return (
    <div className={gridClass}>
      {options.map((option) => {
        const selected = selectedId === option.id;
        const disabled = disableUntested && option.isUntested;
        const color = textColorForBackground(option.color);
        return (
          <button
            key={option.id}
            type="button"
            title={
              disabled
                ? "Untested cannot be set after a result exists"
                : option.isFinal
                  ? "Final status"
                  : undefined
            }
            disabled={disabled}
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
