import { type KeyboardEvent, useState } from "react";

import { splitDefectKeys } from "./resultEntryUtils";

type DefectKeyInputProps = {
  defects: string[];
  onChange: (defects: string[]) => void;
};

export function DefectKeyInput({ defects, onChange }: DefectKeyInputProps) {
  const [defectInput, setDefectInput] = useState("");

  function addDefectsFromInput(value = defectInput) {
    const nextKeys = splitDefectKeys(value);
    if (nextKeys.length === 0) return;
    onChange(Array.from(new Set([...defects, ...nextKeys])));
    setDefectInput("");
  }

  function handleDefectKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "," || event.key === "Tab") {
      if (!defectInput.trim()) return;
      event.preventDefault();
      addDefectsFromInput();
    }
    if (event.key === "Backspace" && !defectInput && defects.length > 0) {
      onChange(defects.slice(0, -1));
    }
  }

  return (
    <div className="flex min-h-8 w-full min-w-0 flex-wrap items-center gap-1 rounded border border-slate-300 px-1.5 py-1">
      {defects.map((defect) => (
        <span key={defect} className="inline-flex max-w-full items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700">
          <span className="truncate">{defect}</span>
          <button
            type="button"
            className="text-slate-500 hover:text-slate-900"
            aria-label={`Remove ${defect}`}
            onClick={() => onChange(defects.filter((item) => item !== defect))}
          >
            x
          </button>
        </span>
      ))}
      <input
        className="min-w-20 flex-1 border-0 p-0 text-xs outline-none"
        placeholder={defects.length > 0 ? "" : "defect key"}
        value={defectInput}
        onBlur={() => addDefectsFromInput()}
        onChange={(e) => setDefectInput(e.target.value)}
        onKeyDown={handleDefectKeyDown}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData("text");
          if (splitDefectKeys(pasted).length > 1) {
            e.preventDefault();
            addDefectsFromInput(pasted);
          }
        }}
      />
    </div>
  );
}
