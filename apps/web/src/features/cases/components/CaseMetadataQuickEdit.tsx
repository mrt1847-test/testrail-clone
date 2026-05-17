import { useEffect, useMemo, useState } from "react";

import { CustomFieldValueInput } from "../../../shared/customFields/CustomFieldValueInput";
import {
  validateCustomFieldDraft,
  type CustomFieldScalar
} from "../../../shared/customFields/customFieldTypes";
import { updateCase } from "../api/catalogApi";
import { extractApiErrorMessage } from "../caseErrors";
import { joinCaseLabels, parseCaseLabels } from "../utils/caseLabels";
import type { CaseAuthoringCustomFieldDefinition } from "./CaseAuthoringForm";
import { LabelsInput } from "./LabelsInput";
import { ReferencesInput } from "./ReferencesInput";

type CaseMetadataQuickEditProps = {
  projectId: string;
  caseId: number;
  lockVersion: number;
  references: string;
  labels: string[];
  customValues: Record<string, CustomFieldScalar>;
  customFields: CaseAuthoringCustomFieldDefinition[];
  onSaved: () => void;
};

export function CaseMetadataQuickEdit({
  projectId,
  caseId,
  lockVersion,
  references,
  labels,
  customValues,
  customFields,
  onSaved
}: CaseMetadataQuickEditProps) {
  const activeFields = useMemo(() => customFields.filter((field) => field.isActive), [customFields]);
  const [refsDraft, setRefsDraft] = useState(references);
  const [labelsDraft, setLabelsDraft] = useState(joinCaseLabels(labels));
  const [valuesDraft, setValuesDraft] = useState<Record<string, CustomFieldScalar>>(customValues);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setRefsDraft(references);
    setLabelsDraft(joinCaseLabels(labels));
    setValuesDraft(customValues);
    setFieldErrors({});
    setSaveError(null);
  }, [caseId, references, labels, customValues]);

  async function handleSave() {
    const errors: Record<string, string> = {};
    for (const field of activeFields) {
      const message = validateCustomFieldDraft(field, valuesDraft[field.systemName] ?? null);
      if (message) errors[field.systemName] = message;
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setSaveError("Fix the highlighted custom fields before saving.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    try {
      await updateCase(caseId, {
        refs: refsDraft.trim().length > 0 ? refsDraft.trim() : null,
        labels: parseCaseLabels(labelsDraft),
        customValues: valuesDraft,
        expectedVersion: lockVersion
      });
      onSaved();
    } catch (error) {
      setSaveError(extractApiErrorMessage(error, "Could not save metadata."));
    } finally {
      setIsSaving(false);
    }
  }

  if (!projectId) return null;

  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Quick edit metadata</p>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void handleSave()}
          className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save metadata"}
        </button>
      </div>

      <div className="mt-3 grid gap-4">
        <label className="grid gap-1 text-sm text-slate-700">
          <span className="text-xs font-medium text-slate-600">References</span>
          <ReferencesInput projectId={projectId} value={refsDraft} onChange={setRefsDraft} disabled={isSaving} />
        </label>
        <label className="grid gap-1 text-sm text-slate-700">
          <span className="text-xs font-medium text-slate-600">Labels</span>
          <LabelsInput value={labelsDraft} onChange={setLabelsDraft} disabled={isSaving} />
        </label>
        {activeFields.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {activeFields.map((field) => (
              <CustomFieldValueInput
                key={field.systemName}
                field={field}
                value={valuesDraft[field.systemName] ?? null}
                error={fieldErrors[field.systemName]}
                disabled={isSaving || field.access?.canEdit === false}
                onChange={(next) => {
                  setValuesDraft((current) => ({ ...current, [field.systemName]: next }));
                  if (fieldErrors[field.systemName]) {
                    setFieldErrors((current) => ({ ...current, [field.systemName]: "" }));
                  }
                }}
              />
            ))}
          </div>
        ) : null}
      </div>

      {saveError ? <p className="mt-2 text-xs text-red-700">{saveError}</p> : null}
    </div>
  );
}
