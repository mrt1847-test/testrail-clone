import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";

import { searchIntegrationIssues } from "../../projects/api/integrationsApi";
import { fetchDefectIntegrationSettings } from "../../projects/api/settingsApi";
import { parseCaseRefs } from "../utils/caseRefs";

type ReferencesInputProps = {
  projectId: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

function joinRefs(tokens: string[]) {
  return tokens.join(", ");
}

export function ReferencesInput({ projectId, value, onChange, disabled = false, className }: ReferencesInputProps) {
  const tokens = useMemo(() => parseCaseRefs(value), [value]);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ["defect-integration-settings", projectId],
    queryFn: () => fetchDefectIntegrationSettings(projectId),
    enabled: Boolean(projectId)
  });

  const integrationActive = Boolean(settingsQuery.data?.isEnabled);
  const searchQuery = useQuery({
    queryKey: ["issue-search", projectId, draft],
    queryFn: () => searchIntegrationIssues(projectId, draft, 8),
    enabled: integrationActive && open && draft.trim().length >= 1,
    staleTime: 10_000
  });

  const suggestions = (searchQuery.data?.items ?? []).filter((item) => !tokens.includes(item.key));

  useEffect(() => {
    if (!open) setDraft("");
  }, [open]);

  function commitTokens(next: string[]) {
    onChange(joinRefs(next));
  }

  function addToken(raw: string) {
    const parts = parseCaseRefs(raw);
    if (parts.length === 0) return;
    commitTokens([...tokens, ...parts.filter((part) => !tokens.includes(part))]);
    setDraft("");
    setOpen(false);
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
    if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className={className}>
      <div className="relative">
        <div className="flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-slate-300 px-2 py-1.5 focus-within:ring-2 focus-within:ring-slate-400">
          {tokens.map((token) => (
            <span
              key={token}
              className="inline-flex max-w-full items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700"
            >
              <span className="truncate">{token}</span>
              <button
                type="button"
                className="text-slate-500 hover:text-slate-900"
                aria-label={`Remove ${token}`}
                disabled={disabled}
                onClick={() => commitTokens(tokens.filter((item) => item !== token))}
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            className="min-w-[8rem] flex-1 border-0 bg-transparent p-0 text-sm outline-none"
            placeholder={tokens.length > 0 ? "" : "REQ-1, REQ-2"}
            value={draft}
            disabled={disabled}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setOpen(false), 150);
              if (draft.trim()) addToken(draft);
            }}
            onChange={(event) => {
              setDraft(event.target.value);
              setOpen(true);
            }}
            onKeyDown={handleKeyDown}
          />
        </div>
        {integrationActive && open && suggestions.length > 0 ? (
          <ul
            className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
            role="listbox"
          >
            {suggestions.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => addToken(item.key)}
                >
                  <span>{item.label}</span>
                  {item.url ? (
                    <span className="text-xs text-slate-500">View URL</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <span className="text-xs text-slate-500">
        {integrationActive
          ? "Comma-separated IDs. Type to search issues when integration is enabled."
          : "Comma-separated requirement or story IDs."}
      </span>
    </div>
  );
}
