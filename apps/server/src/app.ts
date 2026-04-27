import Fastify from "fastify";
import { env } from "./config/env.js";
import { handleRouteError } from "./common/middlewares/errorHandler.js";
import { registerCasesRoutes } from "./modules/cases/cases.routes.js";
import { CasesService } from "./modules/cases/cases.service.js";
import { registerProjectsRoutes } from "./modules/projects/projects.routes.js";
import { ProjectsMemoryRepository } from "./modules/projects/projects.memory.repository.js";
import { ProjectsService } from "./modules/projects/projects.service.js";
import { registerResultsRoutes } from "./modules/results/results.routes.js";
import { ResultsService } from "./modules/results/results.service.js";
import { registerRunsRoutes } from "./modules/runs/runs.routes.js";
import { InMemoryRunsRepository } from "./modules/runs/runs.repository.js";
import { PrismaRunsRepository } from "./modules/runs/runs.prisma.repository.js";
import { RunsService } from "./modules/runs/runs.service.js";
import { registerSectionsRoutes } from "./modules/sections/sections.routes.js";
import { SectionsService } from "./modules/sections/sections.service.js";
import { registerSuitesRoutes } from "./modules/suites/suites.routes.js";
import { SuitesService } from "./modules/suites/suites.service.js";
import { registerCors } from "./plugins/cors.js";
import { getPrismaClient } from "./db/prisma.js";

export function buildApp() {
  const app = Fastify({ logger: false });
  const catalogRepo = new ProjectsMemoryRepository();
  const repo = env.useInMemoryRepository
    ? new InMemoryRunsRepository(catalogRepo)
    : new PrismaRunsRepository(getPrismaClient());
  const runsService = new RunsService(repo);
  const resultsService = new ResultsService(repo);
  const projectsService = new ProjectsService(catalogRepo);
  const suitesService = new SuitesService(catalogRepo);
  const sectionsService = new SectionsService(catalogRepo);
  const casesService = new CasesService(catalogRepo);

  app.setErrorHandler((error, req, reply) => {
    handleRouteError(error, req, reply);
  });
  void registerCors(app);

  app.get("/api/health", async () => ({ status: "ok" }));
  void registerProjectsRoutes(app, { projectsService });
  void registerSuitesRoutes(app, { suitesService });
  void registerSectionsRoutes(app, { sectionsService });
  void registerCasesRoutes(app, { casesService });
  void registerRunsRoutes(app, { runsService, resultsService, repo });
  void registerResultsRoutes(app, { resultsService });

  return app;
}
