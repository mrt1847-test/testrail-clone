import type { ResultStatus } from "../components/resultEntryTypes";
import type { ProjectStatusOption } from "./projectStatuses";

export type RunListStatusChoice = {
  id: string;
  label: string;
  canonicalStatus: ResultStatus;
  disabled: boolean;
  isCurrent: boolean;
};

export function runListStatusAriaLabel(caseCode: string): string {
  return `Status for ${caseCode}. Opens the result dialog with the chosen status.`;
}

export function runListStatusTitle(): string {
  return "Choose a status to add a result. The current status can be chosen again. The test is not updated until you save.";
}

export function runListStatusChoices(
  options: ProjectStatusOption[],
  currentStatus: string
): RunListStatusChoice[] {
  return options.map((option) => ({
    id: option.id,
    label: option.label,
    canonicalStatus: option.canonicalStatus,
    disabled: option.isUntested,
    isCurrent: option.canonicalStatus === currentStatus
  }));
}

export function shouldOpenResultDialogForListStatus(choice: Pick<RunListStatusChoice, "disabled">): boolean {
  return !choice.disabled;
}
