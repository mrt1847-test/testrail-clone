import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { API_TOKEN_DEFAULT_SCOPES } from "../constants/apiTokenScopes";
import { createToken, fetchTokenScopes, fetchTokens, revokeToken } from "../api/advancedApi";

const EXPIRY_OPTIONS = [
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "1 year", days: 365 },
  { label: "Never", days: null }
] as const;

function formatExpiry(expiresAt: string | null) {
  if (!expiresAt) return "Never";
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return expiresAt;
  const expired = date.getTime() <= Date.now();
  return `${expired ? "Expired" : "Expires"} ${date.toLocaleString()}`;
}

export function TokensPage() {
  const { projectId = "" } = useParams();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([...API_TOKEN_DEFAULT_SCOPES]);
  const [expiresInDays, setExpiresInDays] = useState<number | null>(90);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

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

  const createMutation = useMutation({
    mutationFn: () =>
      createToken(projectId, {
        name: name.trim() || "CI token",
        scopes: selectedScopes,
        expiresInDays
      }),
    onSuccess: async (result) => {
      setIssuedToken(result.rawToken);
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

  if (tokensQuery.isLoading || scopesQuery.isLoading) {
    return <LoadingState message="Loading API tokens…" />;
  }
  if (tokensQuery.isError || scopesQuery.isError || !tokensQuery.data) {
    return <ErrorState title="Could not load API tokens" onRetry={() => void tokensQuery.refetch()} />;
  }

  const canCreate = selectedScopes.length > 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">API Tokens</h2>
      <p className="mt-1 text-xs text-slate-500">
        Tokens authenticate automation endpoints. Assign scopes and an expiration; expired or revoked tokens are rejected.
      </p>

      <div className="mt-4 space-y-3 rounded border border-slate-200 bg-slate-50 p-3">
        <label className="block text-sm font-medium text-slate-700">
          Name
          <input
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            placeholder="CI pipeline"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
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
        </label>

        <button
          type="button"
          className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          disabled={createMutation.isPending || !canCreate}
          onClick={() => void createMutation.mutateAsync()}
        >
          Create token
        </button>
      </div>

      {issuedToken ? (
        <p className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          Copy this token now — it will not be shown again:
          <code className="mt-1 block break-all font-mono text-[11px]">{issuedToken}</code>
        </p>
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
                    Scopes: {token.scopes.length > 0 ? token.scopes.join(", ") : "—"}
                  </p>
                  <p className="text-xs text-slate-500">{formatExpiry(token.expiresAt)}</p>
                  <p className="text-xs text-slate-500">Last used: {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : "never"}</p>
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
