import { useCallback, useMemo, useRef, useState, type DragEvent } from "react";

const DRAG_MIME = "application/x-testrail-case-ids";

export type CaseDragPayload = {
  caseIds: number[];
  sourceSectionId: number | null;
};

export type CaseDropPosition = "before" | "after";

export type PendingMoveCopy = {
  caseIds: number[];
  sourceSectionId: number | null;
  targetSectionId: number;
  anchorCaseId: number | null;
  anchorPosition: CaseDropPosition | null;
};

type StartCaseDragArgs = {
  caseId: number;
  sectionId: number;
  selectedCaseIds: Set<number>;
};

type RowDragOverArgs = {
  event: DragEvent;
  caseId: number;
};

type RowDropArgs = {
  event: DragEvent;
  targetCaseId: number;
  targetSectionId: number;
  visibleCaseIds: number[];
  onSamePositionDrop: (input: {
    caseIds: number[];
    sectionId: number;
    anchorCaseId: number;
    anchorPosition: CaseDropPosition;
  }) => void;
  onCrossSectionDrop: (pending: PendingMoveCopy) => void;
};

type SectionDropArgs = {
  event: DragEvent;
  targetSectionId: number;
  onCrossSectionDrop: (pending: PendingMoveCopy) => void;
};

type AppendDropArgs = {
  event: DragEvent;
  currentSectionId: number;
  onSameSectionAppend: (input: { caseIds: number[]; sectionId: number }) => void;
  onCrossSectionDrop: (pending: PendingMoveCopy) => void;
};

function readDragCaseIds(event: DragEvent): number[] | null {
  const raw = event.dataTransfer.getData(DRAG_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const ids = parsed
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value));
    return ids.length > 0 ? ids : null;
  } catch {
    return null;
  }
}

function computeDropPosition(event: DragEvent, host: HTMLElement): CaseDropPosition {
  const rect = host.getBoundingClientRect();
  const offset = event.clientY - rect.top;
  return offset < rect.height / 2 ? "before" : "after";
}

