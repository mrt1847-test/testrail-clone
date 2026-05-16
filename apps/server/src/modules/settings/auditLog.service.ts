import type { Prisma, PrismaClient } from "@prisma/client";

type AuditInput = {
  projectId: bigint | null;
  actorUserId?: bigint | null;
  action: string;
  entityType: string;
  entityId: bigint | string;
  changes?: Prisma.InputJsonValue | null;
};

export async function recordAuditLog(prisma: PrismaClient | undefined, input: AuditInput) {
  if (!prisma) return;
  await prisma.auditLog.create({
    data: {
      projectId: input.projectId,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId.toString(),
      changes: input.changes ?? undefined
    }
  });
}
