import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { API_TOKEN_DEFAULT_SCOPES } from "../constants/apiTokenScopes";
import { createToken, fetchTokenScopes, fetchTokens, revokeToken } from "../api/advancedApi";
import type { TokenRow, TokenScopeOption } from "../api/advancedApi";

const EXPIRY_OPTIONS = [
  { label: "30 days", days: 30, hint: "Best for temporary setup, smoke tests, or vendor access." },
  { label: "90 days", days: 90, hint: "Recommended for CI tokens that can be rotated each quarter." },
  { label: "1 year", days: 365, hint: "Use for stable internal automation with an owner." },
  { label: "Never", days: null, hint: "Use only for tightly controlled service accounts." }
] as const;

const SCOPE_PRESETS = [
  {
    id: "ci-results",
    label: "CI result upload",
    description: "Submit automation results and read upload history.",
    scopes: ["automation:read", "automation:write"],
    expiresInDays: 90
  },
  {
    id: "read-only-api",
    label: "Read-only API",
    description: "Read project data through compatible API endpoints.",
    scopes: ["data:read"],
    expiresInDays: 365
  },
  {
    id: "full-integration",
    label: "Full integration",
    description: "Read and write automation plus TestRail-compatible data.",
    scopes: ["automation:read", "automation:write", "data:read", "data:write"],
    expiresInDays: 30
  }
] as const;

type IssuedToken = {
  rawToken: string;
  token: TokenRow;
};

function formatExpiry(expiresAt: string | null) {
  if (!expiresAt) return "Never";
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return expiresAt;
  const expired = date.getTime() <= Date.now();
  return `${expired ? "Expired" : "Expires"} ${date.toLocaleString()}`;
}

function formatExpiryChoice(days: number | null) {
  if (days === null) return "No expiration";
  if (days === 1) return "Expires in 1 day";
  return `Expires in ${days} days`;
}

function summarizeScopes(scopes: string[], options: TokenScopeOption[]) {
  if (scopes.length === 0) return "No scopes selected";
  return scopes.map((scope) => options.find((option) => option.scope === scope)?.label ?? scope).join(", ");
}

