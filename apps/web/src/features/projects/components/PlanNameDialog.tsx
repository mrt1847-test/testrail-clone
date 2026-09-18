import { useEffect, useState } from "react";

import { Button, FormField, SaveFeedback, type SaveFeedbackStatus } from "../../../shared/ui";
import { Drawer } from "../../../shared/ui/Drawer";

type PlanNameDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  initialName?: string;
  saving?: boolean;
  saveStatus?: SaveFeedbackStatus;
  saveError?: string;
  onCancel: () => void;
  onSubmit: (name: string) => void;
};

const inputClass = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";

export function PlanNameDialog({
  open,
  mode,
  initialName = "",
  saving = false,
  saveStatus = "idle",
  saveError,
  onCancel,
  onSubmit
}: PlanNameDialogProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(mode === "edit" ? initialName : "");
  }, [initialName, mode, open]);

  const title = mode === "create" ? "Add Plan" : "Rename plan";
  const confirm = mode === "create" ? "Add plan" : "Save changes";

  return (
    <Drawer
      open={open}
      onClose={onCancel}
      title={title}
      widthClassName="max-w-md"
      footer={
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          <SaveFeedback
            className="mr-auto"
            status={saveStatus === "idle" && saving ? "saving" : saveStatus}
            message={saveStatus === "failed" ? saveError ?? "Could not save plan." : undefined}
          />
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving || !name.trim()}
            loading={saving}
            onClick={() => onSubmit(name.trim())}
          >
            {confirm}
          </Button>
        </div>
      }
    >
      <FormField label="Name" required>
        {(control) => (
          <input
            {...control}
            className={inputClass}
            value={name}
            placeholder="e.g. Release 1.2 matrix"
            onChange={(event) => setName(event.target.value)}
          />
        )}
      </FormField>
    </Drawer>
  );
}
