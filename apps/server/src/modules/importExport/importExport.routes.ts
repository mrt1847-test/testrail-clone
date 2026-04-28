import type { FastifyInstance } from "fastify";
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";

import { AppError } from "../../common/errors/appError.js";
import { getAuthenticatedUser, requireProjectMutationRole } from "../../common/middlewares/authorization.js";
import { paginationQuerySchema } from "../../common/types/pagination.js";
import { ok } from "../../common/utils/http.js";
import { toJsonSafe } from "../../common/utils/serialize.js";
import type { AuthService } from "../auth/auth.service.js";
import { projectIdParamSchema } from "../projects/projects.schema.js";
import { runIdParamSchema } from "../runs/runs.schema.js";

type CsvRow = Record<string, string>;
type ImportIssue = { row: number; field?: string; code: string; message: string };

const caseImportSchema = z.object({
  csv: z.string().min(1),
  dryRun: z.boolean().optional().default(true),
  atomic: z.boolean().optional().default(true),
  sectionId: z.coerce.bigint().optional()
});

const reportExportSchema = z.object({
  reportType: z.enum(["run_summary", "results_explorer", "traceability", "coverage_gap", "defect_coverage"]).default("results_explorer"),
  format: z.enum(["csv"]).default("csv"),
  runId: z.coerce.bigint().optional(),
  caseId: z.coerce.bigint().optional(),
  testId: z.coerce.bigint().optional(),
  status: z.enum(["passed", "failed", "blocked", "retest", "untested"]).optional(),
  source: z.enum(["manual", "automation", "api"]).optional(),
  createdFrom: z.string().datetime().optional(),
  createdTo: z.string().datetime().optional(),
  q: z.string().trim().min(1).optional(),
  maxRows: z.coerce.number().int().min(1).max(50000).default(10000)
});

const exportJobIdParamSchema = z.object({
  jobId: z.coerce.bigint()
});

function parseCsv(input: string): CsvRow[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    const next = input[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  row.push(field);
  rows.push(row);

  const [headerRaw, ...body] = rows.filter((r) => r.some((cell) => cell.trim().length > 0));
  if (!headerRaw) return [];
  const headers = headerRaw.map((h) => h.trim());
  return body.map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, (cells[index] ?? "").trim()]))
  );
}

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))
  ].join("\n");
}

function normalizeReportFilters(input: z.infer<typeof reportExportSchema>) {
  return {
    reportType: input.reportType,
    format: input.format,
    ...(input.runId ? { runId: input.runId.toString() } : {}),
    ...(input.caseId ? { caseId: input.caseId.toString() } : {}),
    ...(input.testId ? { testId: input.testId.toString() } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.source ? { source: input.source } : {}),
    ...(input.createdFrom ? { createdFrom: input.createdFrom } : {}),
    ...(input.createdTo ? { createdTo: input.createdTo } : {}),
    ...(input.q ? { q: input.q } : {}),
    maxRows: input.maxRows
  };
}

function parseReportFilters(value: Prisma.JsonValue | null | undefined) {
  const raw = typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
  return reportExportSchema.parse(raw);
}

function firstValue(row: CsvRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value && value.length > 0) return value;
  }
  return undefined;
}

function splitList(value?: string) {
  return value ? value.split(/[|;]/).map((item) => item.trim()).filter(Boolean) : [];
}

async function resolveDefaultSection(prisma: PrismaClient, projectId: bigint) {
  const row = await prisma.section.findFirst({
    where: { suite: { projectId }, deletedAt: null },
    orderBy: { id: "asc" },
    select: { id: true }
  });
  return row?.id;
}

