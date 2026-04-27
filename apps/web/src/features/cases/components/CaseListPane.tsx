import { EmptyState } from "../../../shared/ui/EmptyState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { useCaseDetail } from "../hooks/useCaseDetail";
import { useCases } from "../hooks/useCases";
import { useExpandedCase } from "../hooks/useExpandedCase";
import { CaseListToolbar } from "./CaseListToolbar";
import { CaseRow } from "./CaseRow";

type CaseListPaneProps = {
  projectId: string;
};

export function CaseListPane({ projectId }: CaseListPaneProps) {
  const { selectedSectionId, expandedCaseId, mode, setExpandedCase } = useExpandedCase();
  const { data: cases = [], isLoading, isError, refetch } = useCases(projectId, selectedSectionId);
  const { data: caseDetailRemote } = useCaseDetail(expandedCaseId);

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <CaseListToolbar />
        <LoadingState message="Loading cases…" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <CaseListToolbar />
        <p className="text-sm text-red-700">케이스 목록을 불러오지 못했습니다.</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-2 text-sm font-medium text-slate-700 underline"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <CaseListToolbar />
      {cases.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="No test cases in this section"
            description="Add a case or pick another section."
            action={
              <button type="button" className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white">
                Add case
              </button>
            }
          />
        </div>
      ) : (
        <div>
          {cases.map((item) => {
            const isExpanded = expandedCaseId === item.id;
            const caseDetail = isExpanded ? (caseDetailRemote ?? item) : item;
            return (
              <CaseRow
                key={item.id}
                item={item}
                isExpanded={isExpanded}
                mode={mode}
                detail={caseDetail}
                onToggle={() => setExpandedCase(isExpanded ? null : item.id)}
                onEdit={() => setExpandedCase(item.id, "edit")}
                onCloseDetail={() => setExpandedCase(null)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
