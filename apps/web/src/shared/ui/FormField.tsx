import { useId, type ReactNode } from "react";

export type FormFieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

type FormFieldProps = {
  label: string;
  required?: boolean;
  helpText?: ReactNode;
  error?: string;
  controlId?: string;
  className?: string;
  children: (controlProps: FormFieldControlProps) => ReactNode;
};

export function FormField({
  label,
  required = false,
  helpText,
  error,
  controlId,
  className = "",
  children
}: FormFieldProps) {
  const generatedId = useId();
  const id = controlId ?? `field-${generatedId.replace(/:/g, "")}`;
  const helpId = helpText ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`grid gap-1 text-sm text-slate-700 ${className}`.trim()}>
      <label htmlFor={id} className="flex items-center gap-1 font-medium">
        {label}
        {required ? <span className="text-xs font-medium text-red-600">Required</span> : null}
      </label>
      {children({
        id,
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        ...(error ? { "aria-invalid": true } : {})
      })}
      {helpText ? (
        <p id={helpId} className="text-xs text-slate-500">
          {helpText}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
