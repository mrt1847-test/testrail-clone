import type { CustomFieldDefinition, CustomFieldScalar } from "./customFieldTypes";
import { isCheckboxField, isNumericField, maxRating, stringDraftFromValue } from "./customFieldTypes";

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
  const textSize = size === "sm" ? "text-xs" : "text-sm";
  const label = (
    <span className={`flex items-center gap-1 ${textSize} text-slate-700`}>
      {field.name}
      {field.isRequired ? <span className="text-xs font-medium text-red-600">Required</span> : null}
    </span>
  );

  if (field.fieldType === "dropdown" || field.fieldType === "select") {
    return (
      <label className={`grid gap-1 ${textSize}`}>
        {label}
        <select
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
        {error ? <span className="text-xs text-red-700">{error}</span> : null}
      </label>
    );
  }

  if (isCheckboxField(field.fieldType)) {
    return (
      <label className={`grid gap-1 ${textSize}`}>
        {label}
        <select
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
        {error ? <span className="text-xs text-red-700">{error}</span> : null}
      </label>
    );
  }

  if (field.fieldType === "multi_select") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <fieldset className={`grid gap-1 ${textSize}`}>
        {label}
        <div className="flex flex-wrap gap-2">
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
        {error ? <span className="text-xs text-red-700">{error}</span> : null}
      </fieldset>
    );
  }

  if (field.fieldType === "text") {
    return (
      <label className={`grid gap-1 ${textSize}`}>
        {label}
        <textarea
          className={inputClassName}
          disabled={disabled}
          rows={3}
          value={typeof value === "string" ? value : draft ?? ""}
          onChange={(event) => onChange(event.target.value || null)}
        />
        {error ? <span className="text-xs text-red-700">{error}</span> : null}
      </label>
    );
  }

  if (field.fieldType === "date") {
    return (
      <label className={`grid gap-1 ${textSize}`}>
        {label}
        <input
          type="date"
          className={inputClassName}
          disabled={disabled}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value || null)}
        />
        {error ? <span className="text-xs text-red-700">{error}</span> : null}
      </label>
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
    <label className={`grid gap-1 ${textSize}`}>
      {label}
      <input
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
      {error ? <span className="text-xs text-red-700">{error}</span> : null}
    </label>
  );
}
