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

export function nextUnwrappedVisibleTestId(currentId: string | null, instances: Array<{ id: string }>): string | null {
  if (instances.length === 0) return null;
  const index = currentId ? instances.findIndex((row) => row.id === currentId) : -1;
  if (index < 0) return instances[0]?.id ?? null;
  return instances[index + 1]?.id ?? null;
}

/** Pending write for an explicit list return (Back to tests). Not a real test id. */
export const CLEAR_SELECTED_TEST_PENDING = "";

export function resolveSelectedRunTest(
  urlTestId: string | null,
  instances: TestInstanceRow[],
  options?: { seedWhenMissing?: boolean }
): { selected: TestInstanceRow | null; seedUrlTestId: string | null } {
  if (urlTestId) {
    const matched = instances.find((row) => row.id === urlTestId) ?? null;
    if (matched) return { selected: matched, seedUrlTestId: null };
  }
  // Mobile stacked list/detail: missing testId means show the list. Desktop keeps auto-seed.
  if (options?.seedWhenMissing === false) {
    return { selected: null, seedUrlTestId: null };
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
  seedWhenMissing?: boolean;
}): { selected: TestInstanceRow | null; seedUrlTestId: string | null } {
  const pendingTestId = input.pendingTestId ?? null;
  // Explicit Back to tests: do not re-apply a stale URL testId or auto-seed while URL catches up.
  if (pendingTestId === CLEAR_SELECTED_TEST_PENDING) {
    return { selected: null, seedUrlTestId: null };
  }
  if (pendingTestId && pendingTestId !== input.urlTestId) {
    const pendingRow =
      input.instances.find((row) => row.id === pendingTestId) ??
      (input.current?.id === pendingTestId ? input.current : null);
    if (pendingRow) return { selected: pendingRow, seedUrlTestId: null };
  }
  return resolveSelectedRunTest(input.urlTestId, input.instances, {
    seedWhenMissing: input.seedWhenMissing
  });
}
