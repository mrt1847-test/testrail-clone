export type AuthoringSaveRefreshDecision = "hold" | "refresh" | "ignore-stale";

/**
 * Body success must not refresh or reset the authoring view until steps also finish.
 * A late response from an older save must not replace a newer draft.
 */
export function decideAuthoringSaveRefresh(input: {
  bodyComplete: boolean;
  stepsComplete: boolean;
  saveGeneration: number;
  incomingGeneration: number;
}): AuthoringSaveRefreshDecision {
  if (input.incomingGeneration !== input.saveGeneration) return "ignore-stale";
  if (input.bodyComplete && input.stepsComplete) return "refresh";
  return "hold";
}

export function shouldKeepAuthoringSaveBusy(input: { bodyComplete: boolean; stepsComplete: boolean }): boolean {
  return decideAuthoringSaveRefresh({
    ...input,
    saveGeneration: 1,
    incomingGeneration: 1
  }) === "hold";
}

export function authoringStepsComplete(stepsWarning: string | null | undefined): boolean {
  return !stepsWarning;
}
