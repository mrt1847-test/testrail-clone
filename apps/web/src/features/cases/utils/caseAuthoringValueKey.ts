/** Stable form identity for CaseAuthoringForm. Section is a destination field, not part of reset identity. */
export function caseAuthoringValueKey(input: {
  mode: "add" | "edit";
  formKey: number;
  caseId?: number;
  lockVersion?: number;
}) {
  if (input.mode === "edit" && input.caseId != null) {
    return `edit:${input.caseId}:${input.lockVersion ?? 0}`;
  }
  return `add:${input.formKey}`;
}
