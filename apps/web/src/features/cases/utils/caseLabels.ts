export function parseCaseLabels(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  const tokens = value.split(/[,;\n]+/).map((part) => part.trim()).filter(Boolean);
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const token of tokens) {
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(token);
  }
  return labels;
}

export function joinCaseLabels(labels: string[]) {
  return labels.join(", ");
}
