import type { CustomFieldRow } from "../../projects/api/settingsApi";
import type { CustomValue } from "./resultEntryTypes";

type ResultCustomFieldsProps = {
  fields: CustomFieldRow[];
  values: Record<string, string>;
  errors: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  onClearError: (systemName: string) => void;
};

export function valueForSubmit(field: CustomFieldRow, value: string): CustomValue {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (field.fieldType === "number") return Number(trimmed);
  if (field.fieldType === "boolean") return trimmed === "true";
  return trimmed;
}

export function validateCustomFieldValues(fields: CustomFieldRow[], values: Record<string, string>) {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const value = values[field.systemName]?.trim() ?? "";
    if (field.isRequired && !value) {
      errors[field.systemName] = `${field.name} is required.`;
    } else if (field.fieldType === "number" && value && !Number.isFinite(Number(value))) {
      errors[field.systemName] = `${field.name} must be a number.`;
    }
  }
  return errors;
}

export function ResultCustomFields({ fields, values, errors, onChange, onClearError }: ResultCustomFieldsProps) {
  if (fields.length === 0) return null;

  return (
    <div className="grid gap-2">
      {fields.map((field) => (
        <label key={field.id} className="text-xs text-slate-600">
          <span className="font-medium">
            {field.name}
            {field.isRequired ? " *" : ""}
          </span>
          {field.fieldType === "select" ? (
            <select
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
              value={values[field.systemName] ?? ""}
              onChange={(e) => {
                onChange({ ...values, [field.systemName]: e.target.value });
                onClearError(field.systemName);
              }}
            >
              <option value="">Select...</option>
              {field.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : field.fieldType === "boolean" ? (
            <select
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
              value={values[field.systemName] ?? ""}
              onChange={(e) => {
                onChange({ ...values, [field.systemName]: e.target.value });
                onClearError(field.systemName);
              }}
            >
              <option value="">Select...</option>
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          ) : (
            <input
              type={field.fieldType === "number" ? "number" : "text"}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
              value={values[field.systemName] ?? ""}
              onChange={(e) => {
                onChange({ ...values, [field.systemName]: e.target.value });
                onClearError(field.systemName);
              }}
            />
          )}
          {errors[field.systemName] ? <span className="mt-1 block text-red-600">{errors[field.systemName]}</span> : null}
        </label>
      ))}
    </div>
  );
}
