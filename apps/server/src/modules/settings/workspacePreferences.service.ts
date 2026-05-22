import type { PrismaClient } from "@prisma/client";

import {
  defaultWorkspacePreferences,
  type WorkspaceLandingPage,
  workspaceLandingPageSchema
} from "../../domain/workspacePreferences.js";

export type WorkspacePreferencesDto = {
  landingPage: WorkspaceLandingPage;
  defaultSuiteId: string | null;
  defaultSavedViewId: string | null;
};

type PreferenceRow = {
  landingPage: string;
  defaultSuiteId: bigint | null;
  defaultSavedViewId: string | null;
};

const inMemory = new Map<string, PreferenceRow>();

function memoryKey(userId: bigint, projectId: bigint) {
  return `${userId.toString()}:${projectId.toString()}`;
}

function normalizeLandingPage(value: string): WorkspaceLandingPage {
  const parsed = workspaceLandingPageSchema.safeParse(value);
  return parsed.success ? parsed.data : "overview";
}

function toDto(row: PreferenceRow): WorkspacePreferencesDto {
  return {
    landingPage: normalizeLandingPage(row.landingPage),
    defaultSuiteId: row.defaultSuiteId?.toString() ?? null,
    defaultSavedViewId: row.defaultSavedViewId
  };
}

export function getWorkspacePreferences(
  userId: bigint,
  projectId: bigint,
  prisma?: PrismaClient
): Promise<WorkspacePreferencesDto> {
  if (!prisma) {
    const row = inMemory.get(memoryKey(userId, projectId));
    return Promise.resolve(row ? toDto(row) : defaultWorkspacePreferences());
  }
  return prisma.userProjectPreference
    .findUnique({
      where: { userId_projectId: { userId, projectId } },
      select: {
        landingPage: true,
        defaultSuiteId: true,
        defaultSavedViewId: true
      }
    })
    .then((row) => (row ? toDto(row) : defaultWorkspacePreferences()));
}

export async function upsertWorkspacePreferences(
  userId: bigint,
  projectId: bigint,
  input: {
    landingPage?: WorkspaceLandingPage;
    defaultSuiteId?: string | null;
    defaultSavedViewId?: string | null;
  },
  prisma?: PrismaClient
): Promise<WorkspacePreferencesDto> {
  if (!prisma) {
    const key = memoryKey(userId, projectId);
    const current = inMemory.get(key) ?? {
      landingPage: "overview",
      defaultSuiteId: null,
      defaultSavedViewId: null
    };
    const next: PreferenceRow = {
      landingPage: input.landingPage ?? current.landingPage,
      defaultSuiteId:
        input.defaultSuiteId !== undefined
          ? input.defaultSuiteId
            ? BigInt(input.defaultSuiteId)
            : null
          : current.defaultSuiteId,
      defaultSavedViewId:
        input.defaultSavedViewId !== undefined ? input.defaultSavedViewId : current.defaultSavedViewId
    };
    inMemory.set(key, next);
    return toDto(next);
  }

  if (input.defaultSuiteId) {
    const suite = await prisma.testSuite.findFirst({
      where: { id: BigInt(input.defaultSuiteId), projectId, deletedAt: null },
      select: { id: true }
    });
    if (!suite) {
      throw new Error("INVALID_DEFAULT_SUITE");
    }
  }

  const row = await prisma.userProjectPreference.upsert({
    where: { userId_projectId: { userId, projectId } },
    create: {
      userId,
      projectId,
      landingPage: input.landingPage ?? "overview",
      defaultSuiteId: input.defaultSuiteId ? BigInt(input.defaultSuiteId) : null,
      defaultSavedViewId: input.defaultSavedViewId ?? null
    },
    update: {
      ...(input.landingPage !== undefined ? { landingPage: input.landingPage } : {}),
      ...(input.defaultSuiteId !== undefined
        ? { defaultSuiteId: input.defaultSuiteId ? BigInt(input.defaultSuiteId) : null }
        : {}),
      ...(input.defaultSavedViewId !== undefined ? { defaultSavedViewId: input.defaultSavedViewId } : {})
    },
    select: {
      landingPage: true,
      defaultSuiteId: true,
      defaultSavedViewId: true
    }
  });
  return toDto(row);
}
