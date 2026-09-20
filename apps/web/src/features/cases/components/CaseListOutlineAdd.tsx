import { useEffect, useId, useRef, type FormEvent } from "react";

type OutlineFeedback = {
  tone: "success" | "error";
  message: string;
} | null;

type Props = {
  sectionId: number;
  sectionName: string;
  title: string;
  onTitleChange: (value: string) => void;
  feedback: OutlineFeedback;
  isPending: boolean;
  focusRequest: number;
  onSubmit: () => void;
  onCancel?: () => void;
};

export function CaseListOutlineAdd({
  sectionId,
  sectionName,
  title,
  onTitleChange,
  feedback,
  isPending,
  focusRequest,
  onSubmit,
  onCancel
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const statusId = useId();

  useEffect(() => {
    if (!isPending) inputRef.current?.focus();
  }, [focusRequest, isPending]);

  useEffect(() => {
    if (!isPending && feedback) inputRef.current?.focus();
  }, [feedback, isPending]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form
      id={`case-outline-${sectionId}`}
      className="border-t border-slate-200 bg-white px-3 py-2"
      onSubmit={handleSubmit}
      aria-busy={isPending}
    >
      <label className="sr-only" htmlFor={`${statusId}-title`}>
        Add case to {sectionName}
      </label>
      <div className="flex min-w-0 items-center gap-2">
        <input
          ref={inputRef}
          id={`${statusId}-title`}
          type="text"
          value={title}
          disabled={isPending}
          aria-describedby={statusId}
          placeholder="Case title — press Enter"
          className="min-w-0 flex-1 rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:cursor-wait disabled:bg-slate-100"
          onChange={(event) => onTitleChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onCancel?.();
            }
          }}
        />
        <button
          type="submit"
          disabled={isPending || title.trim().length === 0}
          className="shrink-0 rounded bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? "Saving…" : "Add"}
        </button>
      </div>
      <div
        id={statusId}
        role={feedback?.tone === "error" ? "alert" : "status"}
        aria-live="polite"
        className={`mt-1 flex items-center justify-between gap-2 text-[11px] ${
          feedback?.tone === "error"
            ? "text-red-700"
            : feedback?.tone === "success"
              ? "text-emerald-700"
              : "text-slate-500"
        }`}
      >
        <span>{isPending ? "Saving case…" : feedback?.message ?? "Title-only case. Edit later to add steps."}</span>
        {feedback?.tone === "error" && !isPending ? (
          <button
            type="submit"
            disabled={title.trim().length === 0}
            className="shrink-0 font-semibold text-red-800 underline underline-offset-2"
          >
            Retry
          </button>
        ) : null}
      </div>
    </form>
  );
}
