import type { CustomFieldScalar } from "../../../shared/customFields/customFieldTypes";

export type CaseAuthoringDraft = {
  title: string;
  preconditions: string;
  estimate: string;
  references: string;
  expectedResult: string;
  templateId: string;
  customValues: Record<string, CustomFieldScalar>;
};

export function serializeCaseAuthoringDraft(draft: CaseAuthoringDraft) {
  const customValues = Object.fromEntries(
    Object.entries(draft.customValues).sort(([left], [right]) => left.localeCompare(right))
  );
  return JSON.stringify({ ...draft, customValues });
}
