export type ActivityDrilldownStatus = "passed" | "failed";

function dayBoundsIso(date: string) {
  return {
    createdFrom: `${date}T00:00:00.000Z`,
    createdTo: `${date}T23:59:59.999Z`
  };
}

/** Overview activity chart → runs (status) or results (date). */
export function buildActivityDrilldownHref(
  projectId: string,
  input: { date?: string; status?: ActivityDrilldownStatus }
) {
  const base = `/projects/${projectId}`;
  if (input.date) {
    const { createdFrom, createdTo } = dayBoundsIso(input.date);
    const params = new URLSearchParams({ createdFrom, createdTo });
    if (input.status) params.set("status", input.status);
    return `${base}/results?${params.toString()}`;
  }
  if (input.status) {
    return `${base}/runs?resultStatus=${input.status}`;
  }
  return `${base}/runs`;
}
