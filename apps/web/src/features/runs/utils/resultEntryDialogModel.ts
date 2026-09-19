export function formatResultDialogTitle(caseCode: string, title: string) {
  const code = caseCode.trim();
  const name = title.trim();
  if (code && name) return `Add result · ${code} ${name}`;
  if (code) return `Add result · ${code}`;
  return `Add result · ${name || "Untitled test"}`;
}

export function isResultComposerDirty(input: {
  statusChanged: boolean;
  comment: string;
  actualResult: string;
  stagedFileCount: number;
  elapsed: string;
  version: string;
  defects: readonly string[];
  customValues: Record<string, string>;
  stepResultsDirty?: boolean;
  scenarioResultsDirty?: boolean;
  aiActualOutput?: string;
  assignedToChanged?: boolean;
}) {
  return (
    input.statusChanged ||
    Boolean(input.comment.trim()) ||
    Boolean(input.actualResult.trim()) ||
    input.stagedFileCount > 0 ||
    Boolean(input.elapsed.trim()) ||
    Boolean(input.version.trim()) ||
    input.defects.length > 0 ||
    Object.values(input.customValues).some((value) => value.trim()) ||
    Boolean(input.stepResultsDirty) ||
    Boolean(input.scenarioResultsDirty) ||
    Boolean(input.aiActualOutput?.trim()) ||
    Boolean(input.assignedToChanged)
  );
}

export type ResultDialogFooterAction = {
  id: "add-result" | "save-and-next" | "cancel";
  kind: "primary" | "split" | "text";
  label: string;
};

export function resultDialogFooterActions(): ResultDialogFooterAction[] {
  return [
    { id: "add-result", kind: "primary", label: "Add Result" },
    { id: "save-and-next", kind: "split", label: "Save & Next" },
    { id: "cancel", kind: "text", label: "Cancel" }
  ];
}

export function shouldAssignAfterResult(input: {
  currentAssignedTo: string | null | undefined;
  draftAssignedTo: string | null | undefined;
}) {
  if (input.draftAssignedTo === undefined) return false;
  return (input.currentAssignedTo ?? null) !== input.draftAssignedTo;
}

export function resultAssigneeOptions(input: {
  members: Array<{ userId: string; name: string | null; email: string }>;
  currentUser?: { id: string; name: string | null; email: string } | null;
}): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [{ value: "", label: "Unassigned" }];
  const seen = new Set<string>();
  for (const member of input.members) {
    if (!member.userId || seen.has(member.userId)) continue;
    seen.add(member.userId);
    options.push({
      value: member.userId,
      label: member.name?.trim() || member.email || `User ${member.userId}`
    });
  }
  if (input.currentUser?.id && !seen.has(input.currentUser.id)) {
    options.push({
      value: input.currentUser.id,
      label: input.currentUser.name?.trim() || input.currentUser.email || "Me"
    });
  }
  return options;
}
