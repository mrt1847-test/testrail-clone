export function parseCaseRefs(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  const tokens = value.split(/[,;\n]+/).map((part) => part.trim()).filter(Boolean);
  return [...new Set(tokens)];
}
