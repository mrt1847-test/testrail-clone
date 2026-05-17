import { assignmentAgingLabel, type AssignmentAgingLevel } from "@testrail-clone/shared";

const toneByLevel: Record<AssignmentAgingLevel, string> = {
  none: "",
  overdue: "bg-rose-50 text-rose-800 ring-rose-200",
  due_soon: "bg-amber-50 text-amber-900 ring-amber-200",
  stale: "bg-slate-100 text-slate-700 ring-slate-200"
};

export function assignmentRowAgingClass(level: AssignmentAgingLevel) {
  switch (level) {
    case "overdue":
      return "border-l-4 border-l-rose-500 bg-rose-50/40";
    case "due_soon":
      return "border-l-4 border-l-amber-400 bg-amber-50/30";
    case "stale":
      return "border-l-4 border-l-slate-400 bg-slate-50/60";
    default:
      return "";
  }
}

type AssignmentAgingBadgeProps = {
  level: AssignmentAgingLevel;
  className?: string;
};

export function AssignmentAgingBadge({ level, className = "" }: AssignmentAgingBadgeProps) {
  if (level === "none") return null;
  const label = assignmentAgingLabel(level);
  const tone = toneByLevel[level];
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tone} ${className}`.trim()}
    >
      {label}
    </span>
  );
}
