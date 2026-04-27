import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { useCreateRunMutation } from "../hooks/useRunsApi";

export function RunCreatePage() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const mutation = useCreateRunMutation(projectId);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate(name.trim(), {
      onSuccess: (run) => navigate(`/projects/${projectId}/runs/${run.id}`),
    });
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">New test run</h2>
      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
            placeholder="e.g. Smoke — nightly"
          />
        </label>
        <p className="text-xs text-slate-500">
          MVP: name only. Suite, milestone, case selection, and environment editor come next.
        </p>
        {mutation.isError ? <ErrorState title="Could not create run" /> : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate(`/projects/${projectId}/runs`)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || mutation.isPending}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {mutation.isPending ? "Creating…" : "Create run"}
          </button>
        </div>
      </form>
    </div>
  );
}
