import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchDefectPushFields } from "../api/runApi";
import { RecentDefectSuggestions } from "./RecentDefectSuggestions";
import type { DefectPushContext, DefectPushFieldDefinition } from "../types";

type PushDefectDialogProps = {
  open: boolean;
  projectId: string;
  context: DefectPushContext | null;
  isSubmitting: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: (input: {
    defectKey?: string;
    title?: string;
    description?: string;
    provider?: string;
    customFields?: Record<string, string>;
  }) => void;
};

function FieldInput({
  field,
  value,
  onChange
}: {
  field: DefectPushFieldDefinition;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.type === "textarea") {
    return (
      <textarea
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        rows={5}
        value={value}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (field.type === "select") {
    return (
      <select
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {(field.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
      value={value}
      placeholder={field.placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function PushDefectDialog({
  open,
  projectId,
  context,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit
}: PushDefectDialogProps) {
  const [provider, setProvider] = useState("jira");
  const [values, setValues] = useState<Record<string, string>>({});
  const [customRows, setCustomRows] = useState<Array<{ key: string; value: string }>>([
    { key: "", value: "" }
  ]);
  const [validationError, setValidationError] = useState<string | null>(null);

  const fieldsQuery = useQuery({
    queryKey: ["defect-push-fields", projectId, provider, context?.resultId],
    queryFn: () =>
      fetchDefectPushFields(projectId, {
        provider,
        ...context!
      }),
    enabled: open && Boolean(projectId && context)
  });

  const mappedFields = fieldsQuery.data?.fields ?? [];
  const defectKeyField = useMemo(
    () => mappedFields.find((field) => field.mapsTo === "defectKey") ?? null,
    [mappedFields]
  );
  const standardFieldKeys = useMemo(
    () => new Set(mappedFields.map((field) => field.key)),
    [mappedFields]
  );

  useEffect(() => {
    if (!open || !fieldsQuery.data) return;
    setProvider(fieldsQuery.data.provider);
    setValues(fieldsQuery.data.defaults ?? {});
    setCustomRows([{ key: "", value: "" }]);
    setValidationError(null);
  }, [open, fieldsQuery.data]);

  if (!open || !context) return null;

  const submit = () => {
    const errors: string[] = [];
    for (const field of mappedFields) {
      if (!field.required) continue;
      if (!(values[field.key]?.trim() ?? "")) errors.push(`${field.label} is required.`);
    }
    if (errors.length > 0) {
      setValidationError(errors.join(" "));
      return;
    }

    const customFields: Record<string, string> = {};
    for (const row of customRows) {
      const key = row.key.trim();
      const value = row.value.trim();
      if (!key || !value) continue;
      if (standardFieldKeys.has(key)) continue;
      customFields[key] = value;
    }
    for (const field of mappedFields) {
      if (field.mapsTo || standardFieldKeys.has(field.key)) continue;
      const value = values[field.key]?.trim();
      if (value) customFields[field.key] = value;
    }

    let defectKey: string | undefined;
    let title: string | undefined;
    let description: string | undefined;
    for (const field of mappedFields) {
      const value = values[field.key]?.trim();
      if (!value) continue;
      if (field.mapsTo === "defectKey") defectKey = value;
      if (field.mapsTo === "title") title = value;
      if (field.mapsTo === "description") description = value;
    }

    setValidationError(null);
    onSubmit({
      provider,
      defectKey,
      title,
      description,
      customFields
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Push defect</h2>
          <p className="mt-1 text-sm text-slate-600">
            Create or link a defect for <span className="font-medium">{context.testTitle}</span> (
            {context.resultStatus}).
          </p>
          {!fieldsQuery.data?.integrationEnabled ? (
            <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
              Defect integration is disabled. Enable it under Project settings - Defect integration.
            </p>
          ) : null}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <label className="block space-y-1 text-sm text-slate-700">
            <span>Provider</span>
            <select
              className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="jira">Jira</option>
              <option value="github">GitHub</option>
              <option value="azure_devops">Azure DevOps</option>
              <option value="custom">Custom</option>
            </select>
          </label>

          {defectKeyField ? (
            <RecentDefectSuggestions
              projectId={projectId}
              excludeKeys={values[defectKeyField.key]?.trim() ? [values[defectKeyField.key].trim()] : []}
              onSelect={(key) =>
                setValues((prev) => ({
                  ...prev,
                  [defectKeyField.key]: key
                }))
              }
            />
          ) : null}

          {fieldsQuery.isLoading ? (
            <p className="text-sm text-slate-500">Loading provider fields...</p>
          ) : (
            mappedFields.map((field) => (
              <label key={field.key} className="block space-y-1 text-sm text-slate-700">
                <span>
                  {field.label}
                  {field.required ? <span className="text-rose-600"> *</span> : null}
                </span>
                <FieldInput
                  field={field}
                  value={values[field.key] ?? ""}
                  onChange={(next) => setValues((prev) => ({ ...prev, [field.key]: next }))}
                />
              </label>
            ))
          )}

          <div className="rounded border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Custom fields</p>
            <p className="mt-1 text-xs text-slate-500">Optional provider-specific attributes included in the push payload.</p>
            <div className="mt-2 space-y-2">
              {customRows.map((row, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    className="w-36 rounded border border-slate-300 px-2 py-1 text-xs"
                    placeholder="Field name"
                    value={row.key}
                    onChange={(e) =>
                      setCustomRows((prev) =>
                        prev.map((item, i) => (i === index ? { ...item, key: e.target.value } : item))
                      )
                    }
                  />
                  <input
                    className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                    placeholder="Value"
                    value={row.value}
                    onChange={(e) =>
                      setCustomRows((prev) =>
                        prev.map((item, i) => (i === index ? { ...item, value: e.target.value } : item))
                      )
                    }
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mt-2 text-xs font-medium text-indigo-800 hover:underline"
              onClick={() => setCustomRows((prev) => [...prev, { key: "", value: "" }])}
            >
              + Add custom field
            </button>
          </div>

          {validationError ? <p className="text-sm text-rose-700">{validationError}</p> : null}
          {errorMessage ? <p className="text-sm text-rose-700">{errorMessage}</p> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting || !fieldsQuery.data?.integrationEnabled}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={submit}
          >
            {isSubmitting ? "Pushing..." : "Push defect"}
          </button>
        </div>
      </div>
    </div>
  );
}
