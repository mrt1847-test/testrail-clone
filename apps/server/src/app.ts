import Fastify from "fastify";
import { env } from "./config/env.js";
import { handleRouteError } from "./common/middlewares/errorHandler.js";
import { registerCasesRoutes } from "./modules/cases/cases.routes.js";
import { CasesService } from "./modules/cases/cases.service.js";
import { registerProjectsRoutes } from "./modules/projects/projects.routes.js";
import { ProjectsMemoryRepository } from "./modules/projects/projects.memory.repository.js";
import { ProjectsPrismaRepository } from "./modules/projects/projects.prisma.repository.js";
import { ProjectsService } from "./modules/projects/projects.service.js";
import { registerResultsRoutes } from "./modules/results/results.routes.js";
import { ResultsService } from "./modules/results/results.service.js";
import { registerRunsRoutes } from "./modules/runs/runs.routes.js";
import { InMemoryRunsRepository } from "./modules/runs/runs.repository.js";
import { PrismaRunsRepository } from "./modules/runs/runs.prisma.repository.js";
import { RunCompositionSyncService } from "./modules/runs/runCompositionSync.service.js";
import { RunsService } from "./modules/runs/runs.service.js";
import { registerAutomationRoutes } from "./modules/automation/automation.routes.js";
import { registerBddRoutes } from "./modules/bdd/bdd.routes.js";
import { registerActivityRoutes } from "./modules/activity/activity.routes.js";
import { registerMilestonesRoutes } from "./modules/milestones/milestones.routes.js";
import { registerPlansRoutes } from "./modules/plans/plans.routes.js";
import { registerReportsRoutes } from "./modules/reports/reports.routes.js";
import { registerSavedReportsRoutes } from "./modules/reports/savedReports.routes.js";
import { registerScheduledReportsRoutes } from "./modules/reports/scheduledReports.routes.js";
import { registerRequirementsRoutes } from "./modules/requirements/requirements.routes.js";
import { registerSectionsRoutes } from "./modules/sections/sections.routes.js";
import { SectionsService } from "./modules/sections/sections.service.js";
import { registerSettingsRoutes } from "./modules/settings/settings.routes.js";
import { registerSuitesRoutes } from "./modules/suites/suites.routes.js";
import { SuitesService } from "./modules/suites/suites.service.js";
import { registerTokensRoutes } from "./modules/tokens/tokens.routes.js";
import { registerCors } from "./plugins/cors.js";
import { getPrismaClient } from "./db/prisma.js";
import { registerAuthRoutes } from "./modules/auth/auth.routes.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { registerIntegrationsRoutes } from "./modules/integrations/integrations.routes.js";
import { registerImportExportRoutes } from "./modules/importExport/importExport.routes.js";
import { registerTestRailRoutes } from "./modules/testrail/testrail.routes.js";
import { registerAdminAccessDefaultsRoutes } from "./modules/admin/accessDefaults.routes.js";
import { registerAdminUsersRoutes } from "./modules/admin/users.routes.js";
import { registerExecutionCommentsRoutes } from "./modules/executionComments/executionComments.routes.js";
import { registerPrintRoutes } from "./modules/print/print.routes.js";

export function buildApp() {
  const app = Fastify({ logger: false });
  const prisma = env.useInMemoryRepository ? undefined : getPrismaClient();
  const catalogRepo = env.useInMemoryRepository
    ? new ProjectsMemoryRepository()
    : new ProjectsPrismaRepository(prisma!);
  const repo = env.useInMemoryRepository
    ? new InMemoryRunsRepository(catalogRepo)
    : new PrismaRunsRepository(prisma!);
  const runsService = new RunsService(repo);
  const compositionSync = prisma ? new RunCompositionSyncService(prisma, runsService) : undefined;
  if (compositionSync) runsService.bindCompositionSync(compositionSync);
  const resultsService = new ResultsService(repo);
  const projectsService = new ProjectsService(catalogRepo);
  const suitesService = new SuitesService(catalogRepo);
  const sectionsService = new SectionsService(catalogRepo);
  const casesService = new CasesService(catalogRepo);
  const authService = new AuthService(prisma);

  app.setErrorHandler((error, req, reply) => {
    handleRouteError(error, req, reply);
  });
  void registerCors(app);

  app.get("/api/health", async () => ({ status: "ok" }));
  void registerAuthRoutes(app, { authService });
  void registerActivityRoutes(app, { authService, prisma });
  void registerProjectsRoutes(app, { projectsService, authService, prisma });
  void registerSuitesRoutes(app, { suitesService, authService, prisma });
  void registerSectionsRoutes(app, { sectionsService, authService, prisma });
  void registerCasesRoutes(app, { casesService, authService, prisma, compositionSync });
  void registerRunsRoutes(app, { runsService, resultsService, repo, authService, prisma });
  void registerResultsRoutes(app, { resultsService, prisma, authService });
  void registerExecutionCommentsRoutes(app, { authService, prisma });
  void registerAutomationRoutes(app, { prisma, catalog: catalogRepo, runsService, resultsService });
  void registerBddRoutes(app, { prisma, catalog: catalogRepo, casesService, authService });
  void registerReportsRoutes(app, { repo, prisma, catalog: catalogRepo });
  void registerSavedReportsRoutes(app, { prisma, authService });
  void registerScheduledReportsRoutes(app, { prisma, authService });
  void registerRequirementsRoutes(app, { prisma, authService });
  void registerIntegrationsRoutes(app, { prisma, authService });
  void registerImportExportRoutes(app, { prisma, authService });
  void registerTestRailRoutes(app, {
    authService,
    casesService,
    runsService,
    resultsService,
    catalog: catalogRepo,
    repo,
    prisma
  });
  void registerMilestonesRoutes(app, { prisma, authService });
  void registerPlansRoutes(app, { prisma, authService, runsService, catalog: catalogRepo });
  void registerPrintRoutes(app, { prisma, repo, casesService, authService, catalog: catalogRepo });
  void registerSettingsRoutes(app, { authService, prisma });
  void registerAdminAccessDefaultsRoutes(app, { authService, prisma });
  void registerAdminUsersRoutes(app, { authService, prisma });
  void registerTokensRoutes(app, { prisma, authService });

  return app;
}
