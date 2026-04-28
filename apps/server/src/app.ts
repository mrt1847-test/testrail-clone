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
import { RunsService } from "./modules/runs/runs.service.js";
import { registerAutomationRoutes } from "./modules/automation/automation.routes.js";
import { registerMilestonesRoutes } from "./modules/milestones/milestones.routes.js";
import { registerPlansRoutes } from "./modules/plans/plans.routes.js";
import { registerReportsRoutes } from "./modules/reports/reports.routes.js";
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
  void registerProjectsRoutes(app, { projectsService, authService, prisma });
  void registerSuitesRoutes(app, { suitesService, authService, prisma });
  void registerSectionsRoutes(app, { sectionsService, authService, prisma });
  void registerCasesRoutes(app, { casesService, authService, prisma });
  void registerRunsRoutes(app, { runsService, resultsService, repo, authService, prisma });
  void registerResultsRoutes(app, { resultsService });
  void registerAutomationRoutes(app, { prisma });
  void registerReportsRoutes(app, { repo, prisma });
  void registerMilestonesRoutes(app, { prisma });
  void registerPlansRoutes(app, { prisma, runsService, catalog: catalogRepo });
  void registerSettingsRoutes(app, { authService, prisma });
  void registerTokensRoutes(app, { prisma });

  return app;
}
