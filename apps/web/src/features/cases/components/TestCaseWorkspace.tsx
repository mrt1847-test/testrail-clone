import { useEffect } from "react";
import { useParams } from "react-router-dom";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { useExpandedCase } from "../hooks/useExpandedCase";
import { useSections } from "../hooks/useSections";
import { CaseListPane } from "./CaseListPane";
import { SectionTreePane } from "./SectionTreePane";

export function TestCaseWorkspace() {
  const { projectId = "" } = useParams();
  const { data: bundle, isLoading: sectionsLoading, isError: sectionsError, refetch } = useSections(projectId);
  const sections = bundle?.sections ?? [];
  const suiteId = bundle?.suiteId ?? "";
  const { selectedSectionId, setExpandedCase, setSelectedSection } = useExpandedCase();

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
    return <LoadingState message="Loading test catalog…" />;
  }

  if (sections.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        이 프로젝트에 스위트·섹션이 없습니다. 프로젝트를 새로 만들면 기본 스위트와 섹션이 생성됩니다.
      </p>
    );
  }

  if (selectedSectionId == null || !sections.some((s) => s.id === selectedSectionId)) {
    return <LoadingState message="Loading test catalog…" />;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <CaseListPane projectId={projectId} sections={sections} />
      <SectionTreePane
        suiteId={suiteId}
        sections={sections}
        selectedSectionId={selectedSectionId}
        onSelectSection={setSelectedSection}
        onClearExpand={() => setExpandedCase(null)}
      />
    </div>
  );
}
