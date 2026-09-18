import { useMemo, useState } from "react";

import type { ProjectMemberRow } from "../../projects/api/settingsApi";
import { downloadRunResultsCsv, downloadRunTestsCsv } from "../../projects/api/importExportApi";
import { useDefectDropdownItems } from "../../projects/content-header/DefectsDropdown";
import { Button, EntityCopyActions, OverflowMenu, type OverflowMenuGroup } from "../../../shared/ui";
import type { RunDetailDto } from "../types";
import { runExecutionHeaderMenuGroups } from "../utils/runExecutionHeaderMenu";

type Props = {
  projectId: string;
  runId: string;
  suiteId?: string;
  run: RunDetailDto["run"];
  milestoneName?: string;
  members: ProjectMemberRow[];
  assigneeInput: string;
  onAssigneeInputChange: (value: string) => void;
  onAssignRun: () => void;
  isAssignPending: boolean;
  onOpenDuplicate: () => void;
  isDuplicatePending: boolean;
  onOpenCompare: () => void;
  onOpenRerun: () => void;
  isRerunPending: boolean;
  onOpenCloseRun: () => void;
  isCloseRunPending: boolean;
  onReopenRun: () => void;
  isReopenRunPending: boolean;
  onPushDefect?: () => void;
};

export function RunExecutionHeader({
  projectId,
  runId,
  suiteId,
  run,
  milestoneName,
  members,
  assigneeInput,
  onAssigneeInputChange,
  onAssignRun,
  isAssignPending,
  onOpenDuplicate,
  isDuplicatePending,
  onOpenCompare,
  onOpenRerun,
  isRerunPending,
  onOpenCloseRun,
  isCloseRunPending,
  onReopenRun,
  isReopenRunPending,
  onPushDefect
}: Props) {
  const [exportBusy, setExportBusy] = useState(false);
  const isOpen = run.status === "open";
  const defectItems = useDefectDropdownItems({ projectId, runId, onPushDefect });
  const meta = [
    run.environment,
    run.milestoneId ? milestoneName ?? `Milestone #${run.milestoneId}` : null,
    run.dueOn ? `Due ${new Date(run.dueOn).toLocaleDateString()}` : null
  ].filter(Boolean);
  const groups = useMemo<OverflowMenuGroup[]>(() => {
    const coreGroups = runExecutionHeaderMenuGroups(projectId, runId, suiteId).map((group) => ({
      ...group,
      items: [
        ...group.items.map((item) => {
          if (item.id === "duplicate") return { ...item, disabled: isDuplicatePending, onSelect: onOpenDuplicate };
          if (item.id === "compare") return { ...item, onSelect: onOpenCompare };
          if (item.id === "rerun") return { ...item, disabled: isRerunPending, onSelect: onOpenRerun };
          if (item.id === "export-tests") {
            return {
              ...item,
              disabled: exportBusy,
              onSelect: () => {
                setExportBusy(true);
                void downloadRunTestsCsv(projectId, runId).finally(() => setExportBusy(false));
              }
            };
          }
          if (item.id === "export-results") {
            return {
              ...item,
              disabled: exportBusy,
              onSelect: () => {
                setExportBusy(true);
                void downloadRunResultsCsv(projectId, runId).finally(() => setExportBusy(false));
              }
            };
          }
          return item;
        }),
        ...(group.id === "management"
          ? [
              isOpen
                ? {
                    id: "close-run",
                    label: "Close run",
                    description: "Stop recording new results",
                    tone: "danger" as const,
                    disabled: isCloseRunPending,
                    onSelect: onOpenCloseRun
                  }
                : {
                    id: "reopen-run",
                    label: "Reopen run",
                    description: "Allow result recording again",
                    disabled: isReopenRunPending,
                    onSelect: onReopenRun
                  }
            ]
          : [])
      ]
    }));
    const additionalDefectItems = defectItems
      .filter((item) => item.id !== "defect-summary")
      .map((item) => ({ ...item, id: `header-${item.id}` }));

    return additionalDefectItems.length > 0
      ? [...coreGroups, { id: "defects", label: "Defects", items: additionalDefectItems }]
      : coreGroups;
  }, [
    defectItems,
    exportBusy,
    isCloseRunPending,
    isDuplicatePending,
    isOpen,
    isReopenRunPending,
    isRerunPending,
    onOpenCloseRun,
    onOpenCompare,
    onOpenDuplicate,
    onOpenRerun,
    onReopenRun,
    projectId,
    runId,
    suiteId
  ]);

  return (
    <header className="border-b border-slate-300 bg-white" aria-label="Run execution workbench">
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 sm:px-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-base font-semibold text-slate-950 sm:text-lg">{run.name}</h1>
            <span
              className={
                isOpen
                  ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase text-emerald-800"
                  : "rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-700"
              }
            >
              {run.status}
            </span>
          </div>
          {meta.length > 0 ? <p className="mt-0.5 truncate text-xs text-slate-500">{meta.join(" · ")}</p> : null}
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
          <label className="sr-only" htmlFor="run-header-assignee">Run assignee</label>
          <select
            id="run-header-assignee"
            className="max-w-40 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 disabled:opacity-50"
            value={assigneeInput}
            disabled={!isOpen || isAssignPending}
            onChange={(event) => onAssigneeInputChange(event.target.value)}
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.userId}>
                {member.name ?? member.email}
              </option>
            ))}
          </select>
          <Button variant="secondary" size="sm" disabled={!isOpen || isAssignPending} onClick={onAssignRun}>
            {isAssignPending ? "Assigning…" : "Assign"}
          </Button>
          <EntityCopyActions projectId={projectId} kind="run" entityId={runId} compact />
          <OverflowMenu label="Run utilities" groups={groups} />
        </div>
      </div>
    </header>
  );
}
