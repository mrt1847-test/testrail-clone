type CaseListToolbarProps = {
  onAddCase?: () => void;
};

export function CaseListToolbar({ onAddCase }: CaseListToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
      <input
        aria-label="Search cases"
        placeholder="Search cases"
        className="min-w-[200px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
      />
      <button
        type="button"
        onClick={onAddCase}
        className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Add case
      </button>
    </div>
  );
}