async function buildReportExport(prisma: PrismaClient, projectId: bigint, input: z.infer<typeof reportExportSchema>) {
  if (input.reportType === "run_summary") {
    const runs = await prisma.testRun.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { id: "asc" },
      take: input.maxRows,
      include: { instances: { where: { deletedAt: null }, select: { status: true } } }
    });
    const rows = runs.map((run) => {
      const total = run.instances.length;
      const untested = run.instances.filter((item) => item.status === "untested").length;
      const passed = run.instances.filter((item) => item.status === "passed").length;
      const failed = run.instances.filter((item) => item.status === "failed").length;
      return {
        run_id: run.id,
        name: run.name,
        status: run.status,
        total,
        passed,
        failed,
        progress: total === 0 ? 0 : Math.round(((total - untested) / total) * 100)
      };
    });
    return {
      fileName: `project-${projectId.toString()}-run-summary.csv`,
      csv: toCsv(["run_id", "name", "status", "total", "passed", "failed", "progress"], rows),
      totalRows: rows.length
    };
  }

  if (input.reportType === "results_explorer") {
    const where: Prisma.TestResultWhereInput = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.source ? { source: input.source } : {}),
      ...(input.testId ? { testInstanceId: input.testId } : {}),
      ...((input.createdFrom || input.createdTo)
        ? {
            createdAt: {
              ...(input.createdFrom ? { gte: new Date(input.createdFrom) } : {}),
              ...(input.createdTo ? { lte: new Date(input.createdTo) } : {})
            }
          }
        : {}),
      instance: {
        ...(input.runId ? { runId: input.runId } : {}),
        ...(input.caseId ? { caseId: input.caseId } : {}),
        run: { projectId, deletedAt: null },
        ...(input.q
          ? {
              OR: [
                { titleSnapshot: { contains: input.q, mode: "insensitive" } },
                ...(input.q.match(/^c\d+$/i) ? [{ caseId: BigInt(input.q.replace(/^c/i, "")) }] : [])
              ]
            }
          : {})
      }
    };
    const rows = await prisma.testResult.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: input.maxRows,
      include: { instance: { include: { run: true } }, defectLinks: { where: { deletedAt: null } } }
    });
    return {
      fileName: `project-${projectId.toString()}-results-explorer.csv`,
      csv: toCsv(
        ["result_id", "run_id", "run_name", "test_id", "case_id", "title", "status", "source", "comment", "defects", "created_at"],
        rows.map((row) => ({
          result_id: row.id,
          run_id: row.instance.runId,
          run_name: row.instance.run.name,
          test_id: row.testInstanceId,
          case_id: row.instance.caseId,
          title: row.instance.titleSnapshot,
          status: row.status,
          source: row.source,
          comment: row.comment,
          defects: [...row.defects, ...row.defectLinks.map((link) => link.defectKey)].join("|"),
          created_at: row.createdAt.toISOString()
        }))
      ),
      totalRows: rows.length
    };
  }

  const requirements = await prisma.requirement.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { id: "asc" },
    take: input.maxRows,
    include: {
      caseLinks: {
        include: {
          testCase: {
            select: {
              id: true,
              title: true,
              instances: {
                where: { run: { projectId, deletedAt: null } },
                include: {
                  run: { select: { id: true, name: true } },
                  results: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    include: { defectLinks: { where: { deletedAt: null }, select: { defectKey: true } } }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  if (input.reportType === "traceability") {
    const rows = requirements.flatMap((reqRow) =>
      reqRow.caseLinks.map((link) => {
        const latest = link.testCase.instances
          .map((inst) => ({ runId: inst.run.id, runName: inst.run.name, testId: inst.id, result: inst.results[0] }))
          .filter((row) => row.result)
          .sort((a, b) => +b.result!.createdAt - +a.result!.createdAt)[0];
        return {
          requirement_id: reqRow.id,
          requirement_key: reqRow.key,
          requirement_title: reqRow.title,
          case_id: link.testCase.id,
          case_title: link.testCase.title,
          run_id: latest?.runId ?? "",
          run_name: latest?.runName ?? "",
          test_id: latest?.testId ?? "",
          latest_status: latest?.result?.status ?? "untested",
          latest_result_at: latest?.result?.createdAt?.toISOString() ?? "",
          defects: latest?.result?.defectLinks.map((d) => d.defectKey).join("|") ?? ""
        };
      })
    );
    return {
      fileName: `project-${projectId.toString()}-traceability.csv`,
      csv: toCsv(
        ["requirement_id", "requirement_key", "requirement_title", "case_id", "case_title", "run_id", "run_name", "test_id", "latest_status", "latest_result_at", "defects"],
        rows
      ),
      totalRows: rows.length
    };
  }

  if (input.reportType === "coverage_gap") {
    const rows = requirements.map((reqRow) => {
      const latestStatuses = reqRow.caseLinks.map((link) => {
        const latest = link.testCase.instances
          .map((inst) => inst.results[0])
          .filter(Boolean)
          .sort((a, b) => +b!.createdAt - +a!.createdAt)[0];
        return latest?.status ?? "untested";
      });
      const hasAtRisk = latestStatuses.some((status) => status === "failed" || status === "blocked" || status === "retest");
      const hasTested = latestStatuses.some((status) => status === "passed");
      return {
        requirement_id: reqRow.id,
        requirement_key: reqRow.key,
        requirement_title: reqRow.title,
        coverage_status: reqRow.caseLinks.length === 0 ? "uncovered" : hasAtRisk ? "at_risk" : hasTested ? "covered" : "untested",
        linked_case_count: reqRow.caseLinks.length,
        latest_statuses: latestStatuses.join("|")
      };
    });
    return {
      fileName: `project-${projectId.toString()}-coverage-gap.csv`,
      csv: toCsv(["requirement_id", "requirement_key", "requirement_title", "coverage_status", "linked_case_count", "latest_statuses"], rows),
      totalRows: rows.length
    };
  }

  const rows = requirements.map((reqRow) => {
    const latestResults = reqRow.caseLinks
      .map((link) => {
        const latest = link.testCase.instances
          .map((inst) => inst.results[0])
          .filter(Boolean)
          .sort((a, b) => +b!.createdAt - +a!.createdAt)[0];
        return latest ?? null;
      })
      .filter(Boolean);
    const atRiskResults = latestResults.filter((result) => result.status === "failed" || result.status === "blocked" || result.status === "retest");
    const defectKeys = Array.from(new Set(atRiskResults.flatMap((result) => result.defectLinks.map((d) => d.defectKey).filter(Boolean))));
    return {
      requirement_id: reqRow.id,
      requirement_key: reqRow.key,
      requirement_title: reqRow.title,
      linked_case_count: reqRow.caseLinks.length,
      at_risk_result_count: atRiskResults.length,
      linked_defect_count: defectKeys.length,
      defect_keys: defectKeys.join("|"),
      defect_coverage: atRiskResults.length === 0 ? "not_applicable" : defectKeys.length > 0 ? "linked" : "unlinked"
    };
  });
  return {
    fileName: `project-${projectId.toString()}-defect-coverage.csv`,
    csv: toCsv(["requirement_id", "requirement_key", "requirement_title", "linked_case_count", "at_risk_result_count", "linked_defect_count", "defect_keys", "defect_coverage"], rows),
    totalRows: rows.length
  };
}

async function validateImportRows(prisma: PrismaClient, projectId: bigint, rows: CsvRow[], fallbackSectionId?: bigint) {
  const issues: ImportIssue[] = [];
  const normalized: Array<{
    rowNumber: number;
    sectionId: bigint;
    title: string;
    preconditions?: string;
    priority?: string;
    caseType?: string;
    refs?: string;
    labels: string[];
    automationKey?: string;
    externalId?: string;
    steps: Array<{ content: string; expectedResult?: string | null }>;
  }> = [];

  const defaultSectionId = fallbackSectionId ?? (await resolveDefaultSection(prisma, projectId));
  const sectionIds = new Set(
    (
      await prisma.section.findMany({
        where: { suite: { projectId }, deletedAt: null },
        select: { id: true }
      })
    ).map((row) => row.id.toString())
  );

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const title = firstValue(row, ["title", "Title"]);
    const rawSectionId = firstValue(row, ["section_id", "sectionId", "Section ID"]);
    const sectionId = rawSectionId ? BigInt(rawSectionId) : defaultSectionId;

    if (!title) {
      issues.push({ row: rowNumber, field: "title", code: "REQUIRED", message: "title is required" });
    }
    if (!sectionId) {
      issues.push({ row: rowNumber, field: "section_id", code: "REQUIRED", message: "section_id is required when the project has no default section" });
      return;
    }
    if (!sectionIds.has(sectionId.toString())) {
      issues.push({ row: rowNumber, field: "section_id", code: "INVALID_SECTION", message: `section ${sectionId.toString()} is not in this project` });
    }
    if (!title || !sectionIds.has(sectionId.toString())) return;

    const steps = splitList(firstValue(row, ["steps", "Steps"])).map((step) => {
      const [content, expected] = step.split("=>").map((part) => part.trim());
      return { content: content ?? step, expectedResult: expected || null };
    });

    normalized.push({
      rowNumber,
      sectionId,
      title,
      preconditions: firstValue(row, ["preconditions", "Preconditions"]),
      priority: firstValue(row, ["priority", "Priority"]),
      caseType: firstValue(row, ["type", "case_type", "caseType", "Type"]),
      refs: firstValue(row, ["refs", "references", "References"]),
      labels: splitList(firstValue(row, ["labels", "Labels"])),
      automationKey: firstValue(row, ["automation_key", "automationKey"]),
      externalId: firstValue(row, ["external_id", "externalId"]),
      steps
    });
  });

  return { issues, normalized };
}

export async function registerImportExportRoutes(
  app: FastifyInstance,
  deps: { prisma?: PrismaClient; authService: AuthService }
) {
  app.post("/api/projects/:projectId/cases/import/csv", async (req, reply) => {
    await requireProjectMutationRole(req, deps);
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = caseImportSchema.parse(req.body ?? {});
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "case import requires prisma mode", 501);

    const rows = parseCsv(body.csv);
    const { issues, normalized } = await validateImportRows(deps.prisma, projectId, rows, body.sectionId);
    const summary = { totalRows: rows.length, validRows: normalized.length, invalidRows: issues.length, imported: 0 };

    if (body.dryRun || (body.atomic && issues.length > 0)) {
      const job = await deps.prisma.importJob.create({
        data: {
          projectId,
          type: "cases_csv",
          status: issues.length > 0 ? "failed" : "completed",
          dryRun: body.dryRun,
          summary: summary as Prisma.InputJsonValue,
          errors: issues as Prisma.InputJsonValue,
          createdBy: user.id
        }
      });
      const status = !body.dryRun && body.atomic && issues.length > 0 ? 400 : 200;
      return reply.status(status).send(toJsonSafe(ok({ job, summary, issues })));
    }

    const imported = await deps.prisma.$transaction(async (tx) => {
      const created = [];
      for (const item of normalized) {
        const section = await tx.section.findUnique({
          where: { id: item.sectionId },
          select: { suiteId: true, suite: { select: { projectId: true } } }
        });
        if (!section || section.suite.projectId !== projectId) continue;
        const testCase = await tx.testCase.create({
          data: {
            projectId,
            suiteId: section.suiteId,
            sectionId: item.sectionId,
            title: item.title,
            preconditions: item.preconditions,
            priority: item.priority,
            caseType: item.caseType,
            refs: item.refs,
            labels: item.labels,
            automationKey: item.automationKey,
            externalId: item.externalId,
            createdBy: user.id,
            updatedBy: user.id,
            steps: {
              create: item.steps.map((step, index) => ({
                stepOrder: index + 1,
                content: step.content,
                expectedResult: step.expectedResult
              }))
            }
          }
        });
        await tx.testCaseVersion.create({
          data: {
            caseId: testCase.id,
            versionNo: 1,
            title: item.title,
            priority: item.priority,
            caseType: item.caseType,
            preconditions: item.preconditions,
            stepsSnapshot: item.steps.map((step, index) => ({ stepOrder: index + 1, ...step })) as Prisma.InputJsonValue,
            changeReason: "csv_import"
          }
        });
        created.push(testCase.id);
      }
      return created;
    });

    summary.imported = imported.length;
    const job = await deps.prisma.importJob.create({
      data: {
        projectId,
        type: "cases_csv",
        status: issues.length > 0 ? "completed_with_errors" : "completed",
        dryRun: false,
        summary: summary as Prisma.InputJsonValue,
        errors: issues as Prisma.InputJsonValue,
        createdBy: user.id
      }
    });
    return reply.send(toJsonSafe(ok({ job, summary, issues })));
  });

  app.get("/api/projects/:projectId/import-jobs", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    if (!deps.prisma) return reply.send(toJsonSafe({ data: [], page, pageSize, total: 0, totalPages: 1 }));
    const where = { projectId };
    const [rows, total] = await deps.prisma.$transaction([
      deps.prisma.importJob.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      deps.prisma.importJob.count({ where })
    ]);
    return reply.send(toJsonSafe({ data: rows, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }));
  });

  app.get("/api/projects/:projectId/export-jobs", async (req, reply) => {
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { page, pageSize } = paginationQuerySchema.parse(req.query ?? {});
    if (!deps.prisma) return reply.send(toJsonSafe({ data: [], page, pageSize, total: 0, totalPages: 1 }));
    const where = { projectId };
    const [rows, total] = await deps.prisma.$transaction([
      deps.prisma.exportJob.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      deps.prisma.exportJob.count({ where })
    ]);
    return reply.send(toJsonSafe({ data: rows, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }));
  });

  app.post("/api/projects/:projectId/reports/export", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const body = reportExportSchema.parse(req.body ?? {});
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "report export requires prisma mode", 501);

    const job = await deps.prisma.exportJob.create({
      data: {
        projectId,
        type: `report_${body.reportType}_csv`,
        filters: normalizeReportFilters(body) as Prisma.InputJsonValue,
        status: "pending",
        summary: { format: body.format, maxRows: body.maxRows } as Prisma.InputJsonValue,
        createdBy: user.id
      }
    });
    return reply.status(202).send(
      toJsonSafe(
        ok({
          job,
          downloadUrl: `/api/projects/${projectId.toString()}/export-jobs/${job.id.toString()}/download`
        })
      )
    );
  });

  app.get("/api/projects/:projectId/reports/export", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const query = reportExportSchema.parse(req.query ?? {});
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "report export requires prisma mode", 501);

    const exported = await buildReportExport(deps.prisma, projectId, query);
    const job = await deps.prisma.exportJob.create({
      data: {
        projectId,
        type: `report_${query.reportType}_csv`,
        filters: normalizeReportFilters(query) as Prisma.InputJsonValue,
        status: "completed",
        summary: {
          totalRows: exported.totalRows,
          fileName: exported.fileName,
          contentType: "text/csv"
        } as Prisma.InputJsonValue,
        createdBy: user.id
      }
    });
    reply.header("content-type", "text/csv; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="${exported.fileName}"`);
    reply.header("x-export-job-id", job.id.toString());
    return reply.send(exported.csv);
  });

  app.get("/api/projects/:projectId/export-jobs/:jobId/download", async (req, reply) => {
    await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { jobId } = exportJobIdParamSchema.parse(req.params);
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "export job download requires prisma mode", 501);

    const job = await deps.prisma.exportJob.findFirst({ where: { id: jobId, projectId } });
    if (!job) throw new AppError("NOT_FOUND", `export job ${jobId.toString()} not found`, 404);
    if (!job.type.startsWith("report_")) {
      throw new AppError("VALIDATION_ERROR", "only report export jobs can be downloaded by job id", 400);
    }

    const filters = parseReportFilters(job.filters);
    const exported = await buildReportExport(deps.prisma, projectId, filters);
    await deps.prisma.exportJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        summary: {
          totalRows: exported.totalRows,
          fileName: exported.fileName,
          contentType: "text/csv"
        } as Prisma.InputJsonValue
      }
    });
    reply.header("content-type", "text/csv; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="${exported.fileName}"`);
    return reply.send(exported.csv);
  });

  app.get("/api/projects/:projectId/cases/export/csv", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "case export requires prisma mode", 501);
    const rows = await deps.prisma.testCase.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { id: "asc" },
      include: { steps: { where: { deletedAt: null }, orderBy: { stepOrder: "asc" } } }
    });
    const csv = toCsv(
      ["id", "section_id", "title", "preconditions", "priority", "type", "refs", "labels", "automation_key", "external_id", "steps"],
      rows.map((row) => ({
        id: row.id,
        section_id: row.sectionId,
        title: row.title,
        preconditions: row.preconditions,
        priority: row.priority,
        type: row.caseType,
        refs: row.refs,
        labels: row.labels.join("|"),
        automation_key: row.automationKey,
        external_id: row.externalId,
        steps: row.steps.map((step) => `${step.content}${step.expectedResult ? `=>${step.expectedResult}` : ""}`).join("|")
      }))
    );
    await deps.prisma.exportJob.create({
      data: {
        projectId,
        type: "cases_csv",
        status: "completed",
        summary: { totalRows: rows.length } as Prisma.InputJsonValue,
        createdBy: user.id
      }
    });
    reply.header("content-type", "text/csv; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="project-${projectId.toString()}-cases.csv"`);
    return reply.send(csv);
  });

  app.get("/api/projects/:projectId/runs/:runId/results/export/csv", async (req, reply) => {
    const user = await getAuthenticatedUser(req, deps);
    const { projectId } = projectIdParamSchema.parse(req.params);
    const { runId } = runIdParamSchema.parse(req.params);
    if (!deps.prisma) throw new AppError("NOT_IMPLEMENTED", "result export requires prisma mode", 501);
    const run = await deps.prisma.testRun.findFirst({ where: { id: runId, projectId, deletedAt: null } });
    if (!run) throw new AppError("NOT_FOUND", `run ${runId.toString()} not found`, 404);
    const rows = await deps.prisma.testResult.findMany({
      where: { instance: { runId } },
      orderBy: { createdAt: "desc" },
      include: { instance: true, defectLinks: { where: { deletedAt: null } } }
    });
    const csv = toCsv(
      ["result_id", "test_id", "case_id", "status", "comment", "elapsed", "version", "source", "defects", "created_at"],
      rows.map((row) => ({
        result_id: row.id,
        test_id: row.testInstanceId,
        case_id: row.instance.caseId,
        status: row.status,
        comment: row.comment,
        elapsed: row.elapsed,
        version: row.version,
        source: row.source,
        defects: [...row.defects, ...row.defectLinks.map((link) => link.defectKey)].join("|"),
        created_at: row.createdAt.toISOString()
      }))
    );
    await deps.prisma.exportJob.create({
      data: {
        projectId,
        type: "run_results_csv",
        filters: { runId: runId.toString() } as Prisma.InputJsonValue,
        status: "completed",
        summary: { totalRows: rows.length } as Prisma.InputJsonValue,
        createdBy: user.id
      }
    });
    reply.header("content-type", "text/csv; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="run-${runId.toString()}-results.csv"`);
    return reply.send(csv);
  });
}
