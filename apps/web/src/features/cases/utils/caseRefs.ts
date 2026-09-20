export function parseCaseRefs(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  const tokens = value.split(/[,;\n]+/).map((part) => part.trim()).filter(Boolean);
  return [...new Set(tokens)];
}

/** Include still-typed reference text so Save does not drop a visible ID. */
export function mergeCaseRefs(committed: string, draftInput: string): string {
  const merged = [...parseCaseRefs(committed), ...parseCaseRefs(draftInput)];
  return [...new Set(merged)].join(", ");
}
