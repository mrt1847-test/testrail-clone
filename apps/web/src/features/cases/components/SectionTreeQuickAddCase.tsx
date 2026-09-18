import { useEffect, useId, useRef, type FormEvent } from "react";

type QuickAddFeedback = {
  tone: "success" | "error";
  message: string;
} | null;

type Props = {
  depth: number;
  sectionName: string;
  title: string;
  onTitleChange: (value: string) => void;
  feedback: QuickAddFeedback;
  isPending: boolean;
  focusRequest: number;
  onSubmit: () => void;
};

export function SectionTreeQuickAddCase({
  depth,
  sectionName,
  title,
  onTitleChange,
  feedback,
  isPending,
  focusRequest,
  onSubmit,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const statusId = useId();

  useEffect(() => {
    if (!isPending) inputRef.current?.focus();
  }, [focusRequest]);

  useEffect(() => {
    if (!isPending && feedback) inputRef.current?.focus();
  }, [feedback, isPending]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form
      className="mt-1.5 grid gap-1.5 rounded-xl border border-sky-200 bg-sky-50/70 p-2"
      style={{ marginLeft: `${depth * 16 + 12}px` }}
      onSubmit={handleSubmit}
      aria-busy={isPending}
    >
      <label className="text-[11px] font-semibold uppercase tracking-wide text-sky-800" htmlFor={`${statusId}-title`}>
        Quick add to {sectionName}
      </label>
      <div className="flex min-w-0 items-center gap-1.5">
        <input
          ref={inputRef}
          id={`${statusId}-title`}
          type="text"
          value={title}
          disabled={isPending}
          aria-describedby={statusId}
          placeholder="Case title — press Enter"
          className="min-w-0 flex-1 rounded-lg border border-sky-300 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-400 disabled:cursor-wait disabled:bg-slate-100"
          onChange={(event) => onTitleChange(event.target.value)}
        />
        <button
          type="submit"
          disabled={isPending || title.trim().length === 0}
          className="shrink-0 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Add"}
        </button>
      </div>
      <div
        id={statusId}
        role={feedback?.tone === "error" ? "alert" : "status"}
        aria-live="polite"
        className={`flex min-h-4 items-center justify-between gap-2 text-[11px] ${
          feedback?.tone === "error"
            ? "text-red-700"
            : feedback?.tone === "success"
              ? "text-emerald-700"
              : "text-slate-500"
        }`}
      >
        <span>
          {isPending
            ? "Saving case…"
            : feedback?.message ?? "Enter adds a title-only case and keeps you here."}
        </span>
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
