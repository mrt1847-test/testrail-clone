import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "../../../shared/api/http";
import type { Ok } from "../../../shared/api/types";
import type { CustomStatusRow } from "../../projects/api/settingsApi";
import { defaultProjectStatusOptions, toProjectStatusOptions } from "../utils/projectStatuses";

export const projectStatusKeys = {
  all: (projectId: string) => ["project-statuses", projectId] as const
};

async function fetchProjectStatuses(projectId: string): Promise<CustomStatusRow[]> {
  const res = await apiFetch<Ok<CustomStatusRow[]>>(`/api/projects/${projectId}/statuses`);
  return res.data;
}

export function useProjectStatuses(projectId: string | undefined) {
  return useQuery({
    queryKey: projectStatusKeys.all(projectId ?? ""),
    queryFn: async () => {
      const rows = await fetchProjectStatuses(projectId!);
      return toProjectStatusOptions(rows);
    },
    enabled: Boolean(projectId),
    placeholderData: defaultProjectStatusOptions()
  });
}
