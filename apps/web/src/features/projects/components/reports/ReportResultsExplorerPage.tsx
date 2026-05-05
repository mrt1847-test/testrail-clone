import { ResultExplorerPage } from "../../../runs/components/ResultExplorerPage";

export function ReportResultsExplorerPage() {
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">프로젝트 전체 결과 탐색입니다. 런 범위를 좁히려면 실행 상세의 결과 탭을 이용하세요.</p>
      <ResultExplorerPage />
    </div>
  );
}
