import type { OverflowMenuGroup } from "../../../shared/ui";
import type { UiDensity } from "../../../shared/ui/density/uiDensity";
import { CASE_GROUP_BY_OPTIONS, type CaseGroupBy } from "./caseRepositoryGrouping";

export const CASE_ROW_SPACING_OPTIONS: Array<{ id: UiDensity; label: string }> = [
  { id: "compact", label: "Compact rows" },
  { id: "comfortable", label: "Comfortable rows" }
];

type BuildCaseRepositoryViewMenuInput = {
  groupByValue: CaseGroupBy;
  density: UiDensity;
  showDeleted: boolean;
  visibleColumnCount: number;
  onGroupByChange: (value: CaseGroupBy) => void;
  onDensityChange: (value: UiDensity) => void;
  onOpenColumnsAndViews: () => void;
  onToggleArchived: () => void;
  onExpandAllGroups?: () => void;
  onCollapseAllGroups?: () => void;
};

export function buildCaseRepositoryViewMenu(input: BuildCaseRepositoryViewMenuInput): OverflowMenuGroup[] {
  const groups: OverflowMenuGroup[] = [
    {
      id: "group",
      label: "Group cases",
      items: CASE_GROUP_BY_OPTIONS.map((option) => ({
        id: `group-${option.id}`,
        label: option.label,
        selected: input.groupByValue === option.id,
        onSelect: () => input.onGroupByChange(option.id)
      }))
    },
    {
      id: "density",
      label: "Row spacing",
      items: CASE_ROW_SPACING_OPTIONS.map((option) => ({
        id: `density-${option.id}`,
        label: option.label,
        selected: input.density === option.id,
        onSelect: () => input.onDensityChange(option.id)
      }))
    }
  ];

  if (input.groupByValue !== "none" && input.onExpandAllGroups && input.onCollapseAllGroups) {
    groups.push({
      id: "section-blocks",
      label: "Section blocks",
      items: [
        { id: "expand-all-blocks", label: "Expand all", onSelect: input.onExpandAllGroups },
        { id: "collapse-all-blocks", label: "Collapse all", onSelect: input.onCollapseAllGroups }
      ]
    });
  }

  groups.push({
    id: "settings",
    label: "More",
    items: [
      {
        id: "columns",
        label: "Columns and saved views",
        description: `${input.visibleColumnCount} metadata column${input.visibleColumnCount === 1 ? "" : "s"} visible`,
        onSelect: input.onOpenColumnsAndViews
      },
      {
        id: "archived",
        label: "Archived cases",
        description: input.showDeleted ? "Showing archived cases" : "Show cases marked as deleted",
        selected: input.showDeleted,
        onSelect: input.onToggleArchived
      }
    ]
  });

  return groups;
}
