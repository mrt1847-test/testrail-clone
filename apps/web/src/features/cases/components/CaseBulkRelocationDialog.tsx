type RelocationSectionOption = {
  id: number;
  name: string;
  depth?: number;
};

type CaseBulkRelocationDialogProps = {
  open: boolean;
  caseCount: number;
  sourceProjectId: string;
  targetProjectId: string;
  targetSuiteId: string;
  targetSectionId: number | null;
  projects: Array<{ id: string; name: string }>;
  suites: Array<{ id: string; name: string }>;
  sections: RelocationSectionOption[];
  onTargetProjectChange: (projectId: string) => void;
  onTargetSuiteChange: (suiteId: string) => void;
  onTargetSectionChange: (sectionId: number) => void;
  busy?: boolean;
  pendingAction?: "move" | "copy" | null;
  onMove: () => void;
  onCopy: () => void;
  onCancel: () => void;
};

function sectionOptionLabel(section: RelocationSectionOption) {
  const indent = section.depth && section.depth > 0 ? `${"—".repeat(section.depth)} ` : "";
  return `${indent}${section.name}`;
}

export function CaseBulkRelocationDialog({
  open,
  caseCount,
  sourceProjectId,
  targetProjectId,
  targetSuiteId,
  targetSectionId,
  projects,
  suites,
  sections,
  onTargetProjectChange,
  onTargetSuiteChange,
  onTargetSectionChange,
  busy = false,
  pendingAction = null,
  onMove,
  onCopy,
  onCancel
}: CaseBulkRelocationDialogProps) {
  if (!open) return null;

  const moveLabel = busy && pendingAction === "move" ? "Moving…" : "Move";
  const copyLabel = busy && pendingAction === "copy" ? "Copying…" : "Copy";
  const disabled = busy || targetSectionId == null || sections.length === 0;
  const crossProject = targetProjectId !== sourceProjectId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="copyMoveCasesTitle"
        className="w-full max-w-lg rounded-lg border border-slate-300 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 id="copyMoveCasesTitle" className="text-sm font-semibold text-slate-900">
            Copy or move test cases
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            {caseCount} case{caseCount === 1 ? "" : "s"} will be placed in the target section
            {crossProject ? " (another project)." : "."}
          </p>
        </div>
        <div className="space-y-3 px-4 py-3">
          <label className="block text-xs font-medium text-slate-700">
            Target project
            <select
              value={targetProjectId}
              onChange={(event) => onTargetProjectChange(event.target.value)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          {suites.length > 1 ? (
            <label className="block text-xs font-medium text-slate-700">
              Target suite
              <select
                value={targetSuiteId}
                onChange={(event) => onTargetSuiteChange(event.target.value)}
                className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
              >
                {suites.map((suite) => (
                  <option key={suite.id} value={suite.id}>
                    {suite.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block text-xs font-medium text-slate-700">
            Target section
            <select
              value={targetSectionId ?? ""}
              onChange={(event) => onTargetSectionChange(Number(event.target.value))}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
            >
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {sectionOptionLabel(section)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded border border-slate-400 bg-white px-3 py-1 text-xs text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onCopy}
            disabled={disabled}
            className="rounded border border-slate-400 bg-white px-3 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            {copyLabel}
          </button>
          <button
            type="button"
            onClick={onMove}
            disabled={disabled}
            className="rounded border border-blue-900 bg-blue-700 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {moveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
