export function normalizeCaseLabels(input: string[] | null | undefined): string[] {
  if (!input?.length) return [];
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const raw of input) {
    const label = raw.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels;
}

export function parseCaseLabelsCsv(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return normalizeCaseLabels(value.split(/[,;\n]+/));
}
