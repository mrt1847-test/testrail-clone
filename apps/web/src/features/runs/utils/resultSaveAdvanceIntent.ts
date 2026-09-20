/** UI-056: ordinary Add Result stays; only explicit Save & Next may advance. */
export function resultSaveShouldAdvance(input: {
  action: "add-result" | "save-and-next";
  nextTestId: string | null;
}): boolean {
  if (input.action !== "save-and-next") return false;
  return Boolean(input.nextTestId);
}
