import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { useCaseListDnD, type PendingMoveCopy } from "../hooks/useCaseListDnD";
import { buildCaseDetailPath } from "../caseRoute";
import { useExpandedCase } from "../hooks/useExpandedCase";
import { useSections } from "../hooks/useSections";
import { CaseListPane } from "./CaseListPane";
import { SectionTreePane } from "./SectionTreePane";
import { SuiteSwitcherBar } from "./SuiteSwitcherBar";

const suiteStorageKey = (projectId: string) => `cases:active-suite:${projectId}`;

export function TestCaseWorkspace() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const [selectedSuiteId, setSelectedSuiteId] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(suiteStorageKey(projectId)) ?? "";
  });
  const { data: bundle, isLoading: sectionsLoading, isError: sectionsError, refetch } = useSections(
    projectId,
    selectedSuiteId || undefined
  );
  const sections = bundle?.sections ?? [];
  const { selectedSectionId, expandedCaseId, mode, setSelectedSection } = useExpandedCase();
  const dnd = useCaseListDnD();
  const [pendingMoveCopy, setPendingMoveCopy] = useState<PendingMoveCopy | null>(null);
  const activeSuiteId = bundle?.suiteId ?? selectedSuiteId;
  const selectedSectionSuiteId =
    selectedSectionId != null
      ? String(sections.find((section) => section.id === selectedSectionId)?.suiteId ?? activeSuiteId)
      : activeSuiteId;

  useEffect(() => {
    if (!bundle?.suiteId) return;
    setSelectedSuiteId(bundle.suiteId);
    window.localStorage.setItem(suiteStorageKey(projectId), bundle.suiteId);
  }, [bundle?.suiteId, projectId]);

  useEffect(() => {
    if (expandedCaseId == null) return;
    navigate(
      buildCaseDetailPath(projectId, expandedCaseId, {
        sectionId: selectedSectionId,
        mode: mode === "edit" ? "edit" : "view"
      }),
      { replace: true }
    );
  }, [expandedCaseId, mode, navigate, projectId, selectedSectionId]);

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
      <div className="grid items-start gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <SectionTreePane
          suiteId={selectedSectionSuiteId}
          sections={sections}
          selectedSectionId={selectedSectionId}
          onSelectSection={setSelectedSection}
          onClearExpand={() => {}}
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
