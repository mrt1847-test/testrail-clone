type Props = {
  open: boolean;
  defaultName: string;
  name: string;
  onNameChange: (value: string) => void;
  copyAssignee: boolean;
  onCopyAssigneeChange: (value: boolean) => void;
  copySchedule: boolean;
  onCopyScheduleChange: (value: boolean) => void;
  copyEnvironment: boolean;
  onCopyEnvironmentChange: (value: boolean) => void;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DuplicateRunDialog({
  open,
  defaultName,
  name,
  onNameChange,
  copyAssignee,
  onCopyAssigneeChange,
  copySchedule,
  onCopyScheduleChange,
  copyEnvironment,
  onCopyEnvironmentChange,
  isPending,
  onCancel,
  onConfirm
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-run-title"
    >
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
        <h2 id="duplicate-run-title" className="text-base font-semibold text-slate-900">
          Duplicate run
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Create a new regression run with the same test composition as this run. Results are not copied.
        </p>
        <label className="mt-4 block text-sm">
          <span className="font-medium text-slate-700">Run name</span>
          <input
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={name}
            placeholder={defaultName}
            onChange={(e) => onNameChange(e.target.value)}
          />
        </label>
        <div className="mt-3 space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={copyAssignee}
              onChange={(e) => onCopyAssigneeChange(e.target.checked)}
            />
            Copy run assignee
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={copySchedule}
              onChange={(e) => onCopyScheduleChange(e.target.checked)}
            />
            Copy start and due dates
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={copyEnvironment}
              onChange={(e) => onCopyEnvironmentChange(e.target.checked)}
            />
            Copy environment
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm"
            disabled={isPending}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? "Creating?? : "Duplicate run"}
          </button>
        </div>
      </div>
    </div>
  );
}

