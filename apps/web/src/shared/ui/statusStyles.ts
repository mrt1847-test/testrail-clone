/** Shared TestRail-style result status colors (badge, chips, table cells). */
export function statusBadgeClassName(status: string): string {
  switch (status) {
    case "passed":
      return "bg-emerald-50 text-emerald-900 ring-emerald-100";
    case "failed":
      return "bg-red-50 text-red-900 ring-red-100";
    case "blocked":
      return "bg-amber-50 text-amber-900 ring-amber-100";
    case "retest":
      return "bg-violet-50 text-violet-900 ring-violet-100";
    case "untested":
    default:
      return "bg-slate-100 text-slate-700 ring-slate-200";
  }
}

export function formatStatusLabel(status: string): string {
  if (!status) return status;
  return status.charAt(0).toUpperCase() + status.slice(1);
}
