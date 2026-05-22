import { Navigate, useParams } from "react-router-dom";

import { LoadingState } from "../../../shared/ui/LoadingState";
import { projectLandingPath } from "../workspacePreferences";
import { useWorkspacePreferences } from "../hooks/useWorkspacePreferences";
import { ProjectOverviewPage } from "./ProjectOverviewPage";

export function ProjectLandingPage() {
  const { projectId = "" } = useParams();
  const preferencesQuery = useWorkspacePreferences(projectId);

  if (preferencesQuery.isLoading) {
    return <LoadingState message="Loading project..." />;
  }

  const landingPage = preferencesQuery.data?.landingPage ?? "overview";
  if (landingPage !== "overview") {
    return <Navigate to={projectLandingPath(projectId, landingPage)} replace />;
  }

  return <ProjectOverviewPage />;
}
