import { useParams } from "react-router-dom";

import { useSections } from "../hooks/useSections";

type SectionTreePaneProps = {
  selectedSectionId: number;
  onSelectSection: (id: number) => void;
  onClearExpand: () => void;
};

export function SectionTreePane({ selectedSectionId, onSelectSection, onClearExpand }: SectionTreePaneProps) {
  const { projectId = "" } = useParams();
  const { data: sections = [] } = useSections(projectId);

  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Section tree</h3>
      <ul className="mt-3 grid gap-1">
        {sections.map((section) => {
          const selected = section.id === selectedSectionId;
          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => {
                  onSelectSection(section.id);
                  onClearExpand();
                }}
                className={
                  selected
                    ? "w-full rounded-md bg-slate-900 px-3 py-2 text-left text-sm font-medium text-white"
                    : "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                }
              >
                {section.name}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
