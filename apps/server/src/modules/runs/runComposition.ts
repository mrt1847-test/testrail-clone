import { z } from "zod";

export const compositionModeSchema = z.enum(["static", "include_all_live", "dynamic_filter"]);
export type CompositionMode = z.infer<typeof compositionModeSchema>;

export const runCaseFilterSchema = z.object({
  priority: z.enum(["low", "medium", "high"]).optional(),
  state: z.enum(["active", "archived"]).optional(),
  includedSectionIds: z.array(z.string()).optional()
});

export type RunCaseFilterDefinition = z.infer<typeof runCaseFilterSchema>;

export type RunCompositionMetadata = {
  compositionMode: CompositionMode;
  filterDefinition?: RunCaseFilterDefinition;
  excludedCaseIds?: string[];
  excludedSectionIds?: string[];
  includedSectionIds?: string[];
  lastSyncedAt?: string;
  lastSyncAdded?: number;
  lastSyncRemoved?: number;
};

export function defaultCompositionMetadata(_includeAll: boolean, mode?: CompositionMode): RunCompositionMetadata {
  if (mode) return { compositionMode: mode };
  return { compositionMode: "static" };
}

export function parseRunCompositionMetadata(value: unknown): RunCompositionMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const modeParsed = compositionModeSchema.safeParse(row.compositionMode);
  if (!modeParsed.success) return null;
  const filterParsed = row.filterDefinition != null ? runCaseFilterSchema.safeParse(row.filterDefinition) : null;
  return {
    compositionMode: modeParsed.data,
    ...(filterParsed?.success ? { filterDefinition: filterParsed.data } : {}),
    excludedCaseIds: stringArray(row.excludedCaseIds),
    excludedSectionIds: stringArray(row.excludedSectionIds),
    includedSectionIds: stringArray(row.includedSectionIds),
    lastSyncedAt: typeof row.lastSyncedAt === "string" ? row.lastSyncedAt : undefined,
    lastSyncAdded: typeof row.lastSyncAdded === "number" ? row.lastSyncAdded : undefined,
    lastSyncRemoved: typeof row.lastSyncRemoved === "number" ? row.lastSyncRemoved : undefined
  };
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string");
}

export function compositionNeedsLiveSync(meta: RunCompositionMetadata | null): boolean {
  if (!meta) return false;
  return meta.compositionMode === "include_all_live" || meta.compositionMode === "dynamic_filter";
}

export function toMetadataJson(meta: RunCompositionMetadata): Record<string, unknown> {
  return { ...meta };
}
