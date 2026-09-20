import { forwardRef, useImperativeHandle, useState, type KeyboardEvent } from "react";

import { RecentDefectSuggestions } from "./RecentDefectSuggestions";
import { mergeDefectKeys, splitDefectKeys } from "./resultEntryUtils";

type DefectKeyInputProps = {
  defects: string[];
  onChange: (defects: string[]) => void;
  onDraftChange?: (draft: string) => void;
  projectId?: string;
  id?: string;
};

export type DefectKeyInputHandle = {
  /** Commit any still-typed text and return the keys that should be saved. */
  flush: () => string[];
};

export const DefectKeyInput = forwardRef<DefectKeyInputHandle, DefectKeyInputProps>(function DefectKeyInput(
  { defects, onChange, onDraftChange, projectId, id },
  ref
) {
  const [defectInput, setDefectInput] = useState("");

  function setDraft(value: string) {
    setDefectInput(value);
    onDraftChange?.(value);
  }

  function addDefectsFromInput(value = defectInput) {
    const nextKeys = splitDefectKeys(value);
    if (nextKeys.length === 0) return;
    onChange(mergeDefectKeys(defects, value));
    setDraft("");
  }

  useImperativeHandle(
    ref,
    () => ({
      flush: () => {
        const merged = mergeDefectKeys(defects, defectInput);
        if (splitDefectKeys(defectInput).length > 0) {
          onChange(merged);
          setDraft("");
        }
        return merged;
      }
    }),
    [defectInput, defects, onChange, onDraftChange]
  );

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
    <div className="space-y-2">
      <div className="flex min-h-8 w-full min-w-0 flex-wrap items-center gap-1 rounded border border-slate-300 px-1.5 py-1">
        {defects.map((defect) => (
          <span
            key={defect}
            className="inline-flex max-w-full items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700"
          >
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
          id={id}
          className="min-w-20 flex-1 border-0 p-0 text-xs outline-none"
          placeholder={defects.length > 0 ? "" : "defect key"}
          value={defectInput}
          aria-label={id ? undefined : "Defects"}
          onBlur={() => addDefectsFromInput()}
          onChange={(e) => setDraft(e.target.value)}
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
      {projectId ? (
        <RecentDefectSuggestions
          projectId={projectId}
          excludeKeys={defects}
          onSelect={(key) => onChange(Array.from(new Set([...defects, key])))}
        />
      ) : null}
    </div>
  );
});
