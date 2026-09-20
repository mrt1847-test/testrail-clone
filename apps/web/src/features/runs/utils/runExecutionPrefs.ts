const QPANE_WIDTH_KEY = "qa-rail.run-qpane-width";

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
