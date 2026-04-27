import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { createToken, fetchTokens, revokeToken } from "../api/advancedApi";

export function TokensPage() {
  const { projectId = "" } = useParams();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["tokens", projectId],
    queryFn: () => fetchTokens(projectId),
    enabled: Boolean(projectId)
  });
  const createMutation = useMutation({
    mutationFn: () => createToken(projectId, name.trim() || "CI token"),
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

  if (isLoading) return <LoadingState message="Loading API tokens…" />;
  if (isError || !data) return <ErrorState title="Could not load API tokens" onRetry={() => refetch()} />;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">API Tokens</h2>
      <div className="mt-2 flex gap-2">
        <input
          className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
          placeholder="Token name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="rounded bg-slate-900 px-3 py-1 text-sm text-white disabled:opacity-50"
          disabled={createMutation.isPending}
          onClick={() => void createMutation.mutateAsync()}
        >
          Create
        </button>
      </div>
      {issuedToken ? (
        <p className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
          New token (copy now): <code>{issuedToken}</code>
        </p>
      ) : null}
      {data.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No tokens yet.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm text-slate-800">
          {data.map((token) => (
            <li key={token.id} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2">
              <span>
                {token.name} <span className="text-xs text-slate-500">last used: {token.lastUsedAt ?? "never"}</span>
              </span>
              <button
                className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700"
                disabled={revokeMutation.isPending}
                onClick={() => void revokeMutation.mutateAsync(token.id)}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
