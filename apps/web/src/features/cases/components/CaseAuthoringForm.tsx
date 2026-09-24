import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { CaseTemplateRow, CustomFieldRow } from "../../projects/api/settingsApi";
import { ReferencesInput, type ReferencesInputHandle } from "./ReferencesInput";
import { CaseStepsEditor } from "./CaseStepsEditor";
import { serializeCaseAuthoringDraft, type CaseAuthoringDraft } from "../utils/caseAuthoringDraft";
import { mergeCaseRefs } from "../utils/caseRefs";
import {
  CASE_PRIORITY_OPTIONS,
  CASE_TYPE_OPTIONS,
  convertInstructionDraft,
  draftStepsFromCaseSteps,
  emptyAuthoringDraftStep,
  instructionKindFromTemplateFields,
  textStepsFromPersistedSteps,
  type CaseAuthoringDraftStep
} from "../utils/caseAuthoringInstructions";
import type { CasePriority, CaseStep, CaseType } from "../types";

import { CustomFieldValueInput } from "../../../shared/customFields/CustomFieldValueInput";
import { Button } from "../../../shared/ui/Button";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
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

export type CaseAuthoringSubmitIntent = "primary" | "next";

export type CaseAuthoringSubmitInput = {
  title: string;
  preconditions: string;
  estimate: string;
  references: string;
  expectedResult: string;
  stepsText: string;
  draftSteps: CaseAuthoringDraftStep[];
  instructionKind: ReturnType<typeof instructionKindFromTemplateFields>;
  caseType: CaseType;
  priority: CasePriority;
  mission: string;
  goals: string;
  aiInput: string;
  aiExpectedOutput: string;
  customValues: Record<string, ScalarCustomValue>;
  templateId: string | null;
  intent: CaseAuthoringSubmitIntent;
};

