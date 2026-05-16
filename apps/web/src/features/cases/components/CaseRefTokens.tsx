import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { fetchReferenceUrls } from "../../projects/api/integrationsApi";
import { parseCaseRefs } from "../utils/caseRefs";

type CaseRefTokensProps = {
  refsValue: string;
  projectId?: string;
};

export function CaseRefTokens({ refsValue, projectId: projectIdProp }: CaseRefTokensProps) {
  const { projectId: routeProjectId = "" } = useParams();
  const projectId = projectIdProp ?? routeProjectId;
  const tokens = parseCaseRefs(refsValue);

  const urlsQuery = useQuery({
    queryKey: ["reference-urls", projectId, tokens.join("|")],
    queryFn: () => fetchReferenceUrls(projectId, tokens),
    enabled: Boolean(projectId) && tokens.length > 0,
    staleTime: 60_000
  });

  const urlByKey = new Map((urlsQuery.data?.items ?? []).map((item) => [item.key, item.url]));

  if (tokens.length === 0) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5">
      {tokens.map((token, index) => {
        const externalUrl = urlByKey.get(token);
        return (
          <span key={token}>
            {index > 0 ? <span className="text-slate-400">, </span> : null}
            {externalUrl ? (
              <a
                href={externalUrl}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-800 hover:underline"
                title="View reference"
              >
                {token}
              </a>
            ) : projectId ? (
              <Link
                to={`/projects/${projectId}/cases?q=${encodeURIComponent(token)}`}
                className="text-indigo-800 hover:underline"
              >
                {token}
              </Link>
            ) : (
              <span>{token}</span>
            )}
          </span>
        );
      })}
    </span>
  );
}
