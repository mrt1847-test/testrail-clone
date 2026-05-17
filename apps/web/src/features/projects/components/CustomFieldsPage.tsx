import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { fieldTypeUsesOptions } from "../../../shared/customFields/customFieldTypes";
import {
  createCustomField,
  deleteCustomField,
  fetchCustomFields,
  updateCustomField,
  type CustomFieldRow,
  type ProjectRole
} from "../api/advancedApi";

const PROJECT_ROLES: ProjectRole[] = ["owner", "manager", "tester", "viewer"];

type FieldForm = {
  id?: string;
  name: string;
  systemName: string;
  fieldType: CustomFieldRow["fieldType"];
  scope: CustomFieldRow["scope"];
  optionsText: string;
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
  viewRoles: ProjectRole[];
  editRoles: ProjectRole[];
  templateIdsText: string;
};

const emptyForm: FieldForm = {
  name: "",
  systemName: "",
  fieldType: "text",
  scope: "case",
  optionsText: "",
  isRequired: false,
  isActive: true,
  displayOrder: 0,
  viewRoles: [],
  editRoles: [],
  templateIdsText: ""
};

function toSystemName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function formFromField(row: CustomFieldRow): FieldForm {
  return {
    id: row.id,
    name: row.name,
    systemName: row.systemName,
    fieldType: row.fieldType,
    scope: row.scope,
    optionsText: row.options.join("\n"),
    isRequired: row.isRequired,
    isActive: row.isActive,
    displayOrder: row.displayOrder,
    viewRoles: row.visibility?.viewRoles ?? [],
    editRoles: row.visibility?.editRoles ?? [],
    templateIdsText: (row.visibility?.templateIds ?? []).join("\n")
  };
}

function visibilitySummary(row: CustomFieldRow) {
  const parts: string[] = [];
  if (row.visibility?.viewRoles?.length) parts.push(`view: ${row.visibility.viewRoles.join(", ")}`);
  if (row.visibility?.editRoles?.length) parts.push(`edit: ${row.visibility.editRoles.join(", ")}`);
  if (row.visibility?.templateIds?.length) parts.push(`templates: ${row.visibility.templateIds.join(", ")}`);
  return parts.length > 0 ? parts.join(" · ") : "all roles/templates";
}

function payloadFromForm(form: FieldForm): Omit<CustomFieldRow, "id"> {
  const options = fieldTypeUsesOptions(form.fieldType)
    ? form.optionsText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
    : [];
  return {
    name: form.name.trim(),
    systemName: toSystemName(form.systemName || form.name),
    fieldType: form.fieldType,
    scope: form.scope,
    options,
    isRequired: form.isRequired,
    isActive: form.isActive,
    displayOrder: form.displayOrder,
    visibility: {
      ...(form.viewRoles.length > 0 ? { viewRoles: form.viewRoles } : {}),
      ...(form.editRoles.length > 0 ? { editRoles: form.editRoles } : {}),
      ...(form.scope === "case" && form.templateIdsText.trim().length > 0
        ? {
            templateIds: form.templateIdsText
              .split(/\r?\n/)
              .map((item) => item.trim())
              .filter(Boolean)
          }
        : {})
    }
  };
}

function toggleRole(current: ProjectRole[], role: ProjectRole) {
  return current.includes(role) ? current.filter((item) => item !== role) : [...current, role];
}

