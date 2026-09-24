/** Labels and routes for the two case-authoring entry points (UI-069 / CA-U01). */

export const FULL_AUTHORING_PRIMARY_LABEL = "Add Test Case";
export const QUICK_OUTLINE_SECTION_LABEL = "Add Case";

export type CaseAuthoringEntryKind = "full-form" | "title-outline";

export function caseAuthoringEntryKind(input: {
  label: string;
  opensFullForm: boolean;
}): CaseAuthoringEntryKind {
  if (input.opensFullForm) return "full-form";
  return "title-outline";
}

/** Header primary CTA must open the dedicated full form, not the quiet outline. */
export function headerPrimaryShouldOpenFullForm(label: string): boolean {
  return label === FULL_AUTHORING_PRIMARY_LABEL;
}

/** Overflow must not duplicate the same full-authoring path already on the header. */
export function shouldOmitFullAuthoringFromOverflow(input: {
  headerPrimaryIsFullForm: boolean;
}): boolean {
  return input.headerPrimaryIsFullForm;
}
