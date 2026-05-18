import type { TestInstance } from "../modules/runs/runs.types.js";

function escapeCsvCell(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buildRunInstancesCsv(instances: TestInstance[]) {
  const headers = [
    "test_id",
    "case_id",
    "title",
    "status",
    "assignee_id",
    "priority",
    "type",
    "case_changed"
  ];
  const lines = [headers.join(",")];
  for (const row of instances) {
    lines.push(
      [
        row.id.toString(),
        row.caseId.toString(),
        row.titleSnapshot,
        row.status,
        row.assignedTo?.toString() ?? "",
        row.prioritySnapshot ?? row.casePriority ?? "",
        row.typeSnapshot ?? row.caseType ?? "",
        row.caseChanged ? "true" : "false"
      ]
        .map((cell) => escapeCsvCell(String(cell ?? "")))
        .join(",")
    );
  }
  return lines.join("\n");
}
