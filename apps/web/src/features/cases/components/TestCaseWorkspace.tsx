import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { useCaseListDnD, type PendingMoveCopy } from "../hooks/useCaseListDnD";
import { useExpandedCase } from "../hooks/useExpandedCase";
import { useSections } from "../hooks/useSections";
import { CaseDetailSidePanel } from "./CaseDetailSidePanel";
import { CaseListPane } from "./CaseListPane";
import { SectionTreePane } from "./SectionTreePane";
import { SuiteSwitcherBar } from "./SuiteSwitcherBar";

const suiteStorageKey = (projectId: string) => `cases:active-suite:${projectId}`;

export function TestCaseWorkspace() {
  const { projectId = "" } = useParams();
  const [selectedSuiteId, setSelectedSuiteId] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(suiteStorageKey(projectId)) ?? "";
  });
  const { data: bundle, isLoading: sectionsLoading, isError: sectionsError, refetch } = useSections(
    projectId,
    selectedSuiteId || undefined
  );
  const sections = bundle?.sections ?? [];
  const { selectedSectionId, panelCaseId, panelMode, setSelectedSection, setPanelCase } = useExpandedCase();
  const dnd = useCaseListDnD();
  const [pendingMoveCopy, setPendingMoveCopy] = useState<PendingMoveCopy | null>(null);
  const activeSuiteId = bundle?.suiteId ?? selectedSuiteId;
  const selectedSectionSuiteId =
    selectedSectionId != null
      ? String(sections.find((section) => section.id === selectedSectionId)?.suiteId ?? activeSuiteId)
      : activeSuiteId;
  const panelOpen = panelCaseId != null;

  useEffect(() => {
    if (!bundle?.suiteId) return;
    setSelectedSuiteId(bundle.suiteId);
    window.localStorage.setItem(suiteStorageKey(projectId), bundle.suiteId);
  }, [bundle?.suiteId, projectId]);

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
    <div className="grid gap-4">
      <SuiteSwitcherBar
        projectId={projectId}
        selectedSuiteId={activeSuiteId}
        onSelectSuite={(suiteId) => {
          setSelectedSuiteId(suiteId);
          window.localStorage.setItem(suiteStorageKey(projectId), suiteId);
          const firstInSuite = sections.find((section) => String(section.suiteId) === suiteId);
          if (firstInSuite) setSelectedSection(firstInSuite.id);
        }}
      />
      <div
        className={[
          "grid items-start gap-4",
          panelOpen ? "xl:grid-cols-[260px_minmax(0,1fr)_minmax(340px,38%)]" : "xl:grid-cols-[280px_minmax(0,1fr)]"
        ].join(" ")}
      >
        <SectionTreePane
          suiteId={selectedSectionSuiteId}
          sections={sections}
          selectedSectionId={selectedSectionId}
          onSelectSection={setSelectedSection}
          onClearExpand={() => setPanelCase(null)}
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
        {panelOpen ? (
          <CaseDetailSidePanel
            projectId={projectId}
            caseId={panelCaseId}
            sectionId={selectedSectionId}
            mode={panelMode}
            onClose={() => setPanelCase(null)}
            onDuplicated={(copiedCaseId) => setPanelCase(copiedCaseId, "view")}
          />
        ) : null}
      </div>
    </div>
  );
}