import { useEffect, useState } from "react";

import { Button, FormField, SaveFeedback, type SaveFeedbackStatus } from "../../../../shared/ui";
import { Drawer } from "../../../../shared/ui/Drawer";

type Props = {
  open: boolean;
  saving?: boolean;
  saveStatus?: SaveFeedbackStatus;
  saveError?: string;
  onCancel: () => void;
  onSubmit: (name: string) => void;
};

const inputClass = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";

export function ReportSaveViewDialog({
  open,
  saving = false,
  saveStatus = "idle",
  saveError,
  onCancel,
  onSubmit
}: Props) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
  }, [open]);

  return (
    <Drawer
      open={open}
      onClose={onCancel}
      title="Save view"
      subtitle="Keep the current filters as a named report."
      widthClassName="max-w-md"
      footer={
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          <SaveFeedback
            className="mr-auto"
            status={saveStatus === "idle" && saving ? "saving" : saveStatus}
            message={saveStatus === "failed" ? saveError ?? "Could not save view." : undefined}
            onRetry={
              saveStatus === "failed" && name.trim()
                ? () => onSubmit(name.trim())
                : undefined
            }
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
            Save view
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
            placeholder="e.g. Open failed runs"
            onChange={(event) => setName(event.target.value)}
          />
        )}
      </FormField>
    </Drawer>
  );
}