type CaseAuthoringFormProps = {
  projectId?: string;
  valueKey: string;
  sectionPath?: string | null;
  sectionOptions?: Array<{ id: number; label: string }>;
  selectedSectionId?: number | null;
  onSectionIdChange?: (sectionId: number) => void;
  initialTitle: string;
  initialPreconditions: string;
  initialEstimate?: string;
  initialReferences?: string;
  initialExpectedResult?: string;
  initialCaseType?: CaseType;
  initialPriority?: CasePriority;
  initialSteps?: CaseStep[];
  initialCaseTemplateId?: string | null;
  initialCustomValues: Record<string, ScalarCustomValue>;
  customFields: CaseAuthoringCustomFieldDefinition[];
  templates?: CaseAuthoringTemplateDefinition[];
  submitLabel: string;
  nextSubmitLabel?: string | null;
  cancelLabel?: string;
  isSubmitting?: boolean;
  submitError?: string | null;
  showRetry?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onSubmit: (input: CaseAuthoringSubmitInput) => Promise<void> | void;
  onCancel: () => void;
  /** Optional content rendered above the sticky action bar (e.g. add-case attachment staging). */
  beforeActions?: ReactNode;
  /** Panel/narrow layouts: stack fields and put instructions before optional meta. */
  stackFields?: boolean;
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
  sectionPath = null,
  sectionOptions,
  selectedSectionId = null,
  onSectionIdChange,
  initialTitle,
  initialPreconditions,
  initialEstimate = "",
  initialReferences = "",
  initialExpectedResult = "",
  initialCaseType = "Functional",
  initialPriority = "Medium",
  initialSteps = [],
  initialCaseTemplateId = null,
  initialCustomValues,
  customFields,
  templates = [],
  submitLabel,
  nextSubmitLabel = null,
  cancelLabel = "Cancel",
  isSubmitting = false,
  submitError = null,
  showRetry = false,
  onDirtyChange,
  onSubmit,
  onCancel,
  beforeActions = null,
  stackFields = false
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
  const [referencesDraft, setReferencesDraft] = useState("");
  const referencesInputRef = useRef<ReferencesInputHandle | null>(null);
  const [expectedResult, setExpectedResult] = useState(initialExpectedResult);
  const [stepsText, setStepsText] = useState(() => textStepsFromPersistedSteps(initialSteps));
  const [draftSteps, setDraftSteps] = useState<CaseAuthoringDraftStep[]>(() => draftStepsFromCaseSteps(initialSteps));
  const [caseType, setCaseType] = useState<CaseType>(initialCaseType);
  const [priority, setPriority] = useState<CasePriority>(initialPriority);
  const [customValues, setCustomValues] = useState<Record<string, ScalarCustomValue>>(initialCustomValues);
  const [selectedTemplateId, setSelectedTemplateId] = useState(() =>
    preferredTemplateId(activeTemplates, initialCaseTemplateId)
  );
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
  const [templateChangeWarning, setTemplateChangeWarning] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitIntent, setSubmitIntent] = useState<CaseAuthoringSubmitIntent>("primary");
  const formRef = useRef<HTMLFormElement>(null);

  const initialDraftSnapshot = useMemo(
    () =>
      serializeCaseAuthoringDraft({
        title: initialTitle,
        preconditions: initialPreconditions,
        estimate: initialEstimate,
        references: initialReferences,
        expectedResult: initialExpectedResult,
        stepsText: textStepsFromPersistedSteps(initialSteps),
        draftSteps: draftStepsFromCaseSteps(initialSteps).map(({ description, expected }) => ({
          description,
          expected
        })),
        caseType: initialCaseType,
        priority: initialPriority,
        templateId: preferredTemplateId(activeTemplates, initialCaseTemplateId),
        customValues: initialCustomValues
      }),
    [
      activeTemplates,
      initialCaseTemplateId,
      initialCaseType,
      initialCustomValues,
      initialEstimate,
      initialExpectedResult,
      initialPreconditions,
      initialPriority,
      initialReferences,
      initialSteps,
      initialTitle
    ]
  );
  const [baselineSnapshot, setBaselineSnapshot] = useState(initialDraftSnapshot);
  const [baselineSectionId, setBaselineSectionId] = useState(selectedSectionId);

  useEffect(() => {
    const initialDraft = JSON.parse(initialDraftSnapshot) as CaseAuthoringDraft;
    setTitle(initialDraft.title);
    setPreconditions(initialDraft.preconditions);
    setEstimate(initialDraft.estimate);
    setReferences(initialDraft.references);
    setReferencesDraft("");
    setExpectedResult(initialDraft.expectedResult);
    setStepsText(initialDraft.stepsText);
    setDraftSteps(
      initialDraft.draftSteps.length > 0
        ? initialDraft.draftSteps.map((step) => ({ ...emptyAuthoringDraftStep(), ...step }))
        : [emptyAuthoringDraftStep()]
    );
    setCaseType((initialDraft.caseType as CaseType) || "Functional");
    setPriority((initialDraft.priority as CasePriority) || "Medium");
    setCustomValues(initialDraft.customValues);
    setSelectedTemplateId(initialDraft.templateId);
    setPendingTemplateId(null);
    setTemplateChangeWarning(null);
    setBaselineSnapshot(initialDraftSnapshot);
    // Destination section is not part of valueKey; capture the current destination only when the draft identity resets.
    setBaselineSectionId(selectedSectionId);
    setFieldErrors({});
    // selectedSectionId intentionally omitted: section changes must not wipe the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on authoring identity / initial snapshot
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
  const instructionKind = instructionKindFromTemplateFields(selectedTemplateFields);
  const templateShowsSteps = instructionKind === "steps";
  const templateShowsExpectedResult =
    instructionKind === "text" || instructionKind === "steps" || templateUsesExpectedResult(selectedTemplateFields);

  function applyTemplateId(nextTemplateId: string) {
    const nextTemplate = activeTemplates.find((template) => template.id === nextTemplateId) ?? null;
    const nextKind = instructionKindFromTemplateFields(nextTemplate?.fields);
    const converted = convertInstructionDraft({
      from: instructionKind,
      to: nextKind,
      stepsText,
      draftSteps,
      expectedResult
    });
    setStepsText(converted.stepsText);
    setDraftSteps(converted.draftSteps);
    setExpectedResult(converted.expectedResult);
    setSelectedTemplateId(nextTemplateId);
    setPendingTemplateId(null);
    setTemplateChangeWarning(null);
  }

  function requestTemplateChange(nextTemplateId: string) {
    if (nextTemplateId === selectedTemplateId) return;
    const nextTemplate = activeTemplates.find((template) => template.id === nextTemplateId) ?? null;
    const nextKind = instructionKindFromTemplateFields(nextTemplate?.fields);
    if (nextKind === instructionKind) {
      setSelectedTemplateId(nextTemplateId);
      return;
    }
    const converted = convertInstructionDraft({
      from: instructionKind,
      to: nextKind,
      stepsText,
      draftSteps,
      expectedResult
    });
    const hasInstructions =
      stepsText.trim().length > 0 ||
      expectedResult.trim().length > 0 ||
      draftSteps.some((step) => step.description.trim() || step.expected.trim());
    if (!hasInstructions || !converted.warning) {
      applyTemplateId(nextTemplateId);
      return;
    }
    setPendingTemplateId(nextTemplateId);
    setTemplateChangeWarning(converted.warning);
  }

  const currentDraftSnapshot = useMemo(
    () =>
      serializeCaseAuthoringDraft({
        title,
        preconditions,
        estimate,
        references: mergeCaseRefs(references, referencesDraft),
        expectedResult,
        stepsText,
        draftSteps: draftSteps.map(({ description, expected }) => ({ description, expected })),
        caseType,
        priority,
        templateId: selectedTemplateId,
        customValues
      }),
    [
      caseType,
      customValues,
      draftSteps,
      estimate,
      expectedResult,
      preconditions,
      priority,
      references,
      referencesDraft,
      selectedTemplateId,
      stepsText,
      title
    ]
  );
  const isDirty =
    currentDraftSnapshot !== baselineSnapshot ||
    Boolean(referencesDraft.trim()) ||
    selectedSectionId !== baselineSectionId;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

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
              className={`${inputClassName(Boolean(fieldErrors.title))} text-base`}
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
              ref={referencesInputRef}
              projectId={projectId}
              value={references}
              onChange={setReferences}
              onDraftChange={setReferencesDraft}
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

    const stepsNode = templateShowsSteps ? (
      <CaseStepsEditor steps={draftSteps} disabled={isSubmitting} onChange={setDraftSteps} />
    ) : null;

    const textStepsNode =
      instructionKind === "text" ? (
        <FormField label="Steps" controlId="case-steps-text">
          {(controlProps) => (
            <textarea
              {...controlProps}
              value={stepsText}
              onChange={(event) => setStepsText(event.target.value)}
              className="min-h-[96px] rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
            />
          )}
        </FormField>
      ) : null;

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
        if (textStepsNode) pushBlock("stepsText", textStepsNode);
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

    if ((selectedTemplate?.fields ?? []).length > 0) {
      if (textStepsNode && !seen.has("stepsText")) {
        const preconditionsIndex = blocks.findIndex((block) => block.key === "preconditions");
        const expectedIndex = blocks.findIndex((block) => block.key === "expectedResult");
        const textBlock = { key: "stepsText", node: textStepsNode };
        if (preconditionsIndex >= 0) {
          blocks.splice(preconditionsIndex + 1, 0, textBlock);
        } else if (expectedIndex >= 0) {
          blocks.splice(expectedIndex, 0, textBlock);
        } else {
          blocks.push(textBlock);
        }
        seen.add("stepsText");
      }
      if (expectedResultNode && !seen.has("expectedResult")) {
        const stepsIndex = blocks.findIndex((block) => block.key === "steps" || block.key === "stepsText");
        const preconditionsIndex = blocks.findIndex((block) => block.key === "preconditions");
        const expectedBlock = { key: "expectedResult", node: expectedResultNode };
        if (stepsIndex >= 0) {
          blocks.splice(stepsIndex + 1, 0, expectedBlock);
        } else if (preconditionsIndex >= 0) {
          blocks.splice(preconditionsIndex + 1, 0, expectedBlock);
        } else {
          blocks.push(expectedBlock);
        }
        seen.add("expectedResult");
      }
    }

    if ((selectedTemplate?.fields ?? []).length === 0) {
      pushBlock("title", titleNode);
      pushBlock("preconditions", preconditionsNode);
      pushBlock("estimate", estimateNode);
      pushBlock("references", referencesNode);
      if (expectedResultNode) pushBlock("expectedResult", expectedResultNode);
      if (textStepsNode) pushBlock("stepsText", textStepsNode);
      if (stepsNode) pushBlock("steps", stepsNode);
      for (const field of activeCustomFields) {
        pushBlock(`custom:${field.systemName}`, renderCustomField(field));
      }
    }
    if (!seen.has("estimate")) pushBlock("estimate", estimateNode);
    if (!seen.has("references")) pushBlock("references", referencesNode);
    return blocks;
  }, [
    activeCustomFields,
    customFieldMap,
    customValues,
    draftSteps,
    expectedResult,
    estimate,
    fieldErrors,
    instructionKind,
    isSubmitting,
    preconditions,
    references,
    selectedTemplate?.fields,
    stepsText,
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
      // Flush still-typed References text before building the payload (blur+setState races drop JIRA-UI021).
      const submittedReferences =
        referencesInputRef.current?.flush() ?? mergeCaseRefs(references, referencesDraft);
      setReferencesDraft("");
      await onSubmit({
        title: title.trim(),
        preconditions: preconditions.trim(),
        estimate: estimate.trim(),
        references: submittedReferences.trim(),
        expectedResult: expectedResult.trim(),
        stepsText: stepsText.trim(),
        draftSteps,
        instructionKind,
        caseType,
        priority,
        mission,
        goals,
        aiInput,
        aiExpectedOutput,
        customValues: exploratoryCustomValues,
        templateId: selectedTemplateId || null,
        intent: submitIntent
      });
      setBaselineSnapshot(
        serializeCaseAuthoringDraft({
          title,
          preconditions,
          estimate,
          references: submittedReferences,
          expectedResult,
          stepsText,
          draftSteps: draftSteps.map(({ description, expected }) => ({ description, expected })),
          caseType,
          priority,
          templateId: selectedTemplateId,
          customValues
        })
      );
    } catch {
      // Parent handles submit error state.
    }
  }

  const titleBlock = orderedBlocks.find((block) => block.key === "title");
  const estimateBlock = orderedBlocks.find((block) => block.key === "estimate");
  const referencesBlock = orderedBlocks.find((block) => block.key === "references");
  const bodyBlocks = orderedBlocks.filter(
    (block) => block.key !== "title" && block.key !== "estimate" && block.key !== "references"
  );
  const metaGridClass = stackFields ? "grid gap-3" : "grid gap-3 sm:grid-cols-2";

  const destinationFields = (
    <>
      {sectionOptions && sectionOptions.length > 0 ? (
        <FormField label="Section" controlId="case-section" required>
          {(controlProps) => (
            <select
              {...controlProps}
              value={selectedSectionId ?? ""}
              onChange={(event) => onSectionIdChange?.(Number(event.target.value))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
            >
              {sectionOptions.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.label}
                </option>
              ))}
            </select>
          )}
        </FormField>
      ) : sectionPath ? (
        <p className={stackFields ? "text-sm text-slate-600" : "sm:col-span-2 text-sm text-slate-600"}>
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Section</span>{" "}
          {sectionPath}
        </p>
      ) : null}
      {activeTemplates.length > 0 ? (
        <FormField label="Template" controlId="case-template">
          {(controlProps) => (
            <select
              {...controlProps}
              value={selectedTemplateId}
              onChange={(event) => requestTemplateChange(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
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
      ) : null}
    </>
  );

  const optionalMetaFields = (
    <>
      <FormField label="Type" controlId="case-type">
        {(controlProps) => (
          <select
            {...controlProps}
            value={caseType}
            onChange={(event) => setCaseType(event.target.value as CaseType)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
          >
            {CASE_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )}
      </FormField>
      <FormField label="Priority" controlId="case-priority">
        {(controlProps) => (
          <select
            {...controlProps}
            value={priority}
            onChange={(event) => setPriority(event.target.value as CasePriority)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
          >
            {CASE_PRIORITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )}
      </FormField>
      {estimateBlock ? <div>{estimateBlock.node}</div> : null}
      {referencesBlock ? <div>{referencesBlock.node}</div> : null}
    </>
  );

  const instructionFields = (
    <div className="grid gap-3" data-case-authoring-instructions>
      {bodyBlocks.map((block) => (
        <div key={block.key}>{block.node}</div>
      ))}
    </div>
  );

  return (
    <form
      ref={formRef}
      className="grid gap-4"
      data-case-authoring-form
      data-stack-fields={stackFields ? "true" : "false"}
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      {titleBlock ? <div>{titleBlock.node}</div> : null}

      {stackFields ? (
        <>
          <div className={metaGridClass} data-case-authoring-destination>
            {destinationFields}
          </div>
          {instructionFields}
          <div className={metaGridClass} data-case-authoring-optional-meta>
            {optionalMetaFields}
          </div>
        </>
      ) : (
        <>
          <div className={metaGridClass}>
            {destinationFields}
            {optionalMetaFields}
          </div>
          {instructionFields}
        </>
      )}

      {submitError ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-red-700" role="alert">
            {submitError}
          </p>
          {showRetry ? (
            <Button type="button" size="sm" variant="secondary" disabled={isSubmitting} onClick={() => void handleSubmit()}>
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}

      {beforeActions}

      <div
        className="sticky bottom-0 z-20 -mx-1 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white/95 px-3 py-3 shadow-[0_-8px_18px_-14px_rgba(15,23,42,0.45)] backdrop-blur"
        aria-label="Case editor actions"
      >
        <p className="text-xs text-slate-500">Required fields are marked.</p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          {nextSubmitLabel ? (
            <Button
              type="submit"
              variant="secondary"
              disabled={isSubmitting}
              onClick={() => setSubmitIntent("next")}
            >
              {isSubmitting && submitIntent === "next" ? "Adding..." : nextSubmitLabel}
            </Button>
          ) : null}
          <Button type="submit" disabled={isSubmitting} onClick={() => setSubmitIntent("primary")}>
            {isSubmitting && submitIntent === "primary"
              ? nextSubmitLabel
                ? "Adding..."
                : submitLabel
              : submitLabel}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={pendingTemplateId != null}
        title="Change template?"
        description={templateChangeWarning}
        confirmLabel="Change template"
        cancelLabel="Keep current template"
        onConfirm={() => {
          if (pendingTemplateId) applyTemplateId(pendingTemplateId);
        }}
        onCancel={() => {
          setPendingTemplateId(null);
          setTemplateChangeWarning(null);
        }}
      />
    </form>
  );
}
