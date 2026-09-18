import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { CaseTemplateRow, CustomFieldRow } from "../../projects/api/settingsApi";
import { ReferencesInput } from "./ReferencesInput";
import { serializeCaseAuthoringDraft, type CaseAuthoringDraft } from "../utils/caseAuthoringDraft";

import { CustomFieldValueInput } from "../../../shared/customFields/CustomFieldValueInput";
import { Button } from "../../../shared/ui/Button";
import { FormField } from "../../../shared/ui/FormField";
import {
  validateCustomFieldDraft,
  type CustomFieldScalar
} from "../../../shared/customFields/customFieldTypes";

type ScalarCustomValue = CustomFieldScalar;

export type CaseAuthoringCustomFieldDefinition = Pick<
  CustomFieldRow,
  "systemName" | "name" | "fieldType" | "options" | "isRequired" | "isActive" | "displayOrder"
> & Pick<CustomFieldRow, "access">;

export type CaseAuthoringTemplateDefinition = Pick<
  CaseTemplateRow,
  "id" | "name" | "description" | "fields" | "isDefault" | "isActive" | "displayOrder"
>;

type CaseAuthoringFormProps = {
  projectId?: string;
  valueKey: string;
  initialTitle: string;
  initialPreconditions: string;
  initialEstimate?: string;
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
  onDirtyChange?: (dirty: boolean) => void;
  onSubmit: (input: {
    title: string;
    preconditions: string;
    estimate: string;
    references: string;
    expectedResult: string;
    mission: string;
    goals: string;
    aiInput: string;
    aiExpectedOutput: string;
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
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function normalizeValueForSubmit(
  field: CaseAuthoringCustomFieldDefinition,
  value: ScalarCustomValue
): ScalarCustomValue {
  if (value == null) return null;
  if (field.fieldType === "checkbox" || field.fieldType === "boolean") {
    return typeof value === "boolean" ? value : null;
  }
  if (field.fieldType === "multi_select") {
    return Array.isArray(value) && value.length > 0 ? value : null;
  }
  if (field.fieldType === "number" || field.fieldType === "integer" || field.fieldType === "rating") {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
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
  initialEstimate = "",
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
  onDirtyChange,
  onSubmit,
  onCancel
}: CaseAuthoringFormProps) {
  const activeCustomFields = useMemo(
    () =>
      customFields
        .filter((field) => field.isActive && field.access?.canView !== false)
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
  const [estimate, setEstimate] = useState(initialEstimate);
  const [references, setReferences] = useState(initialReferences);
  const [expectedResult, setExpectedResult] = useState(initialExpectedResult);
  const [customValues, setCustomValues] = useState<Record<string, ScalarCustomValue>>(initialCustomValues);
  const [selectedTemplateId, setSelectedTemplateId] = useState(() =>
    preferredTemplateId(activeTemplates, initialCaseTemplateId)
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);

  const initialDraftSnapshot = useMemo(
    () =>
      serializeCaseAuthoringDraft({
        title: initialTitle,
        preconditions: initialPreconditions,
        estimate: initialEstimate,
        references: initialReferences,
        expectedResult: initialExpectedResult,
        templateId: preferredTemplateId(activeTemplates, initialCaseTemplateId),
        customValues: initialCustomValues
      }),
    [
      activeTemplates,
      initialCaseTemplateId,
      initialCustomValues,
      initialEstimate,
      initialExpectedResult,
      initialPreconditions,
      initialReferences,
      initialTitle
    ]
  );
  const [baselineSnapshot, setBaselineSnapshot] = useState(initialDraftSnapshot);

  useEffect(() => {
    const initialDraft = JSON.parse(initialDraftSnapshot) as CaseAuthoringDraft;
    setTitle(initialDraft.title);
    setPreconditions(initialDraft.preconditions);
    setEstimate(initialDraft.estimate);
    setReferences(initialDraft.references);
    setExpectedResult(initialDraft.expectedResult);
    setCustomValues(initialDraft.customValues);
    setSelectedTemplateId(initialDraft.templateId);
    setBaselineSnapshot(initialDraftSnapshot);
    setFieldErrors({});
  }, [valueKey, initialDraftSnapshot]);

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

  const currentDraftSnapshot = useMemo(
    () =>
      serializeCaseAuthoringDraft({
        title,
        preconditions,
        estimate,
        references,
        expectedResult,
        templateId: selectedTemplateId,
        customValues
      }),
    [customValues, estimate, expectedResult, preconditions, references, selectedTemplateId, title]
  );
  const isDirty = currentDraftSnapshot !== baselineSnapshot;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

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
      if (field.access?.canEdit === false) continue;
      const value = customValues[field.systemName] ?? null;
      const typeError = validateCustomFieldDraft(field, value);
      if (typeError) {
        nextErrors[field.systemName] = typeError;
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
      <div data-case-field="title">
        <FormField label="Title" required error={fieldErrors.title} controlId="case-title">
          {(controlProps) => (
            <input
              {...controlProps}
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
          )}
        </FormField>
      </div>
    );

    const preconditionsNode = (
      <FormField label="Preconditions" controlId="case-preconditions">
        {(controlProps) => (
          <textarea
            {...controlProps}
            value={preconditions}
            onChange={(event) => setPreconditions(event.target.value)}
            className="min-h-[84px] rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
          />
        )}
      </FormField>
    );

    const referencesNode = (
      <FormField
        label="References"
        controlId="case-references"
        helpText={projectId ? undefined : "Comma-separated requirement or story IDs."}
      >
        {(controlProps) =>
          projectId ? (
            <ReferencesInput
              projectId={projectId}
              value={references}
              onChange={setReferences}
              disabled={isSubmitting}
              inputId={controlProps.id}
              describedBy={controlProps["aria-describedby"]}
              invalid={controlProps["aria-invalid"]}
            />
          ) : (
            <input
              {...controlProps}
              type="text"
              value={references}
              onChange={(event) => setReferences(event.target.value)}
              placeholder="REQ-1, REQ-2"
              className={inputClassName(false)}
            />
          )
        }
      </FormField>
    );

    const estimateNode = (
      <FormField label="Estimate" controlId="case-estimate" helpText="Examples: 5m, 1h 20m, or 01:30">
        {(controlProps) => (
          <input
            {...controlProps}
            type="text"
            value={estimate}
            onChange={(event) => setEstimate(event.target.value)}
            placeholder="5m, 1h 20m, or 01:30"
            className={inputClassName(false)}
          />
        )}
      </FormField>
    );

    const stepsNode = stepsSection && templateShowsSteps ? <div className="grid gap-2">{stepsSection}</div> : null;

    const expectedResultNode = templateShowsExpectedResult ? (
      <FormField label={builtinTemplateFieldLabel("expectedResult")} controlId="case-expected-result">
        {(controlProps) => (
          <textarea
            {...controlProps}
            value={expectedResult}
            onChange={(event) => setExpectedResult(event.target.value)}
            className="min-h-[84px] rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
          />
        )}
      </FormField>
    ) : null;

    const renderBuiltinTemplateField = (fieldKey: string) => {
      const normalized = normalizeTemplateFieldKey(fieldKey);
      if (normalized === "expectedresult") {
        return expectedResultNode;
      }
      const multiline =
        normalized === "scenario" || normalized === "ai_traces" || normalized === "ai_input" || normalized === "goals";
      return (
        <FormField
          key={normalized}
          label={builtinTemplateFieldLabel(fieldKey)}
          controlId={`case-${normalized.replace(/[^a-zA-Z0-9_-]/g, "-")}`}
        >
          {(controlProps) =>
            multiline ? (
              <textarea
                {...controlProps}
                value={String(customValues[normalized] ?? "")}
                onChange={(event) => setCustomValue(normalized, event.target.value)}
                className="min-h-[84px] rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
              />
            ) : (
              <input
                {...controlProps}
                type="text"
                value={String(customValues[normalized] ?? "")}
                onChange={(event) => setCustomValue(normalized, event.target.value)}
                className={inputClassName(false)}
              />
            )
          }
        </FormField>
      );
    };

    const renderCustomField = (field: CaseAuthoringCustomFieldDefinition) => (
      <div key={field.systemName} data-case-field={field.systemName}>
        <CustomFieldValueInput
          field={field}
          value={customValues[field.systemName] ?? null}
          error={fieldErrors[field.systemName]}
          disabled={field.access?.canEdit === false}
          inputClassName={inputClassName(Boolean(fieldErrors[field.systemName]))}
          onChange={(next) => setCustomValue(field.systemName, next)}
        />
      </div>
    );

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
      if (normalized === "estimate") {
        pushBlock("estimate", estimateNode);
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
      pushBlock("estimate", estimateNode);
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
    estimate,
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
    const firstInvalidKey = Object.keys(nextErrors)[0];
    if (firstInvalidKey) {
      window.requestAnimationFrame(() => {
        const field = Array.from(formRef.current?.querySelectorAll<HTMLElement>("[data-case-field]") ?? []).find(
          (element) => element.dataset.caseField === firstInvalidKey
        );
        const control = field?.querySelector<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        control?.focus();
        field?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
      return;
    }

    const normalizedCustomValues: Record<string, ScalarCustomValue> = { ...customValues };
    for (const field of activeCustomFields) {
      if (field.access?.canEdit === false) continue;
      normalizedCustomValues[field.systemName] = normalizeValueForSubmit(
        field,
        customValues[field.systemName] ?? null
      );
    }
    const mission = String(normalizedCustomValues.mission ?? "").trim();
    const goals = String(normalizedCustomValues.goals ?? "").trim();
    const aiInput = String(normalizedCustomValues.ai_input ?? "").trim();
    const aiExpectedOutput = String(normalizedCustomValues.ai_expected_output ?? "").trim();
    const exploratoryCustomValues = { ...normalizedCustomValues };
    delete exploratoryCustomValues.mission;
    delete exploratoryCustomValues.goals;
    delete exploratoryCustomValues.ai_input;
    delete exploratoryCustomValues.ai_expected_output;
    delete exploratoryCustomValues.ai_quality_rating;
    delete exploratoryCustomValues.ai_latency_ms;
    delete exploratoryCustomValues.ai_traces;

    try {
      await onSubmit({
        title: title.trim(),
        preconditions: preconditions.trim(),
        estimate: estimate.trim(),
        references: references.trim(),
        expectedResult: expectedResult.trim(),
        mission,
        goals,
        aiInput,
        aiExpectedOutput,
        customValues: exploratoryCustomValues,
        templateId: selectedTemplateId || null
      });
      setBaselineSnapshot(currentDraftSnapshot);
    } catch {
      // Parent handles submit error state.
    }
  }

  return (
    <form
      ref={formRef}
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      {activeTemplates.length > 0 ? (
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <FormField
            label="Template"
            controlId="case-template"
            helpText={selectedTemplate?.description || undefined}
          >
            {(controlProps) => (
              <select
                {...controlProps}
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
            )}
          </FormField>
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

      {submitError ? (
        <p className="text-sm font-medium text-red-700" role="alert">
          {submitError}
        </p>
      ) : null}

      <div
        className="sticky bottom-0 z-20 -mx-1 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white/95 px-3 py-3 shadow-[0_-8px_18px_-14px_rgba(15,23,42,0.45)] backdrop-blur"
        aria-label="Case editor actions"
      >
        <p className="text-xs text-slate-500">Required fields are marked.</p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
          type="submit"
          disabled={isSubmitting}
        >
          {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
