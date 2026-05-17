export function parseCaseIdList(value: string) {
  return value
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function formatCaseIdList(ids: string[]) {
  return ids.join(", ");
}
