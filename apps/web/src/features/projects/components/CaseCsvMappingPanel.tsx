import type { CaseImportProfile } from "../api/importExportApi";

const IGNORE_VALUE = "";

type Props = {
  headers: string[];
  profile: CaseImportProfile | undefined;
  mapping: Record<string, string>;
  onChange: (mapping: Record<string, string>) => void;
  onSuggest: () => void;
  onSave: () => void;
  onClearSaved: () => void;
  hasSavedMapping: boolean;
};

function targetOptions(profile: CaseImportProfile | undefined) {
  const core =
    profile?.coreFields.map((field) => ({
      value: field.key,
      label: field.required ? `${field.label} (required)` : field.label
    })) ?? [];
  const custom =
    profile?.customFields.map((field) => ({
      value: field.key,
      label: field.required ? `${field.label} (required)` : field.label
    })) ?? [];
  return [{ value: IGNORE_VALUE, label: "Ignore column" }, ...core, ...custom];
}

export function CaseCsvMappingPanel({
  headers,
  profile,
  mapping,
  onChange,
  onSuggest,
  onSave,
  onClearSaved,
  hasSavedMapping
}: Props) {
  const options = targetOptions(profile);

  if (headers.length === 0) {
    return (
      <p className="rounded border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
        Paste CSV with a header row to configure column mapping.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onSuggest}
          className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Auto-map columns
        </button>
        <button
          type="button"
          onClick={onSave}
          className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Save mapping for project
        </button>
        {hasSavedMapping ? (
          <button
            type="button"
            onClick={onClearSaved}
            className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            Clear saved mapping
          </button>
        ) : null}
        <span className="text-xs text-slate-500">{headers.length} CSV column(s) detected</span>
      </div>

      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">CSV column</th>
              <th className="px-3 py-2">Maps to</th>
              <th className="px-3 py-2">Hint</th>
            </tr>
          </thead>
          <tbody>
            {headers.map((header) => {
              const selected = mapping[header] ?? IGNORE_VALUE;
              const fieldMeta =
                profile?.coreFields.find((field) => field.key === selected) ??
                profile?.customFields.find((field) => field.key === selected);
              return (
                <tr key={header} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs text-slate-800">{header}</td>
                  <td className="px-3 py-2">
                    <select
                      value={selected}
                      onChange={(e) => onChange({ ...mapping, [header]: e.target.value })}
                      className="w-full min-w-[180px] rounded border border-slate-300 px-2 py-1 text-sm"
                    >
                      {options.map((option) => (
                        <option key={option.value || "__ignore"} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {fieldMeta && "description" in fieldMeta && fieldMeta.description
                      ? fieldMeta.description
                      : fieldMeta && "fieldType" in fieldMeta
                        ? `Custom ${fieldMeta.fieldType}`
                        : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
