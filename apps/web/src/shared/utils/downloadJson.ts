export function downloadJsonFile(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function fetchJsonExport(path: string) {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Export failed (${res.status})`);
  }
  return res.json() as Promise<unknown>;
}
