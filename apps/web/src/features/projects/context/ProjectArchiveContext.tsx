import { createContext, useContext, type ReactNode } from "react";

type ProjectArchiveContextValue = {
  isArchived: boolean;
};

const ProjectArchiveContext = createContext<ProjectArchiveContextValue>({ isArchived: false });

export function ProjectArchiveProvider({
  isArchived,
  children
}: {
  isArchived: boolean;
  children: ReactNode;
}) {
  return <ProjectArchiveContext.Provider value={{ isArchived }}>{children}</ProjectArchiveContext.Provider>;
}

export function useProjectArchived() {
  return useContext(ProjectArchiveContext).isArchived;
}
