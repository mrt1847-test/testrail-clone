/** Presentation order and duplication guards for case read/edit panels (UI-070 / CA-U02). */

export const CASE_READ_PRIMARY_ORDER = [
  "heading",
  "meta",
  "instructions",
  "attachments",
  "versions",
  "actions"
] as const;

export type CaseReadPrimarySection = (typeof CASE_READ_PRIMARY_ORDER)[number];

/** Labels that must appear at most once in the read panel. */
export const CASE_READ_SINGLETON_LABELS = [
  "Type",
  "Priority",
  "Template",
  "Preconditions"
] as const;

export function countLabelOccurrences(visibleLabels: string[], label: string): number {
  const needle = label.trim().toLowerCase();
  return visibleLabels.filter((row) => row.trim().toLowerCase() === needle).length;
}

/** True when any singleton meta/instruction label is shown more than once. */
export function hasDuplicateCaseReadLabels(visibleLabels: string[]): boolean {
  return CASE_READ_SINGLETON_LABELS.some((label) => countLabelOccurrences(visibleLabels, label) > 1);
}

export function shouldStackAuthoringFields(layout: "embedded" | "page"): boolean {
  return layout === "embedded";
}

/** Attachments belong after the instruction body, not above the authoring form. */
export function caseAttachmentPlacement(): "after-instructions" {
  return "after-instructions";
}

/**
 * Panel edit hierarchy: title + destination/template, then instructions, then optional meta.
 * Full-page create can keep destination fields with type/priority in one meta band.
 */
export function caseEditFieldBands(input: {
  stackFields: boolean;
}): Array<"title" | "destination" | "instructions" | "optional-meta"> {
  if (input.stackFields) {
    return ["title", "destination", "instructions", "optional-meta"];
  }
  return ["title", "destination", "optional-meta", "instructions"];
}
