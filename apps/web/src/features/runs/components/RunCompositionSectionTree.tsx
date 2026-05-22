import { useMemo, useState, type ReactNode } from "react";

import type { SectionNode } from "../../cases/types";

type RunCompositionSectionTreeProps = {
  sections: SectionNode[];
  selectedSectionId: number | null;
  onSelectSection: (sectionId: number | null) => void;
  includedSectionIds: string[];
  excludedSectionIds: string[];
  subtreeCaseCountBySectionId: Map<number, number>;
  includeAll: boolean;
  onToggleInclude: (sectionId: string, checked: boolean) => void;
  onToggleExclude: (sectionId: string, checked: boolean) => void;
};

export function RunCompositionSectionTree({
  sections,
  selectedSectionId,
  onSelectSection,
  includedSectionIds,
  excludedSectionIds,
  subtreeCaseCountBySectionId,
  includeAll,
  onToggleInclude,
  onToggleExclude
}: RunCompositionSectionTreeProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());

  const sectionByParent = useMemo(() => {
    const map = new Map<number | null, SectionNode[]>();
    for (const section of sections) {
      const parent = section.parentSectionId;
      const list = map.get(parent) ?? [];
      list.push(section);
      map.set(parent, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id);
    }
    return map;
  }, [sections]);

  const toggleCollapsed = (id: number) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderNodes = (parentId: number | null, depth: number): ReactNode => {
    const nodes = sectionByParent.get(parentId) ?? [];
    return nodes.map((section) => {
      const sid = String(section.id);
      const hasChildren = (sectionByParent.get(section.id)?.length ?? 0) > 0;
      const collapsed = collapsedIds.has(section.id);
      const caseCount = subtreeCaseCountBySectionId.get(section.id) ?? 0;
      const isSelected = selectedSectionId === section.id;

      return (
        <div key={section.id}>
          <div
            className={`flex items-center gap-1 border-b border-slate-100 py-1 pr-2 text-xs dark:border-slate-800 ${
              isSelected ? "bg-sky-50 dark:bg-sky-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
            }`}
            style={{ paddingLeft: `${depth * 12 + 4}px` }}
          >
            {hasChildren ? (
              <button
                type="button"
                className="h-5 w-5 shrink-0 text-slate-500"
                aria-label={collapsed ? "Expand section" : "Collapse section"}
                onClick={() => toggleCollapsed(section.id)}
              >
                {collapsed ? "▸" : "▾"}
              </button>
            ) : (
              <span className="inline-block h-5 w-5 shrink-0" />
            )}
            <input
              type="checkbox"
              className="shrink-0"
              title="Include section subtree"
              checked={includedSectionIds.includes(sid)}
              onChange={(e) => onToggleInclude(sid, e.target.checked)}
              onClick={(e) => e.stopPropagation()}
            />
            {includeAll ? (
              <input
                type="checkbox"
                className="shrink-0"
                title="Exclude section subtree"
                checked={excludedSectionIds.includes(sid)}
                onChange={(e) => onToggleExclude(sid, e.target.checked)}
                onClick={(e) => e.stopPropagation()}
              />
            ) : null}
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left font-medium text-slate-800 dark:text-slate-200"
              onClick={() => onSelectSection(section.id)}
            >
              {section.name}
            </button>
            <span className="shrink-0 tabular-nums text-[11px] text-slate-400">{caseCount}</span>
          </div>
          {!collapsed ? renderNodes(section.id, depth + 1) : null}
        </div>
      );
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/50">
      <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Sections</p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {includeAll ? "Include / exclude roots" : "Include roots · click to filter table"}
        </p>
        <button
          type="button"
          className="mt-1 text-[11px] font-medium text-indigo-800 hover:underline dark:text-indigo-300"
          onClick={() => onSelectSection(null)}
        >
          Show all sections
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {sections.length === 0 ? (
          <p className="px-3 py-4 text-xs text-slate-500">No sections in this suite.</p>
        ) : (
          renderNodes(null, 0)
        )}
      </div>
    </div>
  );
}
