import { useCallback, useEffect, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { useCaseListDnD, type PendingMoveCopy } from "../hooks/useCaseListDnD";
import { useCaseRepositoryKeyboard } from "../hooks/useCaseRepositoryKeyboard";
import { useCaseRepositoryTreeSide } from "../hooks/useCaseRepositoryTreeSide";
import { useDefectAddUrl } from "../hooks/useDefectAddUrl";
import { useExpandedCase } from "../hooks/useExpandedCase";
import { useSections } from "../hooks/useSections";
import { buildAddCasePath } from "../caseRoute";
import { CaseDetailSidePanel } from "./CaseDetailSidePanel";
import { CaseListPane } from "./CaseListPane";
import { SectionTreePane } from "./SectionTreePane";
import { CaseRepositoryContentHeader } from "../../projects/content-header/ProjectContentHeader";
import { useWorkspacePreferences } from "../../projects/hooks/useWorkspacePreferences";
import { suiteStorageKey } from "../../projects/workspacePreferences";
import { useAuth } from "../../auth/context/AuthContext";
import { SuiteSwitcherBar } from "./SuiteSwitcherBar";
import { WorkbenchPage } from "../../../shared/ui";

const SIDE_SPLIT_QUERY = "(min-width: 1024px)";
const DETAIL_PANE_MIN_WIDTH = 360;
const DETAIL_PANE_MAX_WIDTH = 560;
const DETAIL_PANE_DEFAULT_WIDTH = 440;

function clampDetailPaneWidth(value: number) {
  return Math.min(DETAIL_PANE_MAX_WIDTH, Math.max(DETAIL_PANE_MIN_WIDTH, Math.round(value)));
}

function detailPaneStorageKey(projectId: string, userId?: string | null) {
  return `cases:detail-pane-width:${userId ?? "anonymous"}:${projectId}`;
}

function readDetailPaneWidth(key: string) {
  if (typeof window === "undefined") return DETAIL_PANE_DEFAULT_WIDTH;
  const parsed = Number(window.localStorage.getItem(key));
  return Number.isFinite(parsed) ? clampDetailPaneWidth(parsed) : DETAIL_PANE_DEFAULT_WIDTH;
}

function useSideSplitLayout() {
  const [wide, setWide] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(SIDE_SPLIT_QUERY).matches
  );

  useEffect(() => {
    const media = window.matchMedia(SIDE_SPLIT_QUERY);
    const update = () => setWide(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return wide;
}

export function TestCaseWorkspace() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const workspacePrefsQuery = useWorkspacePreferences(projectId);
  const [searchParams, setSearchParams] = useSearchParams();
  const defectAddUrl = useDefectAddUrl(projectId);
  const storageKey = suiteStorageKey(projectId, user?.id);
  const [selectedSuiteId, setSelectedSuiteId] = useState(() => {
    if (typeof window === "undefined") return "";
    const fromUrl = searchParams.get("suiteId");
    if (fromUrl) return fromUrl;
    return (
      window.localStorage.getItem(storageKey) ??
      window.localStorage.getItem(suiteStorageKey(projectId)) ??
      ""
    );
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
    caseQueryScope,
    setSelectedSection,
    setTreeFocusSection,
    clearTreeFocusSection,
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
  const sideSplitLayout = useSideSplitLayout();
  const detailPaneKey = detailPaneStorageKey(projectId, user?.id);
  const [detailPaneWidth, setDetailPaneWidth] = useState(() => readDetailPaneWidth(detailPaneKey));
  const [editDescriptionRequest, setEditDescriptionRequest] = useState(0);
  const [copyMoveRequest, setCopyMoveRequest] = useState(0);
  const [outlineRequest, setOutlineRequest] = useState<{ sectionId: number; nonce: number } | null>(null);

  useEffect(() => {
    setDetailPaneWidth(readDetailPaneWidth(detailPaneKey));
  }, [detailPaneKey]);

  const persistDetailPaneWidth = useCallback(
    (value: number) => {
      const next = clampDetailPaneWidth(value);
      setDetailPaneWidth(next);
      window.localStorage.setItem(detailPaneKey, String(next));
    },
    [detailPaneKey]
  );

  const closeDetail = useCallback(() => {
    const closingCaseId = panelCaseId;
    setPanelCase(null);
    if (closingCaseId == null) return;
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-case-row-id="${closingCaseId}"] [data-case-open-button]`)
        ?.focus();
    });
  }, [panelCaseId, setPanelCase]);

  const startDetailPaneResize = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = detailPaneWidth;
    const onMove = (moveEvent: globalThis.MouseEvent) => {
      setDetailPaneWidth(clampDetailPaneWidth(startWidth - (moveEvent.clientX - startX)));
    };
    const onUp = (upEvent: globalThis.MouseEvent) => {
      const next = clampDetailPaneWidth(startWidth - (upEvent.clientX - startX));
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      persistDetailPaneWidth(next);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const resizeDetailPaneWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    persistDetailPaneWidth(detailPaneWidth + (event.key === "ArrowLeft" ? 16 : -16));
  };

  const openCaseOutline = useCallback(
    (sectionId?: number | null) => {
      const target = sectionId ?? selectedSectionId ?? sections[0]?.id;
      if (target == null) return;
      if (caseQueryScope === "all") setTreeFocusSection(target);
      else setSelectedSection(target);
      setOutlineRequest((current) => ({ sectionId: target, nonce: (current?.nonce ?? 0) + 1 }));
    },
    [caseQueryScope, sections, selectedSectionId, setSelectedSection, setTreeFocusSection]
  );

  useCaseRepositoryKeyboard({
    enabled: !sectionsLoading && sections.length > 0,
    onAddCase: () => openCaseOutline(),
    onEditCase: () => {
      const target = panelCaseId;
      if (target == null) {
        setEditDescriptionRequest((value) => value + 1);
        return;
      }
      setPanelCase(target, "edit");
    },
    onFocusNewSection: () => {
      document.getElementById("case-repository-new-section")?.focus();
    },
    onRunTest: () => {
      if (activeSuiteId) navigate(`/projects/${projectId}/runs/new?suiteId=${activeSuiteId}`);
    },
    onAddDefect: defectAddUrl
      ? () => {
          window.open(defectAddUrl, "_blank", "noopener,noreferrer");
        }
      : undefined
  });

  useEffect(() => {
    if (searchParams.get("suiteId") || selectedSuiteId) return;
    const preferredSuiteId = workspacePrefsQuery.data?.defaultSuiteId;
    if (!preferredSuiteId) return;
    setSelectedSuiteId(preferredSuiteId);
    window.localStorage.setItem(storageKey, preferredSuiteId);
  }, [searchParams, selectedSuiteId, storageKey, workspacePrefsQuery.data?.defaultSuiteId]);

  useEffect(() => {
    const suiteIdFromUrl = searchParams.get("suiteId");
    if (!suiteIdFromUrl || suiteIdFromUrl === selectedSuiteId) return;
    setSelectedSuiteId(suiteIdFromUrl);
    window.localStorage.setItem(storageKey, suiteIdFromUrl);
  }, [projectId, searchParams, selectedSuiteId, storageKey]);

  useEffect(() => {
    if (!bundle?.suiteId) return;
    setSelectedSuiteId(bundle.suiteId);
    window.localStorage.setItem(storageKey, bundle.suiteId);
    if (searchParams.get("suiteId") === bundle.suiteId) return;
    const next = new URLSearchParams(searchParams);
    next.set("suiteId", bundle.suiteId);
    setSearchParams(next, { replace: true });
  }, [bundle?.suiteId, projectId, searchParams, setSearchParams]);

  useEffect(() => {
    if (sectionsLoading || sections.length === 0) return;
    const valid =
      selectedSectionId != null &&
      !Number.isNaN(selectedSectionId) &&
      sections.some((s) => s.id === selectedSectionId);
    if (valid) return;
    if (caseQueryScope !== "all") {
      setSelectedSection(sections[0]!.id);
    } else if (selectedSectionId != null) {
      clearTreeFocusSection();
    }
  }, [
    caseQueryScope,
    clearTreeFocusSection,
    sectionsLoading,
    sections,
    selectedSectionId,
    setSelectedSection
  ]);

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
    caseQueryScope !== "all" &&
    (selectedSectionId == null || !sections.some((s) => s.id === selectedSectionId))
  ) {
    return <LoadingState message="Preparing the case repository..." />;
  }

  const gridCols = treeSide === "right"
    ? "xl:grid-cols-[minmax(0,1fr)_260px]"
    : "xl:grid-cols-[260px_minmax(0,1fr)]";
  const sideGridStyle: CSSProperties | undefined = sideSplitLayout
    ? {
        gridTemplateColumns: panelOpen
          ? treeSide === "right"
            ? `minmax(0, 1fr) ${detailPaneWidth}px 260px`
            : `260px minmax(0, 1fr) ${detailPaneWidth}px`
          : treeSide === "right"
            ? "minmax(0, 1fr) 260px"
            : "260px minmax(0, 1fr)"
      }
    : undefined;

  const caseList = (
    <CaseListPane
      projectId={projectId}
      suiteId={activeSuiteId}
      sections={sections}
      copyMoveRequest={copyMoveRequest}
      outlineRequest={outlineRequest}
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
      onClose={closeDetail}
      onEdit={() => setPanelCase(panelCaseId, "edit")}
      onCancelEdit={() => setPanelCase(panelCaseId, "view")}
      onDuplicated={(copiedCaseId) => setPanelCase(copiedCaseId, "view")}
    />
  ) : null;

  const sectionTree = (
    <SectionTreePane
      suiteId={selectedSectionSuiteId}
      sections={sections}
      selectedSectionId={selectedSectionId}
      onSelectSection={caseQueryScope === "all" ? setTreeFocusSection : setSelectedSection}
      onClearExpand={() => setPanelCase(null)}
      onAddCaseToSection={(sectionId) => openCaseOutline(sectionId)}
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
    <WorkbenchPage>
      <CaseRepositoryContentHeader
        projectId={projectId}
        suiteId={activeSuiteId}
        onAddCase={() => openCaseOutline()}
        addTestCaseHref={buildAddCasePath(projectId, {
          suiteId: activeSuiteId || undefined,
          sectionId: selectedSectionId ?? sections[0]?.id ?? undefined
        })}
        onCopyMoveCases={() => setCopyMoveRequest((value) => value + 1)}
      />
      <SuiteSwitcherBar
        projectId={projectId}
        selectedSuiteId={activeSuiteId}
        onSelectSuite={(suiteId) => {
          setSelectedSuiteId(suiteId);
          window.localStorage.setItem(suiteStorageKey(projectId), suiteId);
          const next = new URLSearchParams(searchParams);
          next.set("suiteId", suiteId);
          next.delete("sectionId");
          next.delete("caseId");
          next.delete("mode");
          next.delete("panelCaseId");
          next.delete("panelMode");
          setSearchParams(next);
        }}
      />
      <div className={["grid items-start gap-3", gridCols].join(" ")} style={sideGridStyle}>
        {treeSide === "left" ? sectionTree : null}
        <div className="min-w-0">
          {caseList}
          {panelOpen && !sideSplitLayout ? <div className="mt-3">{detailPanel}</div> : null}
        </div>
        {panelOpen && sideSplitLayout ? (
          <div className="relative min-w-0">
            <div
              role="separator"
              aria-label="Resize test case detail panel"
              aria-orientation="vertical"
              aria-valuemin={DETAIL_PANE_MIN_WIDTH}
              aria-valuemax={DETAIL_PANE_MAX_WIDTH}
              aria-valuenow={detailPaneWidth}
              tabIndex={0}
              className="absolute -left-2 top-0 z-10 flex h-full w-4 cursor-col-resize items-stretch justify-center outline-none focus-visible:bg-sky-100"
              onMouseDown={startDetailPaneResize}
              onKeyDown={resizeDetailPaneWithKeyboard}
            >
              <span aria-hidden="true" className="w-px bg-slate-300" />
            </div>
            {detailPanel}
          </div>
        ) : null}
        {treeSide === "right" ? sectionTree : null}
      </div>
    </WorkbenchPage>
  );
}
