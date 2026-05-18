import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { useCaseListDnD, type PendingMoveCopy } from "../hooks/useCaseListDnD";
import { useCaseRepositoryKeyboard } from "../hooks/useCaseRepositoryKeyboard";
import { useCaseRepositoryTreeSide } from "../hooks/useCaseRepositoryTreeSide";
import { useDefectAddUrl } from "../hooks/useDefectAddUrl";
import { useExpandedCase } from "../hooks/useExpandedCase";
import { useSections } from "../hooks/useSections";
import { CaseDetailSidePanel } from "./CaseDetailSidePanel";
import { CaseListPane } from "./CaseListPane";
import { SectionTreePane } from "./SectionTreePane";
import { CaseRepositoryContentHeader } from "../../projects/content-header/ProjectContentHeader";
import { SuiteSwitcherBar } from "./SuiteSwitcherBar";

const suiteStorageKey = (projectId: string) => `cases:active-suite:${projectId}`;

export function TestCaseWorkspace() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const defectAddUrl = useDefectAddUrl(projectId);
  const [selectedSuiteId, setSelectedSuiteId] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(suiteStorageKey(projectId)) ?? "";
  });
  const { data: bundle, isLoading: sectionsLoading, isError: sectionsError, refetch } = useSections(
    projectId,
    selectedSuiteId || undefined
  );
  const sections = bundle?.sections ?? [];
  const {
    selectedSectionId,
    panelCaseId,
    panelMode,
    caseDisplay,
    setSelectedSection,
    setTreeFocusSection,
    setPanelCase
  } = useExpandedCase();
  const { treeSide, toggleTreeSide } = useCaseRepositoryTreeSide(projectId);
  const dnd = useCaseListDnD();
  const [pendingMoveCopy, setPendingMoveCopy] = useState<PendingMoveCopy | null>(null);
  const activeSuiteId = bundle?.suiteId ?? selectedSuiteId;
  const selectedSectionSuiteId =
    selectedSectionId != null
      ? String(sections.find((section) => section.id === selectedSectionId)?.suiteId ?? activeSuiteId)
      : activeSuiteId;
  const panelOpen = panelCaseId != null;
  const [addCaseRequest, setAddCaseRequest] = useState(0);
  const [editDescriptionRequest, setEditDescriptionRequest] = useState(0);
  const [copyMoveRequest, setCopyMoveRequest] = useState(0);

  useCaseRepositoryKeyboard({
    enabled: !sectionsLoading && sections.length > 0,
    onAddCase: () => setAddCaseRequest((value) => value + 1),
    onFocusNewSection: () => {
      document.getElementById("case-repository-new-section")?.focus();
    },
    onRunTest: () => {
      if (activeSuiteId) navigate(`/projects/${projectId}/runs/new?suiteId=${activeSuiteId}`);
    },
    onEditSuiteDescription: () => setEditDescriptionRequest((value) => value + 1),
    onAddDefect: defectAddUrl
      ? () => {
          window.open(defectAddUrl, "_blank", "noopener,noreferrer");
        }
      : undefined
  });

  useEffect(() => {
    if (!bundle?.suiteId) return;
    setSelectedSuiteId(bundle.suiteId);
    window.localStorage.setItem(suiteStorageKey(projectId), bundle.suiteId);
  }, [bundle?.suiteId, projectId]);

  useEffect(() => {
    if (sectionsLoading || sections.length === 0 || caseDisplay !== "tree") return;
    const valid =
      selectedSectionId != null &&
      !Number.isNaN(selectedSectionId) &&
      sections.some((s) => s.id === selectedSectionId);
    if (!valid) {
      setSelectedSection(sections[0]!.id);
    }
  }, [caseDisplay, sectionsLoading, sections, selectedSectionId, setSelectedSection]);

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

  if (
    caseDisplay === "tree" &&
    (selectedSectionId == null || !sections.some((s) => s.id === selectedSectionId))
  ) {
    return <LoadingState message="Preparing the case repository..." />;
  }

  const gridCols = panelOpen
    ? treeSide === "right"
      ? "xl:grid-cols-[minmax(0,1fr)_minmax(340px,38%)_260px]"
      : "xl:grid-cols-[260px_minmax(0,1fr)_minmax(340px,38%)]"
    : treeSide === "right"
      ? "xl:grid-cols-[minmax(0,1fr)_260px]"
      : "xl:grid-cols-[260px_minmax(0,1fr)]";

  const caseList = (
    <CaseListPane
      projectId={projectId}
      suiteId={activeSuiteId}
      sections={sections}
      addCaseRequest={addCaseRequest}
      copyMoveRequest={copyMoveRequest}
      dnd={dnd}
      pendingMoveCopy={pendingMoveCopy}
      onPendingMoveCopyChange={setPendingMoveCopy}
    />
  );

  const detailPanel = panelOpen ? (
    <CaseDetailSidePanel
      projectId={projectId}
      caseId={panelCaseId}
      sectionId={selectedSectionId ?? sections[0]?.id ?? 0}
      mode={panelMode}
      onClose={() => setPanelCase(null)}
      onDuplicated={(copiedCaseId) => setPanelCase(copiedCaseId, "view")}
    />
  ) : null;

  const sectionTree = (
    <SectionTreePane
      suiteId={selectedSectionSuiteId}
      sections={sections}
      selectedSectionId={selectedSectionId}
      onSelectSection={setTreeFocusSection}
      onClearExpand={() => setPanelCase(null)}
      onAddTestCase={() => setAddCaseRequest((value) => value + 1)}
      editDescriptionRequest={editDescriptionRequest}
      treeSide={treeSide}
      onToggleTreeSide={toggleTreeSide}
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
  );

  return (
    <div className="grid gap-3">
      <CaseRepositoryContentHeader
        projectId={projectId}
        suiteId={activeSuiteId}
        onCopyMoveCases={() => setCopyMoveRequest((value) => value + 1)}
      />
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
      <div className={["grid items-start gap-3", gridCols].join(" ")}>
        {treeSide === "left" ? sectionTree : null}
        {caseList}
        {detailPanel}
        {treeSide === "right" ? sectionTree : null}
      </div>
    </div>
  );
}