export function CustomFieldsPage() {
  const { projectId = "" } = useParams();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["custom-fields", projectId], [projectId]);
  const [form, setForm] = useState<FieldForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchCustomFields(projectId),
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
      if (form.id) return updateCustomField(projectId, form.id, payload);
      return createCustomField(projectId, payload);
    },
    onSuccess: async () => {
      setForm(emptyForm);
      setError(null);
      await refresh();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save custom field")
  });

  const deleteMutation = useMutation({
    mutationFn: (fieldId: string) => deleteCustomField(projectId, fieldId),
    onSuccess: refresh,
    onError: (e) => setError(e instanceof Error ? e.message : "Could not delete custom field")
  });

  if (isLoading) return <LoadingState message="Loading custom fields..." />;
  if (isError) return <ErrorState title="Could not load custom fields" onRetry={() => refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Custom Fields</h1>
          <p className="text-sm text-slate-600">Project-specific fields for case authoring and result entry.</p>
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
            New field
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
            placeholder="Risk"
          />
        </label>
        <label className="md:col-span-2">
          <span className="text-xs font-medium uppercase text-slate-500">System name</span>
          <input
            value={form.systemName}
            onChange={(event) => setForm((current) => ({ ...current, systemName: event.target.value }))}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="risk"
          />
        </label>
        <label>
          <span className="text-xs font-medium uppercase text-slate-500">Type</span>
          <select
            value={form.fieldType}
            onChange={(event) =>
              setForm((current) => ({ ...current, fieldType: event.target.value as CustomFieldRow["fieldType"] }))
            }
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="string">String</option>
            <option value="text">Text</option>
            <option value="url">URL</option>
            <option value="integer">Integer</option>
            <option value="number">Number</option>
            <option value="checkbox">Checkbox</option>
            <option value="date">Date</option>
            <option value="dropdown">Dropdown</option>
            <option value="multi_select">Multi-select</option>
            <option value="user">User</option>
            <option value="milestone">Milestone</option>
            <option value="rating">Rating</option>
          </select>
        </label>
        <label>
          <span className="text-xs font-medium uppercase text-slate-500">Scope</span>
          <select
            value={form.scope}
            onChange={(event) =>
              setForm((current) => ({ ...current, scope: event.target.value as CustomFieldRow["scope"] }))
            }
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="case">Case</option>
            <option value="result">Result</option>
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
        {fieldTypeUsesOptions(form.fieldType) ? (
          <label className="md:col-span-6">
            <span className="text-xs font-medium uppercase text-slate-500">
              {form.fieldType === "rating" ? "Max rating (optional, default 5)" : "Options"}
            </span>
            <textarea
              value={form.optionsText}
              onChange={(event) => setForm((current) => ({ ...current, optionsText: event.target.value }))}
              className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder={form.fieldType === "rating" ? "5" : "High\nMedium\nLow"}
            />
          </label>
        ) : null}
        <fieldset className="md:col-span-6 space-y-3 rounded-md border border-slate-200 p-3">
          <legend className="px-1 text-xs font-medium uppercase text-slate-500">Visibility</legend>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-slate-600">Who can view</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {PROJECT_ROLES.map((role) => (
                  <label key={`view-${role}`} className="flex items-center gap-1.5 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.viewRoles.includes(role)}
                      onChange={() =>
                        setForm((current) => ({ ...current, viewRoles: toggleRole(current.viewRoles, role) }))
                      }
                    />
                    {role}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-500">Leave empty to allow all roles.</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-600">Who can edit</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {PROJECT_ROLES.map((role) => (
                  <label key={`edit-${role}`} className="flex items-center gap-1.5 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.editRoles.includes(role)}
                      onChange={() =>
                        setForm((current) => ({ ...current, editRoles: toggleRole(current.editRoles, role) }))
                      }
                    />
                    {role}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-500">Leave empty to match view access.</p>
            </div>
          </div>
          {form.scope === "case" ? (
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Case template IDs (one per line)</span>
              <textarea
                value={form.templateIdsText}
                onChange={(event) => setForm((current) => ({ ...current, templateIdsText: event.target.value }))}
                className="mt-1 min-h-16 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Optional ??restrict to specific templates"
              />
            </label>
          ) : null}
        </fieldset>
        <div className="flex flex-wrap items-center gap-4 md:col-span-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isRequired}
              onChange={(event) => setForm((current) => ({ ...current, isRequired: event.target.checked }))}
            />
            Required
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
            {form.id ? "Save changes" : "Create field"}
          </button>
        </div>
      </form>

      {data.length === 0 ? (
        <EmptyState title="No custom fields" description="Create the first project-specific field above." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">System name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3">Rules</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                  <td className="px-4 py-3 text-slate-600">{row.systemName}</td>
                  <td className="px-4 py-3 text-slate-600">{row.fieldType}</td>
                  <td className="px-4 py-3 text-slate-600">{row.scope}</td>
                  <td className="px-4 py-3 text-slate-600">{visibilitySummary(row)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setForm(formFromField(row));
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
