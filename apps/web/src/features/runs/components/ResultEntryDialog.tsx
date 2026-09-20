import { useRef, useState } from "react";

import { Button, OverflowMenu, SaveFeedback } from "../../../shared/ui";
import { Dialog } from "../../../shared/ui/Dialog";
import {
  ResultEntryPanel,
  type ResultEntryPanelHandle,
  type ResultEntryPanelProps,
  type ResultSubmitOptions
} from "./ResultEntryPanel";
import { formatResultDialogTitle } from "../utils/resultEntryDialogModel";
import {
  resolveResultDialogClosePrompt,
  shouldDiscardResultRecovery,
  type ResultDialogCloseDecision
} from "../utils/resultPartialRecoveryModel";
import type { ResultStatus, ResultSubmitPayload } from "./resultEntryTypes";

export type ResultDialogTarget = {
  id: string;
  caseId?: string;
  caseCode: string;
  title: string;
  assignedTo?: string | null;
};

type ResultEntryDialogProps = {
  open: boolean;
  projectId: string;
  target: ResultDialogTarget | null;
  initialStatus?: ResultStatus | null;
  caseSteps?: ResultEntryPanelProps["caseSteps"];
  caseScenarios?: ResultEntryPanelProps["caseScenarios"];
  isCaseStepsLoading?: boolean;
  isSubmitting: boolean;
  disableUntested?: boolean;
  hasResultHistory?: boolean;
  aiEvaluation?: ResultEntryPanelProps["aiEvaluation"];
  saveFeedback?: ResultEntryPanelProps["saveFeedback"];
  attachmentUploadById?: ResultEntryPanelProps["attachmentUploadById"];
  initialStagedAttachments?: ResultEntryPanelProps["initialStagedAttachments"];
  recoveryDraft?: ResultEntryPanelProps["recoveryDraft"];
  recoveryResultId?: string | null;
  assigneeMembers?: ResultEntryPanelProps["assigneeMembers"];
  currentUser?: ResultEntryPanelProps["currentUser"];
  onSubmit: (payload: ResultSubmitPayload, options?: ResultSubmitOptions) => void | Promise<void>;
  /** Close the dialog. Pass discard:true only for explicit unfinished-work discard. */
  onClose: (options?: { discard?: boolean }) => void;
  onRetrySave?: () => void;
  onUndoSave?: () => void;
  onRetryStagedAttachment?: (id: string) => void;
  onDiscardStagedAttachment?: (id: string) => void;
};

export function ResultEntryDialog({
  open,
  projectId,
  target,
  initialStatus = null,
  caseSteps,
  caseScenarios,
  isCaseStepsLoading,
  isSubmitting,
  disableUntested,
  hasResultHistory,
  aiEvaluation,
  saveFeedback,
  attachmentUploadById,
  initialStagedAttachments,
  recoveryDraft,
  recoveryResultId,
  assigneeMembers,
  currentUser,
  onSubmit,
  onClose,
  onRetrySave,
  onUndoSave,
  onRetryStagedAttachment,
  onDiscardStagedAttachment
}: ResultEntryDialogProps) {
  const panelRef = useRef<ResultEntryPanelHandle>(null);
  const firstFieldRef = useRef<HTMLElement | null>(null);
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  if (!target) return null;

  const title = formatResultDialogTitle(target.caseCode, target.title);
  const saving = isSubmitting || saveFeedback?.status === "saving";
  const partialSuccess = Boolean(recoveryResultId && saveFeedback?.status === "failed");
  const closePrompt = resolveResultDialogClosePrompt({ saving, dirty, partialSuccess });

  function requestClose() {
    if (saving) return;
    if (confirmDiscard) {
      setConfirmDiscard(false);
      return;
    }
    if (closePrompt === "none") {
      onClose({ discard: false });
      return;
    }
    setConfirmDiscard(true);
  }

  function finishClose(decision: ResultDialogCloseDecision) {
    if (decision === "keep-editing") {
      setConfirmDiscard(false);
      return;
    }
    setConfirmDiscard(false);
    setDirty(false);
    onClose({ discard: shouldDiscardResultRecovery(decision) });
  }

  async function submit(advance: boolean) {
    if (saving) return;
    setConfirmDiscard(false);
    await panelRef.current?.submit(advance);
  }

  return (
    <Dialog
      open={open}
      title={title}
      titleId="result-entry-dialog-title"
      onClose={requestClose}
      disableClose={saving}
      initialFocusRef={firstFieldRef}
      footer={
        confirmDiscard ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              {closePrompt === "partial-success-leave"
                ? "Result is saved. Leave to keep Retry for unfinished attachments, or discard them."
                : "Discard this draft? The test is unchanged."}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => finishClose("keep-editing")}>
                Keep editing
              </Button>
              {closePrompt === "partial-success-leave" ? (
                <Button type="button" variant="secondary" onClick={() => finishClose("leave-with-recovery")}>
                  Leave
                </Button>
              ) : null}
              <Button type="button" variant="danger" onClick={() => finishClose("discard")}>
                {closePrompt === "partial-success-leave" ? "Discard unfinished" : "Discard draft"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {saveFeedback && saveFeedback.status !== "idle" ? (
              <SaveFeedback
                status={saveFeedback.status}
                message={saveFeedback.message}
                onRetry={saveFeedback.status === "failed" ? onRetrySave : undefined}
                onUndo={saveFeedback.status === "saved" && saveFeedback.canUndo ? onUndoSave : undefined}
              />
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-stretch">
                <Button
                  type="button"
                  disabled={saving}
                  className="rounded-r-none"
                  onClick={() => void submit(false)}
                >
                  {saving ? "Saving..." : "Add Result"}
                </Button>
                <OverflowMenu
                  label="More save actions"
                  iconOnly
                  compact
                  disabled={saving}
                  menuMark="chevron"
                  align="left"
                  triggerClassName="rounded-l-none border-l-0 px-2"
                  groups={[
                    {
                      id: "save",
                      label: "Save options",
                      items: [
                        {
                          id: "save-and-next",
                          label: "Save & Next",
                          onSelect: () => void submit(true)
                        }
                      ]
                    }
                  ]}
                />
              </div>
              <Button type="button" variant="link" disabled={saving} onClick={requestClose}>
                Cancel
              </Button>
            </div>
          </div>
        )
      }
    >
      <ResultEntryPanel
        ref={panelRef}
        variant="dialog"
        hideFooter
        firstFieldRef={firstFieldRef}
        projectId={projectId}
        instance={target}
        initialStatus={initialStatus}
        initialAssignedTo={target.assignedTo ?? null}
        assigneeMembers={assigneeMembers}
        currentUser={currentUser}
        caseSteps={caseSteps}
        caseScenarios={caseScenarios}
        isCaseStepsLoading={isCaseStepsLoading}
        isSubmitting={isSubmitting}
        disableUntested={disableUntested}
        hasResultHistory={hasResultHistory}
        aiEvaluation={aiEvaluation}
        showInstanceHeader={false}
        saveFeedback={saveFeedback}
        attachmentUploadById={attachmentUploadById}
        initialStagedAttachments={initialStagedAttachments}
        recoveryDraft={recoveryDraft}
        recoveryResultId={recoveryResultId}
        onDirtyChange={setDirty}
        onRetrySave={onRetrySave}
        onUndoSave={onUndoSave}
        onRetryStagedAttachment={onRetryStagedAttachment}
        onDiscardStagedAttachment={onDiscardStagedAttachment}
        onCancel={requestClose}
        onSubmit={onSubmit}
      />
    </Dialog>
  );
}
