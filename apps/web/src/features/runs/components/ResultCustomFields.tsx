import type { CustomFieldRow } from "../../projects/api/settingsApi";
import { CustomFieldValueInput } from "../../../shared/customFields/CustomFieldValueInput";
import {
  parseDraftToScalar,
  stringDraftFromValue,
  validateCustomFieldDraft,
  type CustomFieldScalar
} from "../../../shared/customFields/customFieldTypes";
import type { CustomValue } from "./resultEntryTypes";

type ResultCustomFieldsProps = {
  fields: CustomFieldRow[];
  values: Record<string, string>;
  errors: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  onClearError: (systemName: string) => void;
};

export function valueForSubmit(field: CustomFieldRow, value: string): CustomValue {
  return parseDraftToScalar(field, value) as CustomValue;
}

export function validateCustomFieldValues(fields: CustomFieldRow[], values: Record<string, string>) {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (field.access?.canEdit === false) continue;
    const draft = values[field.systemName]?.trim() ?? "";
    const scalar = parseDraftToScalar(field, draft);
    const message = validateCustomFieldDraft(field, scalar);
    if (message) errors[field.systemName] = message;
  }
  return errors;
}

export function ResultCustomFields({ fields, values, errors, onChange, onClearError }: ResultCustomFieldsProps) {
  const visibleFields = fields.filter((field) => field.access?.canView !== false);
  if (visibleFields.length === 0) return null;

  return (
    <div className="grid gap-2">
      {visibleFields.map((field) => {
        const draft = values[field.systemName] ?? "";
        const scalar: CustomFieldScalar = parseDraftToScalar(field, draft);
        return (
          <CustomFieldValueInput
            key={field.id}
            field={field}
            value={scalar}
            draft={draft}
            size="sm"
            disabled={field.access?.canEdit === false}
            error={errors[field.systemName]}
            inputClassName="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
            onChange={(next) => {
              onChange({ ...values, [field.systemName]: stringDraftFromValue(next) });
              onClearError(field.systemName);
            }}
          />
        );
      })}
    </div>
  );
}
