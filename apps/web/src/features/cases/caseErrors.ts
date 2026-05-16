export function extractApiErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  try {
    const parsed = JSON.parse(error.message) as
      | { message?: string; error?: { message?: string } }
      | undefined;
    return parsed?.error?.message ?? parsed?.message ?? error.message;
  } catch {
    return error.message || fallback;
  }
}

function extractApiErrorCode(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  try {
    const parsed = JSON.parse(error.message) as
      | { code?: string; error?: { code?: string } }
      | undefined;
    return parsed?.error?.code ?? parsed?.code ?? null;
  } catch {
    return null;
  }
}

export function restoreVersionErrorMessage(error: unknown) {
  if (extractApiErrorCode(error) === "CONFLICT") {
    return "This case changed after you opened it. Refresh the case, review the latest version, then restore again.";
  }
  return extractApiErrorMessage(error, "Could not restore the selected version.");
}
