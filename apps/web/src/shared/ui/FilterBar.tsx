export type FilterField =
  | {
      kind: "search";
      id: string;
      label: string;
      value: string;
      onChange: (value: string) => void;
      placeholder?: string;
    }
  | {
      kind: "select";
      id: string;
      label: string;
      value: string;
      onChange: (value: string) => void;
      options: Array<{ value: string; label: string }>;
    };

type FilterBarProps = {
  fields: FilterField[];
  ariaLabel?: string;
  /** `toolbar` matches run/test list filter strips; `card` matches report pages. */
  variant?: "toolbar" | "card";
  className?: string;
};

const variantClass: Record<NonNullable<FilterBarProps["variant"]>, string> = {
  toolbar: "border-b border-slate-200 bg-slate-50 px-3 py-2 shadow-none rounded-none",
  card: "rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
};

export function FilterBar({
  fields,
  ariaLabel = "Filters",
  variant = "card",
  className = ""
}: FilterBarProps) {
  if (fields.length === 0) return null;

  return (
    <div
      className={`flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end ${variantClass[variant]} ${className}`.trim()}
      role="search"
      aria-label={ariaLabel}
    >
      {fields.map((field) =>
        field.kind === "search" ? (
          <label
            key={field.id}
            className="flex min-w-[12rem] flex-1 flex-col gap-0.5 text-xs font-medium text-slate-600"
          >
            {field.label}
            <input
              type="search"
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              placeholder={field.placeholder ?? "Search…"}
              className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal text-slate-900"
            />
          </label>
        ) : (
          <label
            key={field.id}
            className={`flex flex-col gap-0.5 text-xs font-medium text-slate-600 ${
              variant === "toolbar" ? "w-full sm:w-44" : ""
            }`}
          >
            {field.label}
            <select
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal text-slate-900"
            >
              {field.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        )
      )}
    </div>
  );
}
