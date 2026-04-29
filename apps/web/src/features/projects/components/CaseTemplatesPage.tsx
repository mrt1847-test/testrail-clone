import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import {
  createCaseTemplate,
  deleteCaseTemplate,
  fetchCaseTemplates,
  updateCaseTemplate,
  type CaseTemplateRow
} from "../api/advancedApi";

type TemplateForm = {
  id?: string;
  name: string;
  description: string;
  fieldsText: string;
  isDefault: boolean;
  isActive: boolean;
  displayOrder: number;
};

const defaultFields = ["title", "preconditions", "steps", "expectedResult"];

const emptyForm: TemplateForm = {
  name: "",
  description: "",
  fieldsText: defaultFields.join("\n"),
  isDefault: false,
  isActive: true,
  displayOrder: 0
};

function formFromTemplate(row: CaseTemplateRow): TemplateForm {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    fieldsText: row.fields.join("\n"),
    isDefault: row.isDefault,
    isActive: row.isActive,
    displayOrder: row.displayOrder
  };
}

function payloadFromForm(form: TemplateForm): Omit<CaseTemplateRow, "id"> {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    fields: form.fieldsText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
    isDefault: form.isDefault,
    isActive: form.isActive,
    displayOrder: form.displayOrder
  };
}

export function CaseTemplatesPage() {
  const { projectId = "" } = useParams();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["case-templates", projectId], [projectId]);
  const [form, setForm] = useState<TemplateForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchCaseTemplates(projectId),
    enabled: Boolean(projectId)
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = payloadFromForm(form);
      if (!payload.name) throw new Error("Name is required");
      if (payload.fields.length === 0) throw new Error("At least one field is required");
      if (form.id) return updateCaseTemplate(projectId, form.id, payload);
      return createCaseTemplate(projectId, payload);
    },
    onSuccess: async () => {
      setForm(emptyForm);
      setError(null);
      await refresh();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save case template")
  });

  const deleteMutation = useMutation({
    mutationFn: (templateId: string) => deleteCaseTemplate(projectId, templateId),
    onSuccess: refresh,
    onError: (e) => setError(e instanceof Error ? e.message : "Could not delete case template")
  });

  if (isLoading) return <LoadingState message="Loading case templates..." />;
  if (isError) return <ErrorState title="Could not load case templates" onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Case Templates</h1>
          <p className="text-sm text-slate-600">Reusable field sets for project-specific test case authoring.</p>
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
            New template
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
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Exploratory case"
          />
        </label>
        <label className="md:col-span-3">
          <span className="text-xs font-medium uppercase text-slate-500">Description</span>
          <input
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Lightweight exploratory testing format"
          />
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
        <label className="md:col-span-6">
          <span className="text-xs font-medium uppercase text-slate-500">Fields</span>
          <textarea
            value={form.fieldsText}
            onChange={(event) => setForm((current) => ({ ...current, fieldsText: event.target.value }))}
            className="mt-1 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder={"title\npreconditions\nsteps\nexpectedResult"}
          />
        </label>
        <div className="flex flex-wrap items-center gap-4 md:col-span-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(event) => setForm((current) => ({ ...current, isDefault: event.target.checked }))}
            />
            Default
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
            {form.id ? "Save changes" : "Create template"}
          </button>
        </div>
      </form>

      {data.length === 0 ? (
        <EmptyState title="No case templates" description="Create a reusable case authoring template above." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Template</th>
                <th className="px-4 py-3">Fields</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{row.name}</p>
                    {row.description ? <p className="text-xs text-slate-500">{row.description}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.fields.join(", ")}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {[row.isDefault ? "default" : "optional", row.isActive ? "active" : "inactive"].join(", ")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setForm(formFromTemplate(row));
                        setError(null);
                      }}
                      className="mr-3 text-sm font-medium text-slate-700 underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(row.id)}
                      disabled={deleteMutation.isPending}
                      className="text-sm font-medium text-red-700 underline disabled:opacity-50"
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
