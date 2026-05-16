import type { Prisma, PrismaClient } from "@prisma/client";

import type { ProjectType } from "../../domain/projectTypes.js";
import { shouldTreatAsMasterSuite } from "../../domain/projectTypes.js";

type BootstrapClient = PrismaClient | Prisma.TransactionClient;

export async function bootstrapProjectCatalog(
  client: BootstrapClient,
  input: {
    projectId: bigint;
    projectType: ProjectType;
    actorUserId?: bigint;
  }
) {
  const suiteName =
    input.projectType === "multi_suite" ? "Suite 1" : "Master";
  const suite = await client.testSuite.create({
    data: {
      projectId: input.projectId,
      name: suiteName,
      description: null,
      isMaster: shouldTreatAsMasterSuite(input.projectType, []),
      isBaseline: false,
      ...(input.actorUserId !== undefined ? { createdBy: input.actorUserId, updatedBy: input.actorUserId } : {})
    },
    select: { id: true }
  });
  await client.section.create({
    data: {
      suiteId: suite.id,
      name: "General",
      displayOrder: 0,
      ...(input.actorUserId !== undefined ? { createdBy: input.actorUserId, updatedBy: input.actorUserId } : {})
    }
  });
  return suite;
}
