import type { ResultStatus } from "../components/resultEntryTypes";
import type { TestInstanceRow } from "../types";

export function isEvidenceRequiringStatus(status: ResultStatus): boolean {
  return status === "failed" || status === "blocked" || status === "retest";
}

export function nextVisibleTestId(currentId: string | null, instances: Array<{ id: string }>): string | null {
  if (instances.length === 0) return null;
  const index = currentId ? instances.findIndex((row) => row.id === currentId) : -1;
  if (index < 0) return instances[0]?.id ?? null;
  return instances[index + 1]?.id ?? instances[0]?.id ?? null;
}

export function resolveSelectedRunTest(
  urlTestId: string | null,
  instances: TestInstanceRow[]
): { selected: TestInstanceRow | null; seedUrlTestId: string | null } {
  if (urlTestId) {
    const matched = instances.find((row) => row.id === urlTestId) ?? null;
    if (matched) return { selected: matched, seedUrlTestId: null };
  }
  const first = instances[0] ?? null;
  return {
    selected: first,
    seedUrlTestId: first && first.id !== urlTestId ? first.id : null
  };
}

/** Keep an in-flight Pass & Next / row selection until the URL catches up. */
export function resolveVisibleSelectedRunTest(input: {
  urlTestId: string | null;
  instances: TestInstanceRow[];
  pendingTestId?: string | null;
  current?: TestInstanceRow | null;
}): { selected: TestInstanceRow | null; seedUrlTestId: string | null } {
  const pendingTestId = input.pendingTestId ?? null;
  if (pendingTestId && pendingTestId !== input.urlTestId) {
    const pendingRow =
      input.instances.find((row) => row.id === pendingTestId) ??
      (input.current?.id === pendingTestId ? input.current : null);
    if (pendingRow) return { selected: pendingRow, seedUrlTestId: null };
  }
  return resolveSelectedRunTest(input.urlTestId, input.instances);
}
