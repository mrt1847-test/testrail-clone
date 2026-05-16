import { useEffect, useMemo, useState, type ReactNode } from "react";

import type { CaseTemplateRow, CustomFieldRow } from "../../projects/api/settingsApi";
import { ReferencesInput } from "./ReferencesInput";

type ScalarCustomValue = string | number | boolean | null;

export type CaseAuthoringCustomFieldDefinition = Pick<
  CustomFieldRow,
  "systemName" | "name" | "fieldType" | "options" | "isRequired" | "isActive" | "displayOrder"
>;

export type CaseAuthoringTemplateDefinition = Pick<
  CaseTemplateRow,
  "id" | "name" | "description" | "fields" | "isDefault" | "isActive" | "displayOrder"
>;

type CaseAuthoringFormProps = {
  projectId?: string;
  valueKey: string;
  initialTitle: string;
  initialPreconditions: string;
  initialReferences?: string;
  initialExpectedResult?: string;
  initialCaseTemplateId?: string | null;
  initialCustomValues: Record<string, ScalarCustomValue>;
  customFields: CaseAuthoringCustomFieldDefinition[];
  templates?: CaseAuthoringTemplateDefinition[];
  onTemplateChange?: (info: { templateId: string; usesSteps: boolean }) => void;
  submitLabel: string;
  cancelLabel?: string;
  isSubmitting?: boolean;
  submitError?: string | null;
  stepsSection?: ReactNode;
  onSubmit: (input: {
    title: string;
    preconditions: string;
    references: string;
    expectedResult: string;
    customValues: Record<string, ScalarCustomValue>;
    templateId: string | null;
  }) => Promise<void> | void;
  onCancel: () => void;
};

function normalizeTemplateFieldKey(value: string) {
  return value.trim().toLowerCase();
}

const BUILTIN_TEMPLATE_FIELD_LABELS: Record<string, string> = {
  mission: "Mission",
  goals: "Goals",
  scenario: "Scenario",
  ai_input: "Input",
  ai_expected_output: "Expected output",
  ai_quality_rating: "Quality rating",
  ai_latency_ms: "Latency (ms)",
  ai_traces: "Traces"
};

function templateUsesSteps(fields: string[]) {
  return fields.some((field) => normalizeTemplateFieldKey(field) === "steps");
}

function templateUsesExpectedResult(fields: string[]) {
  return fields.some((field) => normalizeTemplateFieldKey(field) === "expectedresult");
}

function isBuiltinTemplateField(key: string) {
  const normalized = normalizeTemplateFieldKey(key);
  return normalized in BUILTIN_TEMPLATE_FIELD_LABELS || normalized === "expectedresult";
}

function builtinTemplateFieldLabel(key: string) {
  const normalized = normalizeTemplateFieldKey(key);
  if (normalized === "expectedresult") return "Expected result";
  return BUILTIN_TEMPLATE_FIELD_LABELS[normalized] ?? key;
}

function preferredTemplateId(templates: CaseAuthoringTemplateDefinition[], initialCaseTemplateId?: string | null) {
  if (initialCaseTemplateId && templates.some((template) => template.id === initialCaseTemplateId)) {
    return initialCaseTemplateId;
  }
  return templates.find((template) => template.isDefault)?.id ?? templates[0]?.id ?? "";
}

function isMissingRequiredValue(value: ScalarCustomValue) {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  return false;
}

