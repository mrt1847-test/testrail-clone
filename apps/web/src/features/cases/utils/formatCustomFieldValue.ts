export function formatCustomFieldDisplayValue(value: unknown): string {
  if (value == null || value === "") return "";
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean).join(", ");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
