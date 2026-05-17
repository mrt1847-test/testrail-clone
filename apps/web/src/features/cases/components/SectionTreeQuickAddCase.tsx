import { useEffect, useRef, type FormEvent } from "react";

type Props = {
  depth: number;
  sectionName: string;
  title: string;
  onTitleChange: (value: string) => void;
  error: string | null;
  isPending: boolean;
  onSubmit: () => void;
  onCancel: () => void;
};

export function SectionTreeQuickAddCase({
  depth,
  sectionName,
  title,
  onTitleChange,
  error,
  isPending,
  onSubmit,
  onCancel
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form
      className="mt-1.5 flex flex-wrap items-center gap-1.5"
      style={{ marginLeft: `${depth * 16 + 44}px` }}
      onSubmit={handleSubmit}
    >
      <input
        ref={inputRef}
        type="text"
        value={title}
        disabled={isPending}
        placeholder={`Case title in ${sectionName}`}
        className="min-w-0 flex-1 rounded-lg border border-sky-300 bg-sky-50/50 px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-400"
        onChange={(event) => onTitleChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
      />
      <button
        type="submit"
        disabled={isPending || title.trim().length === 0}
        className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Adding…" : "Add"}
      </button>
      <button
        type="button"
        disabled={isPending}
        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 disabled:opacity-50"
        onClick={onCancel}
      >
        Cancel
      </button>
      {error ? <p className="w-full text-xs text-red-700">{error}</p> : null}
    </form>
  );
}
