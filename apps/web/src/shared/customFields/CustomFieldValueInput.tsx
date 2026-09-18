import { useId } from "react";

import type { CustomFieldDefinition, CustomFieldScalar } from "./customFieldTypes";
import { isCheckboxField, isNumericField, maxRating, stringDraftFromValue } from "./customFieldTypes";
import { FormField } from "../ui/FormField";

type Props = {
  field: CustomFieldDefinition;
  value: CustomFieldScalar;
  draft?: string;
  error?: string;
  inputClassName: string;
  size?: "sm" | "md";
  disabled?: boolean;
  onChange: (value: CustomFieldScalar) => void;
};

export function CustomFieldValueInput({
  field,
  value,
  draft,
  error,
  inputClassName,
  size = "md",
  disabled = false,
  onChange
}: Props) {
  const generatedId = useId().replace(/:/g, "");
  const textSize = size === "sm" ? "text-xs" : "text-sm";
  const fieldProps = {
    label: field.name,
    required: field.isRequired,
    error,
    className: textSize,
    controlId: `custom-field-${field.systemName.replace(/[^a-zA-Z0-9_-]/g, "-")}-${generatedId}`
  };

  if (field.fieldType === "dropdown" || field.fieldType === "select") {
    return (
      <FormField {...fieldProps}>
        {(controlProps) => (
          <select
            {...controlProps}
            className={inputClassName}
            disabled={disabled}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value || null)}
          >
            <option value="">-</option>
            {field.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )}
      </FormField>
    );
  }

  if (isCheckboxField(field.fieldType)) {
    return (
      <FormField {...fieldProps}>
        {(controlProps) => (
          <select
            {...controlProps}
            className={inputClassName}
            disabled={disabled}
            value={typeof value === "boolean" ? String(value) : ""}
            onChange={(event) =>
              onChange(event.target.value === "" ? null : event.target.value === "true")
            }
          >
            <option value="">-</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        )}
      </FormField>
    );
  }

  if (field.fieldType === "multi_select") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <FormField {...fieldProps}>
        {(controlProps) => (
          <div {...controlProps} role="group" className="flex flex-wrap gap-2">
            {field.options.map((option) => {
              const checked = selected.includes(option);
              return (
                <label key={option} className="inline-flex items-center gap-1.5 rounded border border-slate-200 px-2 py-1">
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={checked}
                    onChange={() => {
                      const next = checked ? selected.filter((item) => item !== option) : [...selected, option];
                      onChange(next.length > 0 ? next : null);
                    }}
                  />
                  <span>{option}</span>
                </label>
              );
            })}
          </div>
        )}
      </FormField>
    );
  }

  if (field.fieldType === "text") {
    return (
      <FormField {...fieldProps}>
        {(controlProps) => (
          <textarea
            {...controlProps}
            className={inputClassName}
            disabled={disabled}
            rows={3}
            value={typeof value === "string" ? value : draft ?? ""}
            onChange={(event) => onChange(event.target.value || null)}
          />
        )}
      </FormField>
    );
  }

  if (field.fieldType === "date") {
    return (
      <FormField {...fieldProps}>
        {(controlProps) => (
          <input
            {...controlProps}
            type="date"
            className={inputClassName}
            disabled={disabled}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onChange(event.target.value || null)}
          />
        )}
      </FormField>
    );
  }

  const inputType =
    field.fieldType === "url"
      ? "url"
      : field.fieldType === "integer" || field.fieldType === "number" || field.fieldType === "rating"
        ? "number"
        : "text";

  const placeholder =
    field.fieldType === "user"
      ? "User ID"
      : field.fieldType === "milestone"
        ? "Milestone ID"
        : field.fieldType === "url"
          ? "https://"
          : undefined;

  const ratingMax = field.fieldType === "rating" ? maxRating(field.options) : undefined;

  return (
    <FormField {...fieldProps}>
      {(controlProps) => (
        <input
          {...controlProps}
          type={inputType}
          className={inputClassName}
          disabled={disabled}
          placeholder={placeholder}
          min={field.fieldType === "rating" ? 1 : field.fieldType === "integer" ? undefined : undefined}
          max={ratingMax}
          step={field.fieldType === "integer" || field.fieldType === "rating" ? 1 : undefined}
          value={
            typeof value === "number"
              ? String(value)
              : typeof value === "string"
                ? value
                : draft ?? stringDraftFromValue(value)
          }
          onChange={(event) => {
            const raw = event.target.value;
            if (!raw) {
              onChange(null);
              return;
            }
            if (isNumericField(field.fieldType)) {
              onChange(raw === "" ? null : Number(raw));
              return;
            }
            onChange(raw);
          }}
        />
      )}
    </FormField>
  );
}