export function useCaseListDnD() {
  const [draggingCaseIds, setDraggingCaseIds] = useState<number[] | null>(null);
  const [sourceSectionId, setSourceSectionId] = useState<number | null>(null);
  const [hoveredRow, setHoveredRow] = useState<{ caseId: number; position: CaseDropPosition } | null>(null);
  const [hoveredSectionId, setHoveredSectionId] = useState<number | null>(null);
  const [hoveredAppendZone, setHoveredAppendZone] = useState<boolean>(false);

  const draggingIdsRef = useRef<number[] | null>(null);
  const sourceSectionRef = useRef<number | null>(null);

  const isDragging = draggingCaseIds != null && draggingCaseIds.length > 0;
  const draggingCount = isDragging ? draggingCaseIds!.length : 0;

  const reset = useCallback(() => {
    setDraggingCaseIds(null);
    setSourceSectionId(null);
    setHoveredRow(null);
    setHoveredSectionId(null);
    setHoveredAppendZone(false);
    draggingIdsRef.current = null;
    sourceSectionRef.current = null;
  }, []);

  const startCaseDrag = useCallback(
    (event: DragEvent, { caseId, sectionId, selectedCaseIds }: StartCaseDragArgs) => {
      const initiatorIsSelected = selectedCaseIds.has(caseId);
      const ids = initiatorIsSelected ? Array.from(selectedCaseIds) : [caseId];
      if (ids.length === 0) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = "copyMove";
      event.dataTransfer.setData(DRAG_MIME, JSON.stringify(ids));
      try {
        event.dataTransfer.setData("text/plain", ids.map((value) => `C${value}`).join(", "));
      } catch {
        // older browsers may throw on additional types
      }
      draggingIdsRef.current = ids;
      sourceSectionRef.current = sectionId;
      setDraggingCaseIds(ids);
      setSourceSectionId(sectionId);
    },
    []
  );

  const endCaseDrag = useCallback(() => {
    reset();
  }, [reset]);

  const handleRowDragOver = useCallback(
    ({ event, caseId }: RowDragOverArgs) => {
      if (!draggingIdsRef.current) return;
      if (draggingIdsRef.current.includes(caseId)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const host = event.currentTarget as HTMLElement;
      const position = computeDropPosition(event, host);
      setHoveredRow((current) =>
        current?.caseId === caseId && current?.position === position ? current : { caseId, position }
      );
      setHoveredAppendZone(false);
      setHoveredSectionId(null);
    },
    []
  );

  const handleRowDragLeave = useCallback(
    (caseId: number) => {
      setHoveredRow((current) => (current?.caseId === caseId ? null : current));
    },
    []
  );

  const handleRowDrop = useCallback(
    ({
      event,
      targetCaseId,
      targetSectionId,
      visibleCaseIds,
      onSamePositionDrop,
      onCrossSectionDrop
    }: RowDropArgs) => {
      const ids = readDragCaseIds(event) ?? draggingIdsRef.current;
      const source = sourceSectionRef.current;
      if (!ids || ids.length === 0) {
        reset();
        return;
      }
      if (ids.includes(targetCaseId)) {
        reset();
        return;
      }
      event.preventDefault();
      const host = event.currentTarget as HTMLElement;
      const position = computeDropPosition(event, host);

      if (source === targetSectionId) {
        if (!visibleCaseIds.includes(targetCaseId)) {
          reset();
          return;
        }
        onSamePositionDrop({
          caseIds: ids,
          sectionId: targetSectionId,
          anchorCaseId: targetCaseId,
          anchorPosition: position
        });
      } else {
        onCrossSectionDrop({
          caseIds: ids,
          sourceSectionId: source,
          targetSectionId,
          anchorCaseId: targetCaseId,
          anchorPosition: position
        });
      }
      reset();
    },
    [reset]
  );

  const handleSectionDragOver = useCallback(
    (event: DragEvent, sectionId: number) => {
      if (!draggingIdsRef.current) return;
      if (sourceSectionRef.current === sectionId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setHoveredSectionId(sectionId);
      setHoveredRow(null);
      setHoveredAppendZone(false);
    },
    []
  );

  const handleSectionDragLeave = useCallback((sectionId: number) => {
    setHoveredSectionId((current) => (current === sectionId ? null : current));
  }, []);

  const handleSectionDrop = useCallback(
    ({ event, targetSectionId, onCrossSectionDrop }: SectionDropArgs) => {
      const ids = readDragCaseIds(event) ?? draggingIdsRef.current;
      const source = sourceSectionRef.current;
      if (!ids || ids.length === 0) {
        reset();
        return;
      }
      if (source === targetSectionId) {
        reset();
        return;
      }
      event.preventDefault();
      onCrossSectionDrop({
        caseIds: ids,
        sourceSectionId: source,
        targetSectionId,
        anchorCaseId: null,
        anchorPosition: null
      });
      reset();
    },
    [reset]
  );

  const handleAppendDragOver = useCallback(
    (event: DragEvent) => {
      if (!draggingIdsRef.current) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setHoveredAppendZone(true);
      setHoveredRow(null);
      setHoveredSectionId(null);
    },
    []
  );

  const handleAppendDragLeave = useCallback(() => {
    setHoveredAppendZone(false);
  }, []);

  const handleAppendDrop = useCallback(
    ({ event, currentSectionId, onSameSectionAppend, onCrossSectionDrop }: AppendDropArgs) => {
      const ids = readDragCaseIds(event) ?? draggingIdsRef.current;
      const source = sourceSectionRef.current;
      if (!ids || ids.length === 0) {
        reset();
        return;
      }
      event.preventDefault();
      if (source === currentSectionId) {
        onSameSectionAppend({ caseIds: ids, sectionId: currentSectionId });
      } else {
        onCrossSectionDrop({
          caseIds: ids,
          sourceSectionId: source,
          targetSectionId: currentSectionId,
          anchorCaseId: null,
          anchorPosition: null
        });
      }
      reset();
    },
    [reset]
  );

  return useMemo(
    () => ({
      isDragging,
      draggingCount,
      draggingCaseIds,
      sourceSectionId,
      hoveredRow,
      hoveredSectionId,
      hoveredAppendZone,
      startCaseDrag,
      endCaseDrag,
      handleRowDragOver,
      handleRowDragLeave,
      handleRowDrop,
      handleSectionDragOver,
      handleSectionDragLeave,
      handleSectionDrop,
      handleAppendDragOver,
      handleAppendDragLeave,
      handleAppendDrop,
      reset
    }),
    [
      draggingCaseIds,
      draggingCount,
      endCaseDrag,
      handleAppendDragLeave,
      handleAppendDragOver,
      handleAppendDrop,
      handleRowDragLeave,
      handleRowDragOver,
      handleRowDrop,
      handleSectionDragLeave,
      handleSectionDragOver,
      handleSectionDrop,
      hoveredAppendZone,
      hoveredRow,
      hoveredSectionId,
      isDragging,
      reset,
      sourceSectionId,
      startCaseDrag
    ]
  );
}

export type CaseListDnD = ReturnType<typeof useCaseListDnD>;