export function TokensPage() {
  const { projectId = "" } = useParams();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([...API_TOKEN_DEFAULT_SCOPES]);
  const [expiresInDays, setExpiresInDays] = useState<number | null>(90);
  const [issuedToken, setIssuedToken] = useState<IssuedToken | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const scopesQuery = useQuery({
    queryKey: ["token-scopes", projectId],
    queryFn: () => fetchTokenScopes(projectId),
    enabled: Boolean(projectId)
  });

  const tokensQuery = useQuery({
    queryKey: ["tokens", projectId],
    queryFn: () => fetchTokens(projectId),
    enabled: Boolean(projectId)
  });

  const scopeOptions = useMemo(() => scopesQuery.data ?? [], [scopesQuery.data]);
  const availableScopeSet = useMemo(() => new Set(scopeOptions.map((option) => option.scope)), [scopeOptions]);

  const validationMessages = [
    ...(name.length > 120 ? ["Token name must be 120 characters or fewer."] : []),
    ...(selectedScopes.length === 0 ? ["Choose at least one scope."] : [])
  ];
  const canCreate = validationMessages.length === 0;
  const selectedExpiry = EXPIRY_OPTIONS.find((option) => option.days === expiresInDays) ?? EXPIRY_OPTIONS[1];
  const selectedScopeSummary = summarizeScopes(selectedScopes, scopeOptions);

  const createMutation = useMutation({
    mutationFn: () =>
      createToken(projectId, {
        name: name.trim() || "CI token",
        scopes: selectedScopes,
        expiresInDays
      }),
    onSuccess: async (result) => {
      setIssuedToken({ rawToken: result.rawToken, token: result.token });
      setCopied(false);
      setCopyError(false);
      setShowValidation(false);
      setName("");
      await qc.invalidateQueries({ queryKey: ["tokens", projectId] });
    }
  });

  const revokeMutation = useMutation({
    mutationFn: (tokenId: string) => revokeToken(projectId, tokenId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["tokens", projectId] });
    }
  });

  const toggleScope = (scope: string) => {
    setSelectedScopes((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]
    );
  };

  const applyPreset = (preset: (typeof SCOPE_PRESETS)[number]) => {
    setSelectedScopes(preset.scopes.filter((scope) => availableScopeSet.has(scope)));
    setExpiresInDays(preset.expiresInDays);
    setShowValidation(false);
  };

  const copyIssuedToken = async () => {
    if (!issuedToken || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(issuedToken.rawToken);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  };

  if (tokensQuery.isLoading || scopesQuery.isLoading) {
    return <LoadingState message="Loading API tokens..." />;
  }
  if (tokensQuery.isError || scopesQuery.isError || !tokensQuery.data) {
    return <ErrorState title="Could not load API tokens" onRetry={() => void tokensQuery.refetch()} />;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">API Tokens</h2>
      <p className="mt-1 text-xs text-slate-500">
        Tokens authenticate automation endpoints. Assign scopes and an expiration; expired or revoked tokens are rejected.
      </p>

      <div className="mt-4 space-y-3 rounded border border-slate-200 bg-slate-50 p-3">
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Scope presets</legend>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            {SCOPE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="rounded border border-slate-200 bg-white p-3 text-left text-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                onClick={() => applyPreset(preset)}
              >
                <span className="block font-medium text-slate-900">{preset.label}</span>
                <span className="mt-1 block text-xs text-slate-500">{preset.description}</span>
                <span className="mt-2 block text-xs font-medium text-slate-600">
                  {formatExpiryChoice(preset.expiresInDays)}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm font-medium text-slate-700">
          Name
          <input
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            placeholder="CI pipeline"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={140}
          />
          <span className="mt-1 block text-xs text-slate-500">
            Optional. Blank tokens are created as "CI token". {Math.max(0, 120 - name.length)} characters left.
          </span>
        </label>

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Scopes</legend>
          <ul className="mt-2 space-y-1.5">
            {scopeOptions.map((option) => (
              <li key={option.scope}>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(option.scope)}
                    onChange={() => toggleScope(option.scope)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-mono text-xs text-slate-600">{option.scope}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{option.label}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">Selected: {selectedScopeSummary}</p>
        </fieldset>

        <label className="block text-sm font-medium text-slate-700">
          Expiration
          <select
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={expiresInDays ?? "never"}
            onChange={(e) => {
              const value = e.target.value;
              setExpiresInDays(value === "never" ? null : Number(value));
            }}
          >
            {EXPIRY_OPTIONS.map((option) => (
              <option key={option.label} value={option.days ?? "never"}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-slate-500">{selectedExpiry.hint}</span>
        </label>

        {showValidation && validationMessages.length > 0 ? (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {validationMessages.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        ) : null}
        {createMutation.isError ? (
          <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            Could not create token. Check the token settings and try again.
          </p>
        ) : null}

        <button
          type="button"
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          disabled={createMutation.isPending}
          onClick={() => {
            setShowValidation(true);
            if (canCreate) void createMutation.mutateAsync();
          }}
        >
          {createMutation.isPending ? "Creating..." : "Create token"}
        </button>
      </div>

      {issuedToken ? (
        <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold">Copy this token now. It will not be shown again.</p>
              <p className="mt-1 text-emerald-800">
                {issuedToken.token.name} - {formatExpiry(issuedToken.token.expiresAt)}
              </p>
            </div>
            <button
              type="button"
              className="rounded border border-emerald-300 bg-white px-2 py-1 font-medium text-emerald-800"
              onClick={() => void copyIssuedToken()}
            >
              {copied ? "Copied" : "Copy token"}
            </button>
          </div>
          <code className="mt-2 block break-all rounded border border-emerald-200 bg-white px-2 py-1 font-mono text-[11px]">
            {issuedToken.rawToken}
          </code>
          <p className="mt-2 text-emerald-800">Scopes: {summarizeScopes(issuedToken.token.scopes, scopeOptions)}</p>
          {copyError ? <p className="mt-1 text-emerald-900">Copy failed. Select the token text manually.</p> : null}
        </div>
      ) : null}

      {tokensQuery.data.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No active tokens.</p>
      ) : (
        <ul className="mt-4 space-y-2 text-sm text-slate-800">
          {tokensQuery.data.map((token) => (
            <li key={token.id} className="rounded border border-slate-200 px-3 py-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{token.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Scopes: {token.scopes.length > 0 ? token.scopes.join(", ") : "none"}
                  </p>
                  <p className="text-xs text-slate-500">{formatExpiry(token.expiresAt)}</p>
                  <p className="text-xs text-slate-500">
                    Last used: {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : "never"}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700"
                  disabled={revokeMutation.isPending}
                  onClick={() => void revokeMutation.mutateAsync(token.id)}
                >
                  Revoke
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
