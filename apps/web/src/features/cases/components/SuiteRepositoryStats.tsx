type Props = {
  sectionCount: number;
  caseCount: number | null;
  archivedCaseCount?: number | null;
  isLoading?: boolean;
};

export function SuiteRepositoryStats({
  sectionCount,
  caseCount,
  archivedCaseCount = null,
  isLoading = false
}: Props) {
  return (
    <p className="text-xs leading-relaxed text-slate-600">
      Contains{" "}
      <span className="font-medium text-slate-800">
        {sectionCount} section{sectionCount === 1 ? "" : "s"}
      </span>
      {isLoading ? (
        <span className="text-slate-500"> · loading cases…</span>
      ) : caseCount != null ? (
        <>
          {" "}
          and{" "}
          <span className="font-medium text-slate-800">
            {caseCount} case{caseCount === 1 ? "" : "s"}
          </span>
        </>
      ) : null}
      {!isLoading && archivedCaseCount != null && archivedCaseCount > 0 ? (
        <span className="text-slate-500">
          {" "}
          ({archivedCaseCount} archived)
        </span>
      ) : null}
      .
    </p>
  );
}
