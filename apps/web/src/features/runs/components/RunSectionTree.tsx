import { useMemo, useState, type ReactNode } from "react";

import type { SectionNode } from "../../cases/types";
import { sortSectionsDepthFirst } from "../../cases/utils/sectionTreeOrder";

type Props = {
  sections: SectionNode[];
  sectionCounts: ReadonlyMap<string, number>;
  selectedSectionId: number | null;
  onSelectSection: (sectionId: number | null) => void;
  display: "subtree" | "tree" | "compact";
  onDisplayChange: (value: "subtree" | "tree" | "compact") => void;
};

function countInSubtree(sectionId: number, sections: SectionNode[], counts: ReadonlyMap<string, number>): number {
  const children = new Map<number | null, number[]>();
  for (const section of sections) {
    const parent = section.parentSectionId;
    const list = children.get(parent);
    if (list) list.push(section.id);
    else children.set(parent, [section.id]);
  }
  let total = 0;
  const stack = [sectionId];
  const seen = new Set<number>();
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    total += counts.get(String(id)) ?? 0;
    const kids = children.get(id);
    if (kids) for (const kid of kids) stack.push(kid);
  }
  return total;
}

export function RunSectionTree({
  sections,
  sectionCounts,
  selectedSectionId,
  onSelectSection,
  display,
  onDisplayChange
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set());

  const ordered = useMemo(
    () =>
      sortSectionsDepthFirst(
        sections.map((s) => ({
          id: s.id,
          parentSectionId: s.parentSectionId,
          displayOrder: s.displayOrder
        }))
      ),
    [sections]
  );

  const sectionById = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections]);
  const childrenByParent = useMemo(() => {
    const map = new Map<number | null, SectionNode[]>();
    for (const section of sections) {
      const parent = section.parentSectionId;
      const list = map.get(parent);
      if (list) list.push(section);
      else map.set(parent, [section]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id);
    }
    return map;
  }, [sections]);

  const rank = useMemo(() => new Map(ordered.map((s, i) => [s.id, i])), [ordered]);

  function toggleCollapsed(sectionId: number) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  function renderNode(section: SectionNode, depth: number): ReactNode {
    const kids = childrenByParent.get(section.id) ?? [];
    const isCollapsed = collapsed.has(section.id);
    const count =
      display === "subtree" ? countInSubtree(section.id, sections, sectionCounts) : (sectionCounts.get(String(section.id)) ?? 0);
    const selected = selectedSectionId === section.id;

    return (
      <li key={section.id}>
        <div className="flex items-stretch gap-0.5">
          {kids.length > 0 ? (
            <button
              type="button"
              className="shrink-0 px-1 text-slate-400 hover:text-slate-700"
              aria-label={isCollapsed ? "Expand section" : "Collapse section"}
              onClick={() => toggleCollapsed(section.id)}
            >
              {isCollapsed ? "▸" : "▾"}
            </button>
          ) : (
            <span className="w-5 shrink-0" />
          )}
          <button
            type="button"
            className={`min-w-0 flex-1 truncate rounded px-1.5 py-1 text-left text-xs ${
              selected ? "bg-sky-100 font-medium text-sky-900" : "text-slate-700 hover:bg-slate-50"
            }`}
            style={{ paddingLeft: `${depth * 12 + 4}px` }}
            title={section.name}
            onClick={() => onSelectSection(section.id)}
          >
            <span className="truncate">{section.name}</span>
            {count > 0 ? <span className="ml-1 tabular-nums text-slate-400">({count})</span> : null}
          </button>
        </div>
        {kids.length > 0 && !isCollapsed ? (
          <ul className="mt-0.5">{kids.map((child) => renderNode(child, depth + 1))}</ul>
        ) : null}
      </li>
    );
  }

  const roots = (childrenByParent.get(null) ?? []).slice().sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));

  return (
    <nav
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:w-52 xl:w-56"
      aria-label="Run sections"
    >
      <div className="border-b border-slate-100 bg-slate-50 px-2 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Sections</p>
        <button
          type="button"
          className={`mt-1 w-full rounded px-1.5 py-1 text-left text-xs ${
            selectedSectionId == null ? "bg-sky-100 font-medium text-sky-900" : "text-slate-600 hover:bg-white"
          }`}
          onClick={() => onSelectSection(null)}
        >
          All sections
        </button>
        <label className="mt-2 block text-[10px] font-medium text-slate-500">
          Display
          <select
            className="mt-0.5 w-full rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-800"
            value={display}
            onChange={(e) => onDisplayChange(e.target.value as Props["display"])}
          >
            <option value="subtree">Subtree</option>
            <option value="tree">Tree</option>
            <option value="compact">Compact</option>
          </select>
        </label>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {roots.map((section) => renderNode(sectionById.get(section.id) ?? section, 0))}
      </ul>
    </nav>
  );
}
