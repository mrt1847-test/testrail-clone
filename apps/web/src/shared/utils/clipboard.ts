/** Copy plain text; returns false when clipboard is unavailable or write fails. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text.trim() || !navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
