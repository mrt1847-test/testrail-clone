import { AppError } from "../../common/errors/appError.js";

export const TESTRAIL_V2_DEFAULT_LIMIT = 250;
export const TESTRAIL_V2_MAX_LIMIT = 250;

export function parseTestRailPagination(query: Record<string, unknown>) {
  let limit = TESTRAIL_V2_DEFAULT_LIMIT;
  let offset = 0;

  if (query.limit !== undefined && query.limit !== "") {
    const parsed = Number(query.limit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > TESTRAIL_V2_MAX_LIMIT) {
      throw new AppError(
        "VALIDATION_ERROR",
        `limit must be an integer between 1 and ${TESTRAIL_V2_MAX_LIMIT}`,
        400
      );
    }
    limit = parsed;
  }

  if (query.offset !== undefined && query.offset !== "") {
    const parsed = Number(query.offset);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new AppError("VALIDATION_ERROR", "offset must be a non-negative integer", 400);
    }
    offset = parsed;
  }

  return { limit, offset };
}

export function testRailQuerySuffix(query: Record<string, unknown>) {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (key === "limit" || key === "offset") continue;
    if (value === undefined || value === null || value === "") continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length > 0 ? `&${parts.join("&")}` : "";
}

export function buildTestRailListResponse<T>(input: {
  items: T[];
  limit: number;
  offset: number;
  collectionKey: string;
  basePath: string;
  querySuffix?: string;
}) {
  const total = input.items.length;
  const page = input.items.slice(input.offset, input.offset + input.limit);
  const nextOffset = input.offset + input.limit;
  const prevOffset = Math.max(0, input.offset - input.limit);
  const suffix = input.querySuffix ?? "";

  return {
    offset: input.offset,
    limit: input.limit,
    size: page.length,
    _links: {
      next:
        nextOffset < total
          ? `${input.basePath}?limit=${input.limit}&offset=${nextOffset}${suffix}`
          : null,
      prev:
        input.offset > 0 ? `${input.basePath}?limit=${input.limit}&offset=${prevOffset}${suffix}` : null
    },
    [input.collectionKey]: page
  };
}
