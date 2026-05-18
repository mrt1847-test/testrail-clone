import { CASE_DISPLAY_MODES, type CaseDisplayMode } from "../caseRepositoryView";

type Props = {
  value: CaseDisplayMode;
  onChange: (mode: CaseDisplayMode) => void;
};

export function CaseRepositoryDisplayMenu({ value, onChange }: Props) {
  return (
    <label className="block text-xs text-slate-600">
      <span className="font-medium text-slate-700">Display</span>
      <select
        aria-label="Case repository display mode"
        value={value}
        onChange={(event) => onChange(event.target.value as CaseDisplayMode)}
        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-slate-400"
      >
        {CASE_DISPLAY_MODES.map((mode) => (
          <option key={mode.id} value={mode.id} title={mode.hint}>
            {mode.label}
          </option>
        ))}
      </select>
    </label>
  );
}
