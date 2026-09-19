export type CaseSelectionOverflowActionId =
  | "select-all-loaded"
  | "print"
  | "copy-move"
  | "archive"
  | "restore"
  | "delete-permanent";

export type CaseSelectionActionBarModel = {
  selectedLabel: string;
  overflowItems: Array<{
    id: CaseSelectionOverflowActionId;
    label: string;
    description?: string;
    tone?: "danger";
  }>;
};

type Input = {
  selectedCount: number;
  loadedCount: number;
  allLoadedSelected: boolean;
  archiveMode: "archive" | "restore";
};

export function buildCaseSelectionActionBarModel(input: Input): CaseSelectionActionBarModel | null {
  if (input.selectedCount < 1) return null;

  const overflowItems: CaseSelectionActionBarModel["overflowItems"] = [];

  if (!input.allLoadedSelected && input.loadedCount > input.selectedCount) {
    overflowItems.push({
      id: "select-all-loaded",
      label: `Select all ${input.loadedCount} loaded cases`,
      description: "Only cases currently in this list"
    });
  }

  overflowItems.push(
    { id: "print", label: "Print selected" },
    { id: "copy-move", label: "Copy or move" }
  );

  if (input.archiveMode === "restore") {
    overflowItems.push(
      { id: "restore", label: "Undelete selected" },
      { id: "delete-permanent", label: "Delete permanently", tone: "danger" }
    );
  } else {
    overflowItems.push({ id: "archive", label: "Mark as deleted", tone: "danger" });
  }

  return {
    selectedLabel: `${input.selectedCount} selected`,
    overflowItems
  };
}
