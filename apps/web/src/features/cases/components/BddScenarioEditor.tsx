import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { createCaseScenario, fetchCaseScenarios } from "../api/bddApi";

type Props = {
  caseId: string;
  disabled?: boolean;
};

export function BddScenarioEditor({ caseId, disabled = false }: Props) {
  const qc = useQueryClient();
  const [draftName, setDraftName] = useState("");
  const [draftContent, setDraftContent] = useState("Given …\nWhen …\nThen …");
  const [error, setError] = useState<string | null>(null);

  const scenariosQuery = useQuery({
    queryKey: ["case-scenarios", caseId],
    queryFn: () => fetchCaseScenarios(caseId),
    enabled: Boolean(caseId)
  });

  const addMutation = useMutation({
    mutationFn: () => createCaseScenario(caseId, { name: draftName.trim(), content: draftContent.trim() }),
    onSuccess: async () => {
      setError(null);
      setDraftName("");
      await qc.invalidateQueries({ queryKey: ["case-scenarios", caseId] });
    },
    onError: (err: Error) => setError(err.message)
  });

  const scenarios = scenariosQuery.data ?? [];

  return (
    <div className="space-y-3 rounded border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600">BDD scenarios</h4>
        <span className="text-xs text-slate-500">{scenarios.length} scenario(s)</span>
      </div>
      {scenariosQuery.isLoading ? <p className="text-xs text-slate-500">Loading scenarios…</p> : null}
      <ul className="space-y-2">
        {scenarios.map((row) => (
          <li key={row.id} className="rounded border border-slate-200 bg-white p-2 text-xs">
            <p className="font-medium text-slate-900">{row.name}</p>
            <pre className="mt-1 whitespace-pre-wrap font-mono text-slate-700">{row.content}</pre>
          </li>
        ))}
      </ul>
      <div className="grid gap-2">
        <input
          className="rounded border border-slate-300 px-2 py-1 text-sm"
          placeholder="Scenario name"
          value={draftName}
          disabled={disabled || addMutation.isPending}
          onChange={(e) => setDraftName(e.target.value)}
        />
        <textarea
          className="min-h-[80px] rounded border border-slate-300 px-2 py-1 font-mono text-xs"
          value={draftContent}
          disabled={disabled || addMutation.isPending}
          onChange={(e) => setDraftContent(e.target.value)}
        />
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs disabled:opacity-50"
          disabled={disabled || addMutation.isPending || !draftName.trim() || !draftContent.trim()}
          onClick={() => void addMutation.mutateAsync()}
        >
          Add scenario
        </button>
      </div>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
