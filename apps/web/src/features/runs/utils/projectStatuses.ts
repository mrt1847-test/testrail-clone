import type { CustomStatusRow } from "../../projects/api/settingsApi";
import type { ResultStatus } from "../components/resultEntryTypes";

export type ProjectStatusOption = {
  id: string;
  label: string;
  canonicalStatus: ResultStatus;
  color: string;
  isFinal: boolean;
  isUntested: boolean;
  isSystem: boolean;
};

export function toProjectStatusOptions(rows: CustomStatusRow[]): ProjectStatusOption[] {
  return rows
    .filter((row) => row.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name))
    .map((row) => ({
      id: row.id,
      label: row.name,
      canonicalStatus: row.canonicalStatus,
      color: row.color,
      isFinal: row.isFinal ?? ["passed", "failed", "blocked"].includes(row.canonicalStatus),
      isUntested: row.isUntested ?? row.canonicalStatus === "untested",
      isSystem: row.isSystem
    }));
}

export function defaultProjectStatusOptions(): ProjectStatusOption[] {
  return [
    { id: "untested", label: "Untested", canonicalStatus: "untested", color: "#64748b", isFinal: false, isUntested: true, isSystem: true },
    { id: "passed", label: "Passed", canonicalStatus: "passed", color: "#15803d", isFinal: true, isUntested: false, isSystem: true },
    { id: "failed", label: "Failed", canonicalStatus: "failed", color: "#b91c1c", isFinal: true, isUntested: false, isSystem: true },
    { id: "blocked", label: "Blocked", canonicalStatus: "blocked", color: "#a16207", isFinal: true, isUntested: false, isSystem: true },
    { id: "retest", label: "Retest", canonicalStatus: "retest", color: "#0369a1", isFinal: false, isUntested: false, isSystem: true }
  ];
}
