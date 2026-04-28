import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export function useExpandedCase() {
  const [searchParams, setSearchParams] = useSearchParams();

  const expandedCaseId = useMemo(() => {
    const raw = searchParams.get("caseId");
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  }, [searchParams]);

  const mode: "view" | "edit" = searchParams.get("mode") === "edit" ? "edit" : "view";

  const selectedSectionId = useMemo(() => {
    const raw = searchParams.get("sectionId");
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  }, [searchParams]);

  function setExpandedCase(nextCaseId: number | null, nextMode: "view" | "edit" = "view") {
    const next = new URLSearchParams(searchParams);

    if (nextCaseId === null) {
      next.delete("caseId");
      next.delete("mode");
    } else {
      next.set("caseId", String(nextCaseId));
      next.set("mode", nextMode);
    }

    setSearchParams(next);
  }

  function setSelectedSection(nextSectionId: number) {
    const next = new URLSearchParams(searchParams);
    next.set("sectionId", String(nextSectionId));
    next.delete("caseId");
    next.delete("mode");
    setSearchParams(next);
  }

  return {
    expandedCaseId,
    mode,
    selectedSectionId,
    setExpandedCase,
    setSelectedSection
  };
}
