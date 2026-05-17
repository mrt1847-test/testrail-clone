import { useMemo, useState, type KeyboardEvent } from "react";

import { joinCaseLabels, parseCaseLabels } from "../utils/caseLabels";

type LabelsInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

export function LabelsInput({ value, onChange, disabled = false, className }: LabelsInputProps) {
  const tokens = useMemo(() => parseCaseLabels(value), [value]);
  const [draft, setDraft] = useState("");

  function commitTokens(next: string[]) {
    onChange(joinCaseLabels(next));
  }

  function addToken(raw: string) {
    const parts = parseCaseLabels(raw);
    if (parts.length === 0) return;
    const seen = new Set(tokens.map((token) => token.toLowerCase()));
    const merged = [...tokens];
    for (const part of parts) {
      const key = part.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(part);
    }
    commitTokens(merged);
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "," || event.key === "Tab") {
      if (!draft.trim()) return;
      if (event.key !== "Tab") event.preventDefault();
      addToken(draft);
    }
    if (event.key === "Backspace" && !draft && tokens.length > 0) {
      commitTokens(tokens.slice(0, -1));
    }
  }

  return (
    <div className={className}>
      <div className="flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-slate-300 px-2 py-1.5 focus-within:ring-2 focus-within:ring-slate-400">
        {tokens.map((token) => (
          <span
            key={token}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800"
          >
            <span className="truncate">{token}</span>
            <button
              type="button"
              className="text-sky-600 hover:text-sky-900"
              aria-label={`Remove label ${token}`}
              disabled={disabled}
              onClick={() => commitTokens(tokens.filter((item) => item !== token))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          className="min-w-[6rem] flex-1 border-0 bg-transparent p-0 text-sm outline-none"
          placeholder={tokens.length > 0 ? "Add label" : "smoke, regression"}
          value={draft}
          disabled={disabled}
          onBlur={() => {
            if (draft.trim()) addToken(draft);
          }}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
    </div>
  );
}
