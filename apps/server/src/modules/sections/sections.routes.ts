import type { FastifyInstance } from "fastify";
import { getAuthenticatedUser, requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import type { AuthService } from "../auth/auth.service.js";
import type { PrismaClient } from "@prisma/client";
import { paginationQuerySchema } from "../../common/types/pagination.js";
import { ok, paged } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import { recordActivityEvent } from "../activity/activity.service.js";
import { SectionsService } from "./sections.service.js";
import {
  copySectionSchema,
  createSectionSchema,
  reorderSectionsSchema,
  sectionIdParamSchema,
  suiteIdParamSchema,
  updateSectionSchema
} from "./sections.schema.js";

export async function registerSectionsRoutes(
  app: FastifyInstance,
  deps: { sectionsService: SectionsService; authService: AuthService; prisma?: PrismaClient }
) {
  app.get("/api/suites/:suiteId/sections", async (req, reply) => {
    const { suiteId } = suiteIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    const items = await deps.sectionsService.listSections(suiteId);
    return reply.send(toJsonSafe(paged(items, page, pageSize)));
  });

  app.post("/api/suites/:suiteId/sections", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { suiteId } = suiteIdParamSchema.parse(req.params);
    const raw = (req.body ?? {}) as Record<string, unknown>;
    const body = createSectionSchema.parse({
      suiteId,
      parentSectionId: raw.parentSectionId,
      name: raw.name
    });
    const created = await deps.sectionsService.createSection(body);
    if (deps.prisma) {
      const suite = await deps.prisma.testSuite.findFirst({
        where: { id: suiteId, deletedAt: null },
        select: { projectId: true }
      });
      if (suite) {
        await recordActivityEvent(deps.prisma, {
          projectId: suite.projectId,
          actorUserId: user.id,
          entityType: "section",
          entityId: created.id,
          eventType: "section.created",
          title: "Section created",
          body: created.name,
          payload: {
            sectionId: created.id.toString(),
            suiteId: suiteId.toString(),
            parentSectionId: created.parentSectionId?.toString() ?? null,
            name: created.name
          }
        });
      }
    }
    return reply.send(toJsonSafe(ok(created)));
  });

  app.post("/api/suites/:suiteId/sections/reorder", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { suiteId } = suiteIdParamSchema.parse(req.params);
    const body = reorderSectionsSchema.parse(req.body ?? {});
    const result = await deps.sectionsService.reorderSectionsInParent(suiteId, body.parentSectionId ?? null, body.orderedSectionIds);
    if (deps.prisma) {
      const suite = await deps.prisma.testSuite.findFirst({
        where: { id: suiteId, deletedAt: null },
        select: { projectId: true }
      });
      if (suite) {
        await recordActivityEvent(deps.prisma, {
          projectId: suite.projectId,
          actorUserId: user.id,
          entityType: "section",
          entityId: `reorder:${suiteId.toString()}`,
          eventType: "section.reordered",
          title: "Sections reordered",
          body: `${result.updated} section${result.updated === 1 ? "" : "s"} ordered`,
          payload: {
            suiteId: suiteId.toString(),
            parentSectionId: result.parentSectionId?.toString() ?? null,
            orderedSectionIds: result.orderedSectionIds.map((sectionId) => sectionId.toString())
          }
        });
      }
    }
    return reply.send(toJsonSafe(ok(result)));
  });

  app.patch("/api/sections/:sectionId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { sectionId } = sectionIdParamSchema.parse(req.params);
    const body = updateSectionSchema.parse(req.body);
    const previous = deps.prisma
      ? await deps.prisma.section.findFirst({
          where: { id: sectionId, deletedAt: null },
          select: { name: true, parentSectionId: true, suite: { select: { projectId: true } } }
        })
      : null;
    const updated = await deps.sectionsService.updateSection(sectionId, body);
    const parentChanged =
      body.parentSectionId !== undefined && (previous?.parentSectionId ?? null) !== (updated.parentSectionId ?? null);
    const nameChanged = body.name !== undefined && previous?.name !== updated.name;
    if (deps.prisma && previous && parentChanged) {
      await recordActivityEvent(deps.prisma, {
        projectId: previous.suite.projectId,
        actorUserId: user.id,
        entityType: "section",
        entityId: sectionId,
        eventType: "section.moved",
        title: "Section moved",
        body: updated.name,
        payload: {
          sectionId: sectionId.toString(),
          previousParentSectionId: previous.parentSectionId?.toString() ?? null,
          parentSectionId: updated.parentSectionId?.toString() ?? null
        }
      });
    }
    if (deps.prisma && previous && nameChanged) {
      await recordActivityEvent(deps.prisma, {
        projectId: previous.suite.projectId,
        actorUserId: user.id,
        entityType: "section",
        entityId: sectionId,
        eventType: "section.updated",
        title: "Section renamed",
        body: updated.name,
        payload: {
          sectionId: sectionId.toString(),
          previousName: previous.name,
          name: updated.name
        }
      });
    }
    return reply.send(toJsonSafe(ok(updated)));
  });

  app.post("/api/sections/:sectionId/copy", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { sectionId } = sectionIdParamSchema.parse(req.params);
    const body = copySectionSchema.parse(req.body ?? {});
    const result = await deps.sectionsService.copySectionSubtree(sectionId, body);

    if (deps.prisma) {
      const source = await deps.prisma.section.findFirst({
        where: { id: sectionId, deletedAt: null },
        select: { suite: { select: { projectId: true } } }
      });
      if (source) {
        await recordActivityEvent(deps.prisma, {
          projectId: source.suite.projectId,
          actorUserId: user.id,
          entityType: "section",
          entityId: result.copiedSectionId,
          eventType: "section.copied",
          title: "Section subtree copied",
          body: `${result.sectionIdMap.length} section${result.sectionIdMap.length === 1 ? "" : "s"} and ${result.caseIdMap.length} test case${result.caseIdMap.length === 1 ? "" : "s"} copied`,
          payload: {
            sourceSectionId: result.sourceSectionId.toString(),
            copiedSectionId: result.copiedSectionId.toString(),
            targetParentSectionId: result.targetParentSectionId?.toString() ?? null,
            sectionIdMap: result.sectionIdMap.map((item) => ({
              sourceSectionId: item.sourceSectionId.toString(),
              copiedSectionId: item.copiedSectionId.toString()
            })),
            caseIdMap: result.caseIdMap.map((item) => ({
              sourceCaseId: item.sourceCaseId.toString(),
              copiedCaseId: item.copiedCaseId.toString()
            }))
          }
        });
      }
    }

    return reply.send(toJsonSafe(ok(result)));
  });

  app.delete("/api/sections/:sectionId", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { sectionId } = sectionIdParamSchema.parse(req.params);
    const snapshot = deps.prisma
      ? await deps.prisma.section.findFirst({
          where: { id: sectionId, deletedAt: null },
          select: {
            name: true,
            parentSectionId: true,
            suiteId: true,
            suite: { select: { projectId: true } }
          }
        })
      : null;
    await deps.sectionsService.deleteSection(sectionId);
    if (deps.prisma && snapshot) {
      await recordActivityEvent(deps.prisma, {
        projectId: snapshot.suite.projectId,
        actorUserId: user.id,
        entityType: "section",
        entityId: sectionId,
        eventType: "section.deleted",
        title: "Section deleted",
        body: snapshot.name,
        payload: {
          sectionId: sectionId.toString(),
          suiteId: snapshot.suiteId.toString(),
          parentSectionId: snapshot.parentSectionId?.toString() ?? null,
          name: snapshot.name
        }
      });
    }
    return reply.status(204).send();
  });
}
