import { ResultExplorerPage } from "../../../runs/components/ResultExplorerPage";
import { ReportPageHeader } from "./ReportChrome";

export function ReportResultsExplorerPage() {
  return (
    <div className="space-y-3">
      <ReportPageHeader
        title="Results explorer"
        description="프로젝트 전체 결과를 필터·검색합니다. 특정 런만 보려면 실행 상세 화면에서 해당 런을 여세요."
      />
      <ResultExplorerPage />
    </div>
  );
}
