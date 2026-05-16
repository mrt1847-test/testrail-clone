import { Link, useParams } from "react-router-dom";

import { useProjectArchived } from "../context/ProjectArchiveContext";

export function ArchivedProjectBanner() {
  const isArchived = useProjectArchived();
  const { projectId = "" } = useParams();
  if (!isArchived) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950" role="status">
      <p>
        This project is <span className="font-semibold">archived</span> and read-only. Restore it in{" "}
        <Link to={`/projects/${projectId}/settings`} className="font-medium underline">
          project settings
        </Link>{" "}
        to allow edits again.
      </p>
    </div>
  );
}
