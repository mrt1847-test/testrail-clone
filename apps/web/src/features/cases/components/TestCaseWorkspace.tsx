import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { useCaseListDnD, type PendingMoveCopy } from "../hooks/useCaseListDnD";
import { useExpandedCase } from "../hooks/useExpandedCase";
import { useSections } from "../hooks/useSections";
import { CaseListPane } from "./CaseListPane";
import { SectionTreePane } from "./SectionTreePane";

export function TestCaseWorkspace() {
  const { projectId = "" } = useParams();
  const { data: bundle, isLoading: sectionsLoading, isError: sectionsError, refetch } = useSections(projectId);
  const sections = bundle?.sections ?? [];
  const { selectedSectionId, setExpandedCase, setSelectedSection } = useExpandedCase();
  const dnd = useCaseListDnD();
  const [pendingMoveCopy, setPendingMoveCopy] = useState<PendingMoveCopy | null>(null);
  const selectedSectionSuiteId =
    selectedSectionId != null ? String(sections.find((section) => section.id === selectedSectionId)?.suiteId ?? "") : "";

  useEffect(() => {
    if (sectionsLoading || sections.length === 0) return;
    const valid =
      selectedSectionId != null &&
      !Number.isNaN(selectedSectionId) &&
      sections.some((s) => s.id === selectedSectionId);
    if (!valid) {
      setSelectedSection(sections[0]!.id);
    }
  }, [sectionsLoading, sections, selectedSectionId, setSelectedSection]);

  if (sectionsError) {
    return <ErrorState title="Could not load sections" onRetry={() => void refetch()} />;
  }

  if (sectionsLoading) {
    return <LoadingState message="Loading the test case workspace..." />;
  }

  if (sections.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        No sections are available in this project yet. Create a suite and section first to start building the case repository.
      </p>
    );
  }

  if (selectedSectionId == null || !sections.some((s) => s.id === selectedSectionId)) {
    return <LoadingState message="Preparing the case repository..." />;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Test Cases</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Repository Workspace</h2>
            <p className="mt-1 text-sm text-slate-600">
              Navigate sections on the left, review the repository in the middle, and edit the active case in a dedicated side panel.
            </p>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
            {sections.length} section{sections.length === 1 ? "" : "s"} available
          </div>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <SectionTreePane
          suiteId={selectedSectionSuiteId}
          sections={sections}
          selectedSectionId={selectedSectionId}
          onSelectSection={setSelectedSection}
          onClearExpand={() => setExpandedCase(null)}
          dnd={{
            isDragging: dnd.isDragging,
            draggingCount: dnd.draggingCount,
            sourceSectionId: dnd.sourceSectionId,
            hoveredSectionId: dnd.hoveredSectionId,
            onDragOver: (event, sectionId) => dnd.handleSectionDragOver(event, sectionId),
            onDragLeave: (sectionId) => dnd.handleSectionDragLeave(sectionId),
            onDrop: (event, sectionId) =>
              dnd.handleSectionDrop({
                event,
                targetSectionId: sectionId,
                onCrossSectionDrop: setPendingMoveCopy
              })
          }}
        />
        <CaseListPane
          projectId={projectId}
          sections={sections}
          dnd={dnd}
          pendingMoveCopy={pendingMoveCopy}
          onPendingMoveCopyChange={setPendingMoveCopy}
        />
      </div>
    </div>
  );
}
