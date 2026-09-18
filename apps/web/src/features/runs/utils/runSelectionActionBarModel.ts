export type RunSelectionOverflowActionId =
  | "add-comment"
  | "hide-comment"
  | "select-all-matching"
  | "assign-to-me"
  | "clear-assignees";

export type RunSelectionActionBarModel = {
  selectedLabel: string;
  overflowItems: Array<{ id: RunSelectionOverflowActionId; label: string; description?: string }>;
};

type Input = {
  selectedCount: number;
  totalMatching: number;
  allFilteredSelected: boolean;
  commentVisible: boolean;
};

export function buildRunSelectionActionBarModel(input: Input): RunSelectionActionBarModel | null {
  if (input.selectedCount < 1) return null;

  const overflowItems: RunSelectionActionBarModel["overflowItems"] = [
    input.commentVisible
      ? { id: "hide-comment", label: "Hide comment" }
      : { id: "add-comment", label: "Add result comment", description: "Optional comment for all selected tests" }
  ];

  if (!input.allFilteredSelected && input.totalMatching > input.selectedCount) {
    overflowItems.push({
      id: "select-all-matching",
      label: `Select all ${input.totalMatching} matching tests`
    });
  }

  overflowItems.push(
    { id: "assign-to-me", label: "Assign selected to me" },
    { id: "clear-assignees", label: "Clear selected assignees" }
  );

  return {
    selectedLabel: `${input.selectedCount} selected`,
    overflowItems
  };
}
