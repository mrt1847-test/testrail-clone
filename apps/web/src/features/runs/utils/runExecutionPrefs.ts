const JUMP_TO_NEXT_KEY = "qa-rail.jump-to-next";
const QPANE_WIDTH_KEY = "qa-rail.run-qpane-width";

export function readJumpToNextAfterResult(): boolean {
  try {
    const value = localStorage.getItem(JUMP_TO_NEXT_KEY);
    if (value === "false") return false;
  } catch {
    /* ignore */
  }
  return true;
}

export function writeJumpToNextAfterResult(enabled: boolean) {
  try {
    localStorage.setItem(JUMP_TO_NEXT_KEY, enabled ? "true" : "false");
  } catch {
    /* ignore */
  }
}

export function readQpaneWidth(): number {
  try {
    const raw = localStorage.getItem(QPANE_WIDTH_KEY);
    const n = raw ? Number(raw) : NaN;
    if (Number.isFinite(n) && n >= 280 && n <= 720) return n;
  } catch {
    /* ignore */
  }
  return 420;
}

export function writeQpaneWidth(px: number) {
  try {
    localStorage.setItem(QPANE_WIDTH_KEY, String(Math.round(px)));
  } catch {
    /* ignore */
  }
}
