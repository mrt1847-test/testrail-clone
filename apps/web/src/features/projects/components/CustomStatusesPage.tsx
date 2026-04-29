import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import {
  createCustomStatus,
  deleteCustomStatus,
  fetchCustomStatuses,
  updateCustomStatus,
  type CustomStatusRow
} from "../api/advancedApi";

type StatusForm = {
  id?: string;
  name: string;
  systemName: string;
  canonicalStatus: CustomStatusRow["canonicalStatus"];
  color: string;
  isActive: boolean;
  displayOrder: number;
};

const emptyForm: StatusForm = {
  name: "",
  systemName: "",
  canonicalStatus: "untested",
  color: "#64748b",
  isActive: true,
  displayOrder: 0
};

const canonicalStatuses: Array<CustomStatusRow["canonicalStatus"]> = [
  "untested",
  "passed",
  "failed",
  "blocked",
  "retest"
];

function toSystemName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function formFromStatus(row: CustomStatusRow): StatusForm {
  return {
    id: row.id,
    name: row.name,
    systemName: row.systemName,
    canonicalStatus: row.canonicalStatus,
    color: row.color,
    isActive: row.isActive,
    displayOrder: row.displayOrder
  };
}

function payloadFromForm(form: StatusForm): Omit<CustomStatusRow, "id" | "isSystem"> {
  return {
    name: form.name.trim(),
    systemName: toSystemName(form.systemName || form.name),
    canonicalStatus: form.canonicalStatus,
    color: form.color,
    isActive: form.isActive,
    displayOrder: form.displayOrder
  };
}

export function CustomStatusesPage() {
  const { projectId = "" } = useParams();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["custom-statuses", projectId], [projectId]);
  const [form, setForm] = useState<StatusForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchCustomStatuses(projectId),
    enabled: Boolean(projectId)
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = payloadFromForm(form);
      if (!payload.name) throw new Error("Name is required");
      if (!payload.systemName) throw new Error("System name must contain a letter or number");
      if (form.id) return updateCustomStatus(projectId, form.id, payload);
      return createCustomStatus(projectId, payload);
    },
    onSuccess: async () => {
      setForm(emptyForm);
      setError(null);
      await refresh();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save custom status")
  });

  const deleteMutation = useMutation({
    mutationFn: (statusId: string) => deleteCustomStatus(projectId, statusId),
    onSuccess: refresh,
    onError: (e) => setError(e instanceof Error ? e.message : "Could not delete custom status")
  });

  if (isLoading) return <LoadingState message="Loading custom statuses..." />;
  if (isError) return <ErrorState title="Could not load custom statuses" onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Custom Statuses</h1>
          <p className="text-sm text-slate-600">Project status labels mapped to the canonical execution states.</p>
        </div>
        {form.id ? (
          <button
            type="button"
            onClick={() => {
              setForm(emptyForm);
              setError(null);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            New status
          </button>
        ) : null}
      </div>

      <form
        className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-6"
        onSubmit={(event) => {
          event.preventDefault();
          saveMutation.mutate();
        }}
      >
        <label className="md:col-span-2">
          <span className="text-xs font-medium uppercase text-slate-500">Name</span>
          <input
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                name: event.target.value,
                systemName: current.id || current.systemName ? current.systemName : toSystemName(event.target.value)
              }))
            }
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Needs investigation"
          />
        </label>
        <label className="md:col-span-2">
          <span className="text-xs font-medium uppercase text-slate-500">System name</span>
          <input
            value={form.systemName}
            onChange={(event) => setForm((current) => ({ ...current, systemName: event.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="needs_investigation"
          />
        </label>
        <label>
          <span className="text-xs font-medium uppercase text-slate-500">Maps to</span>
          <select
            value={form.canonicalStatus}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                canonicalStatus: event.target.value as CustomStatusRow["canonicalStatus"]
              }))
            }
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {canonicalStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-xs font-medium uppercase text-slate-500">Order</span>
          <input
            type="number"
            value={form.displayOrder}
            onChange={(event) => setForm((current) => ({ ...current, displayOrder: Number(event.target.value) }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <div className="flex flex-wrap items-center gap-4 md:col-span-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="color"
              value={form.color}
              onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
              className="h-8 w-10 rounded border border-slate-300"
            />
            Color
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
            Active
          </label>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </div>
        <div className="flex justify-end md:col-span-2">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {form.id ? "Save changes" : "Create status"}
          </button>
        </div>
      </form>

      {data.length === 0 ? (
        <EmptyState title="No custom statuses" description="Create a project status mapped to a canonical result state." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">System name</th>
                <th className="px-4 py-3">Maps to</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ backgroundColor: row.color }} />
                    {row.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.systemName}</td>
                  <td className="px-4 py-3 text-slate-600">{row.canonicalStatus}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {[row.isSystem ? "system" : "custom", row.isActive ? "active" : "inactive"].join(", ")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setForm(formFromStatus(row));
                        setError(null);
                      }}
                      className="mr-3 text-sm font-medium text-slate-700 underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(row.id)}
                      disabled={deleteMutation.isPending || row.isSystem}
                      className="text-sm font-medium text-red-700 underline disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
