import { useEffect, useId, useRef, type FormEvent } from "react";

type QuickAddFeedback = {
  tone: "success" | "error";
  message: string;
} | null;

type Props = {
  sectionName: string;
  title: string;
  onTitleChange: (value: string) => void;
  feedback: QuickAddFeedback;
  isPending: boolean;
  focusRequest: number;
  onSubmit: () => void;
};

export function SectionTreeQuickAddCase({
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
      className="grid gap-1 py-1 pl-6 pr-1"
      onSubmit={handleSubmit}
      aria-busy={isPending}
    >
      <label className="sr-only" htmlFor={`${statusId}-title`}>
        Add case to {sectionName}
      </label>
      <div className="flex min-w-0 items-center gap-1">
        <span aria-hidden className="w-4 shrink-0 text-center text-slate-400">
          +
        </span>
        <input
          ref={inputRef}
          id={`${statusId}-title`}
          type="text"
          value={title}
          disabled={isPending}
          aria-describedby={statusId}
          placeholder={`Add case to ${sectionName}…`}
          className="min-w-0 flex-1 rounded px-2 py-1.5 text-xs text-slate-900 outline-none ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 disabled:cursor-wait disabled:bg-slate-100"
          onChange={(event) => onTitleChange(event.target.value)}
        />
        <button
          type="submit"
          disabled={isPending || title.trim().length === 0}
          className="shrink-0 rounded bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? "Saving…" : "Add"}
        </button>
      </div>
      <div
        id={statusId}
        role={feedback?.tone === "error" ? "alert" : "status"}
        aria-live="polite"
        className={`flex items-center justify-between gap-2 pl-5 text-[11px] ${
          feedback?.tone === "error"
            ? "text-red-700"
            : feedback?.tone === "success"
              ? "text-emerald-700"
              : "text-slate-500"
        }`}
      >
        <span>
          {isPending ? "Saving case…" : feedback?.message ?? ""}
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
