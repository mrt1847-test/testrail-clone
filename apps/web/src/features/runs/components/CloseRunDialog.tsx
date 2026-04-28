import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";

type CloseRunDialogProps = {
  open: boolean;
  runName: string;
  untestedCount: number;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
};

export function CloseRunDialog({ open, runName, untestedCount, isPending, onCancel, onConfirm }: CloseRunDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title="Close this run?"
      description={
        <div className="space-y-2">
          <p>
            Run: <span className="font-medium text-slate-800">{runName}</span>
          </p>
          <p className="text-slate-600">
            닫은 런은 이 화면에서 새 결과를 추가할 수 없습니다. 이미 저장된 결과와 이력은 그대로 조회됩니다.
          </p>
          {untestedCount > 0 ? (
            <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
              경고: 아직 미실행 테스트가 {untestedCount}개 있습니다.
            </p>
          ) : null}
        </div>
      }
      confirmLabel={isPending ? "Closing…" : "Close run"}
      cancelLabel="Cancel"
      confirmDisabled={isPending}
      onCancel={onCancel}
      onConfirm={() => void onConfirm()}
      variant="default"
    />
  );
}