function normalizeValueForSubmit(
  field: CaseAuthoringCustomFieldDefinition,
  value: ScalarCustomValue
): ScalarCustomValue {
  if (value == null) return null;
  if (field.fieldType === "boolean") return typeof value === "boolean" ? value : null;
  if (field.fieldType === "number") return typeof value === "number" && Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function inputClassName(hasError: boolean) {
  return [
    "rounded-md border px-3 py-2 text-sm text-slate-900 outline-none",
    hasError ? "border-red-300 focus:ring-2 focus:ring-red-200" : "border-slate-300 focus:ring-2 focus:ring-slate-400"
  ].join(" ");
}

export function CaseAuthoringForm({
  projectId = "",
  valueKey,
  initialTitle,
  initialPreconditions,
  initialReferences = "",
  initialExpectedResult = "",
  initialCaseTemplateId = null,
  initialCustomValues,
  customFields,
  templates = [],
  onTemplateChange,
  submitLabel,
  cancelLabel = "Cancel",
  isSubmitting = false,
  submitError = null,
  stepsSection,
  onSubmit,
  onCancel
}: CaseAuthoringFormProps) {
  const activeCustomFields = useMemo(
    () =>
      customFields
        .filter((field) => field.isActive)
        .sort((left, right) => left.displayOrder - right.displayOrder || left.name.localeCompare(right.name)),
    [customFields]
  );
  const activeTemplates = useMemo(
    () =>
      templates
        .filter((template) => template.isActive)
        .sort(
          (left, right) =>
            Number(right.isDefault) - Number(left.isDefault) ||
            left.displayOrder - right.displayOrder ||
            left.name.localeCompare(right.name)
        ),
    [templates]
  );

  const [title, setTitle] = useState(initialTitle);
  const [preconditions, setPreconditions] = useState(initialPreconditions);
  const [references, setReferences] = useState(initialReferences);
  const [expectedResult, setExpectedResult] = useState(initialExpectedResult);
  const [customValues, setCustomValues] = useState<Record<string, ScalarCustomValue>>(initialCustomValues);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setTitle(initialTitle);
    setPreconditions(initialPreconditions);
    setReferences(initialReferences);
    setExpectedResult(initialExpectedResult);
    setCustomValues(initialCustomValues);
    setSelectedTemplateId(preferredTemplateId(activeTemplates, initialCaseTemplateId));
    setFieldErrors({});
  }, [valueKey, initialCaseTemplateId, initialExpectedResult, initialCustomValues, initialPreconditions, initialReferences, initialTitle, activeTemplates]);

  useEffect(() => {
    if (activeTemplates.length === 0) {
      if (selectedTemplateId !== "") setSelectedTemplateId("");
      return;
    }
    if (!activeTemplates.some((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId(preferredTemplateId(activeTemplates));
    }
  }, [activeTemplates, selectedTemplateId]);

  const selectedTemplate = activeTemplates.find((template) => template.id === selectedTemplateId) ?? null;
  const selectedTemplateFields = selectedTemplate?.fields ?? [];
  const templateShowsSteps = templateUsesSteps(selectedTemplateFields);
  const templateShowsExpectedResult = templateUsesExpectedResult(selectedTemplateFields);

  useEffect(() => {
    if (!selectedTemplateId) return;
    onTemplateChange?.({ templateId: selectedTemplateId, usesSteps: templateShowsSteps });
  }, [onTemplateChange, selectedTemplateId, templateShowsSteps]);

  function setCustomValue(systemName: string, value: ScalarCustomValue) {
    setCustomValues((current) => {
      const next = { ...current, [systemName]: value };
      return next;
    });
    setFieldErrors((current) => {
      if (!(systemName in current)) return current;
      const next = { ...current };
      delete next[systemName];
      return next;
    });
  }

  function validate() {
    const nextErrors: Record<string, string> = {};
    if (title.trim().length === 0) {
      nextErrors.title = "Title is required.";
    }
    for (const field of activeCustomFields) {
      const value = customValues[field.systemName] ?? null;
      if (field.fieldType === "number" && typeof value === "number" && !Number.isFinite(value)) {
        nextErrors[field.systemName] = `${field.name} must be a valid number.`;
        continue;
      }
      if (!field.isRequired) continue;
      if (isMissingRequiredValue(value)) {
        nextErrors[field.systemName] = `${field.name} is required.`;
      }
    }
    return nextErrors;
  }

  const customFieldMap = useMemo(
    () => new Map(activeCustomFields.map((field) => [normalizeTemplateFieldKey(field.systemName), field])),
    [activeCustomFields]
  );

  const orderedBlocks = useMemo(() => {
    const seen = new Set<string>();
    const blocks: Array<{ key: string; node: ReactNode }> = [];

    const pushBlock = (key: string, node: ReactNode) => {
      if (seen.has(key)) return;
      seen.add(key);
      blocks.push({ key, node });
    };

    const titleNode = (
      <label className="grid gap-1 text-sm text-slate-700">
        <span className="flex items-center gap-1">
          Title
          <span className="text-xs font-medium text-red-600">Required</span>
        </span>
        <input
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setFieldErrors((current) => {
              if (!current.title) return current;
              const next = { ...current };
              delete next.title;
              return next;
            });
          }}
          className={inputClassName(Boolean(fieldErrors.title))}
        />
        {fieldErrors.title ? <span className="text-xs text-red-700">{fieldErrors.title}</span> : null}
      </label>
    );

    const preconditionsNode = (
      <label className="grid gap-1 text-sm text-slate-700">
        <span>Preconditions</span>
        <textarea
          value={preconditions}
          onChange={(event) => setPreconditions(event.target.value)}
          className="min-h-[84px] rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
        />
      </label>
    );

    const referencesNode = projectId ? (
      <label className="grid gap-1 text-sm text-slate-700">
        <span>References</span>
        <ReferencesInput projectId={projectId} value={references} onChange={setReferences} disabled={isSubmitting} />
      </label>
    ) : (
      <label className="grid gap-1 text-sm text-slate-700">
        <span>References</span>
        <input
          type="text"
          value={references}
          onChange={(event) => setReferences(event.target.value)}
          placeholder="REQ-1, REQ-2"
          className={inputClassName(false)}
        />
        <span className="text-xs text-slate-500">Comma-separated requirement or story IDs.</span>
      </label>
    );

    const stepsNode = stepsSection && templateShowsSteps ? <div className="grid gap-2">{stepsSection}</div> : null;

    const expectedResultNode = templateShowsExpectedResult ? (
      <label className="grid gap-1 text-sm text-slate-700">
        <span>{builtinTemplateFieldLabel("expectedResult")}</span>
        <textarea
          value={expectedResult}
          onChange={(event) => setExpectedResult(event.target.value)}
          className="min-h-[84px] rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
        />
      </label>
    ) : null;

    const renderBuiltinTemplateField = (fieldKey: string) => {
      const normalized = normalizeTemplateFieldKey(fieldKey);
      if (normalized === "expectedresult") {
        return expectedResultNode;
      }
      const multiline =
        normalized === "scenario" || normalized === "ai_traces" || normalized === "ai_input" || normalized === "goals";
      return (
        <label key={normalized} className="grid gap-1 text-sm text-slate-700">
          <span>{builtinTemplateFieldLabel(fieldKey)}</span>
          {multiline ? (
            <textarea
              value={String(customValues[normalized] ?? "")}
              onChange={(event) => setCustomValue(normalized, event.target.value)}
              className="min-h-[84px] rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
            />
          ) : (
            <input
              type="text"
              value={String(customValues[normalized] ?? "")}
              onChange={(event) => setCustomValue(normalized, event.target.value)}
              className={inputClassName(false)}
            />
          )}
        </label>
      );
    };

    const renderCustomField = (field: CaseAuthoringCustomFieldDefinition) => {
      const error = fieldErrors[field.systemName];
      const value = customValues[field.systemName] ?? null;
      const label = (
        <span className="flex items-center gap-1">
          {field.name}
          {field.isRequired ? <span className="text-xs font-medium text-red-600">Required</span> : null}
        </span>
      );

      if (field.fieldType === "select") {
        return (
          <label key={field.systemName} className="grid gap-1 text-sm text-slate-700">
            {label}
            <select
              className={inputClassName(Boolean(error))}
              value={typeof value === "string" ? value : ""}
              onChange={(event) => setCustomValue(field.systemName, event.target.value || null)}
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

      if (field.fieldType === "boolean") {
        return (
          <label key={field.systemName} className="grid gap-1 text-sm text-slate-700">
            {label}
            <select
              className={inputClassName(Boolean(error))}
              value={typeof value === "boolean" ? String(value) : ""}
              onChange={(event) =>
                setCustomValue(field.systemName, event.target.value === "" ? null : event.target.value === "true")
              }
            >
              <option value="">-</option>
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
            {error ? <span className="text-xs text-red-700">{error}</span> : null}
          </label>
        );
      }

      return (
        <label key={field.systemName} className="grid gap-1 text-sm text-slate-700">
          {label}
          <input
            type={field.fieldType === "number" ? "number" : "text"}
            className={inputClassName(Boolean(error))}
            value={value == null ? "" : String(value)}
            onChange={(event) =>
              setCustomValue(
                field.systemName,
                field.fieldType === "number"
                  ? event.target.value === ""
                    ? null
                    : Number(event.target.value)
                  : event.target.value
              )
            }
          />
          {error ? <span className="text-xs text-red-700">{error}</span> : null}
        </label>
      );
    };

    for (const fieldKey of selectedTemplate?.fields ?? []) {
      const normalized = normalizeTemplateFieldKey(fieldKey);
      if (normalized === "title") {
        pushBlock("title", titleNode);
        continue;
      }
      if (normalized === "preconditions") {
        pushBlock("preconditions", preconditionsNode);
        continue;
      }
      if (normalized === "references" || normalized === "refs") {
        pushBlock("references", referencesNode);
        continue;
      }
      if (normalized === "steps") {
        if (stepsNode) pushBlock("steps", stepsNode);
        continue;
      }
      if (normalized === "expectedresult") {
        if (expectedResultNode) pushBlock("expectedResult", expectedResultNode);
        continue;
      }
      if (isBuiltinTemplateField(fieldKey)) {
        pushBlock(`builtin:${normalized}`, renderBuiltinTemplateField(fieldKey));
        continue;
      }
      const customField = customFieldMap.get(normalized);
      if (customField) {
        pushBlock(`custom:${customField.systemName}`, renderCustomField(customField));
      }
    }

    if ((selectedTemplate?.fields ?? []).length === 0) {
      pushBlock("title", titleNode);
      pushBlock("preconditions", preconditionsNode);
      pushBlock("references", referencesNode);
      if (expectedResultNode) pushBlock("expectedResult", expectedResultNode);
      if (stepsNode) pushBlock("steps", stepsNode);
      for (const field of activeCustomFields) {
        pushBlock(`custom:${field.systemName}`, renderCustomField(field));
      }
    }
    return blocks;
  }, [
    activeCustomFields,
    customFieldMap,
    customValues,
    expectedResult,
    fieldErrors,
    preconditions,
    references,
    selectedTemplate?.fields,
    stepsSection,
    templateShowsExpectedResult,
    templateShowsSteps,
    title
  ]);

  async function handleSubmit() {
    const nextErrors = validate();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const normalizedCustomValues: Record<string, ScalarCustomValue> = { ...customValues };
    for (const field of activeCustomFields) {
      normalizedCustomValues[field.systemName] = normalizeValueForSubmit(
        field,
        customValues[field.systemName] ?? null
      );
    }
    try {
      await onSubmit({
        title: title.trim(),
        preconditions: preconditions.trim(),
        references: references.trim(),
        expectedResult: expectedResult.trim(),
        customValues: normalizedCustomValues,
        templateId: selectedTemplateId || null
      });
    } catch {
      // Parent handles submit error state.
    }
  }

  return (
    <div className="grid gap-3">
      {activeTemplates.length > 0 ? (
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <label className="grid gap-1 text-sm text-slate-700">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Template</span>
            <select
              value={selectedTemplateId}
              onChange={(event) => setSelectedTemplateId(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
            >
              {activeTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                  {template.isDefault ? " (Default)" : ""}
                </option>
              ))}
            </select>
          </label>
          {selectedTemplate?.description ? (
            <p className="mt-2 text-xs text-slate-600">{selectedTemplate.description}</p>
          ) : null}
          {templateShowsSteps && !stepsSection ? (
            <p className="mt-2 text-xs text-amber-700">This template expects steps. Add them after creating the case.</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-3">
        {orderedBlocks.map((block) => (
          <div key={block.key}>{block.node}</div>
        ))}
      </div>

      {submitError ? <p className="text-sm text-red-700">{submitError}</p> : null}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={isSubmitting}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          onClick={() => void handleSubmit()}
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
