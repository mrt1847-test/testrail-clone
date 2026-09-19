import { Button, OverflowMenu, SelectionActionBar, type OverflowMenuGroup } from "../../../shared/ui";
import type { BulkCaseFeedback } from "../utils/bulkCaseFeedback";
import { buildCaseSelectionActionBarModel } from "../utils/caseSelectionActionBarModel";
import { BulkCaseResultBanner } from "./BulkCaseResultBanner";

type Props = {
  selectedCount: number;
  loadedCount: number;
  allLoadedSelected: boolean;
  archiveMode: "archive" | "restore";
  printHref: string;
  canCopyMove: boolean;
  readOnly?: boolean;
  editBusy?: boolean;
  copyMoveBusy?: boolean;
  archiveBusy?: boolean;
  deleteBusy?: boolean;
  bulkFeedback?: BulkCaseFeedback | null;
  onEdit: () => void;
  onClearSelection: () => void;
  onSelectAllLoaded: () => void;
  onCopyMove: () => void;
  onArchive: () => void;
  onDeletePermanent: () => void;
  onDismissFeedback: () => void;
};

export function CaseSelectionActionBar({
  selectedCount,
  loadedCount,
  allLoadedSelected,
  archiveMode,
  printHref,
  canCopyMove,
  readOnly = false,
  editBusy = false,
  copyMoveBusy = false,
  archiveBusy = false,
  deleteBusy = false,
  bulkFeedback = null,
  onEdit,
  onClearSelection,
  onSelectAllLoaded,
  onCopyMove,
  onArchive,
  onDeletePermanent,
  onDismissFeedback
}: Props) {
  const model = buildCaseSelectionActionBarModel({
    selectedCount,
    loadedCount,
    allLoadedSelected,
    archiveMode
  });

  const feedback = bulkFeedback ? (
    <BulkCaseResultBanner feedback={bulkFeedback} onDismiss={onDismissFeedback} />
  ) : null;

  if (!model) {
    return feedback ? <div className="border-b border-slate-200 px-3 py-2">{feedback}</div> : null;
  }

  const groups: OverflowMenuGroup[] = [
    {
      id: "selection",
      label: "Selected cases",
      items: model.overflowItems.map((item) => {
        if (item.id === "print") {
          return {
            id: item.id,
            label: item.label,
            href: printHref,
            external: true
          };
        }
        return {
          id: item.id,
          label: item.label,
          description: item.description,
          tone: item.tone,
          disabled:
            (item.id === "copy-move" && (!canCopyMove || copyMoveBusy)) ||
            ((item.id === "archive" || item.id === "restore") && archiveBusy) ||
            (item.id === "delete-permanent" && deleteBusy),
          onSelect: () => {
            if (item.id === "select-all-loaded") onSelectAllLoaded();
            if (item.id === "copy-move") onCopyMove();
            if (item.id === "archive" || item.id === "restore") onArchive();
            if (item.id === "delete-permanent") onDeletePermanent();
          }
        };
      })
    }
  ];

  return (
    <>
      <SelectionActionBar selectedCount={selectedCount} aria-label="Selected case actions">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="mr-1 whitespace-nowrap text-sm text-sky-950">{model.selectedLabel}</strong>
          <Button size="sm" disabled={readOnly} loading={editBusy} onClick={onEdit}>
            Edit
          </Button>
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={onClearSelection}>
              Clear selection
            </Button>
            <OverflowMenu label="Selection actions" size="sm" groups={groups} />
          </div>
        </div>
      </SelectionActionBar>
      {feedback ? <div className="border-b border-sky-200 bg-sky-50/95 px-3 pb-2">{feedback}</div> : null}
    </>
  );
}
