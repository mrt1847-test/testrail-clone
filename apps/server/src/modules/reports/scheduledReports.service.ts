import type { Prisma, PrismaClient } from "@prisma/client";
import { AppError } from "../../common/errors/appError.js";
import { env } from "../../config/env.js";
import { ImportExportService, reportExportSchema } from "../importExport/importExport.routes.js";
import { recordActivityEvent } from "../activity/activity.service.js";

function parseRecipientEmails(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.includes("@"));
}

function computeNextRunAt(intervalMinutes: number, from = new Date()) {
  return new Date(from.getTime() + intervalMinutes * 60_000);
}

function mergeExportFilters(
  savedFilters: Prisma.JsonValue | null | undefined,
  scheduleFilters: Prisma.JsonValue | null | undefined
) {
  const saved =
    typeof savedFilters === "object" && savedFilters !== null && !Array.isArray(savedFilters)
      ? (savedFilters as Record<string, unknown>)
      : {};
  const schedule =
    typeof scheduleFilters === "object" && scheduleFilters !== null && !Array.isArray(scheduleFilters)
      ? (scheduleFilters as Record<string, unknown>)
      : {};
  const savedExport =
    typeof saved.export === "object" && saved.export !== null && !Array.isArray(saved.export)
      ? (saved.export as Record<string, unknown>)
      : {};
  const scheduleExport =
    typeof schedule.export === "object" && schedule.export !== null && !Array.isArray(schedule.export)
      ? (schedule.export as Record<string, unknown>)
      : {};
  return { ...savedExport, ...scheduleExport };
}

export function mapScheduledReport(row: {
  id: bigint;
  projectId: bigint;
  name: string;
  savedReportId: bigint | null;
  reportType: string;
  filters: Prisma.JsonValue | null;
  intervalMinutes: number;
  recipientEmails: Prisma.JsonValue;
  enabled: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  lastExportJobId: bigint | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: bigint | null;
}) {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    savedReportId: row.savedReportId,
    reportType: row.reportType,
    filters: row.filters,
    intervalMinutes: row.intervalMinutes,
    recipientEmails: parseRecipientEmails(row.recipientEmails),
    enabled: row.enabled,
    lastRunAt: row.lastRunAt,
    nextRunAt: row.nextRunAt,
    lastExportJobId: row.lastExportJobId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy
  };
}

export async function resolveScheduledReportExportInput(
  prisma: PrismaClient,
  schedule: {
    projectId: bigint;
    savedReportId: bigint | null;
    reportType: string;
    filters: Prisma.JsonValue | null;
  }
) {
  const saved = schedule.savedReportId
    ? await prisma.savedReport.findFirst({
        where: { id: schedule.savedReportId, projectId: schedule.projectId, deletedAt: null }
      })
    : null;
  if (schedule.savedReportId && !saved) {
    throw new AppError("NOT_FOUND", "linked saved report not found", 404);
  }
  const reportType = saved?.reportType ?? schedule.reportType;
  const exportRaw = mergeExportFilters(saved?.filters ?? null, schedule.filters);
  return reportExportSchema.parse({
    reportType,
    format: "csv",
    ...exportRaw
  });
}

export async function executeScheduledReport(
  prisma: PrismaClient,
  scheduleId: bigint,
  options?: { actorUserId?: bigint; manual?: boolean }
) {
  const schedule = await prisma.scheduledReport.findFirst({
    where: { id: scheduleId, deletedAt: null }
  });
  if (!schedule) throw new AppError("NOT_FOUND", "scheduled report not found", 404);
  if (!schedule.enabled && !options?.manual) {
    return { skipped: true, reason: "disabled" as const };
  }

  const actorUserId = options?.actorUserId ?? schedule.createdBy;
  if (!actorUserId) {
    throw new AppError("VALIDATION_ERROR", "scheduled report has no owner for export", 400);
  }

  const exportInput = await resolveScheduledReportExportInput(prisma, schedule);
  const importExport = new ImportExportService(prisma);
  const job = await importExport.createReportExportJob(schedule.projectId, actorUserId, exportInput);
  const exported = await importExport.buildReportExportFromJob(schedule.projectId, job.id);

  const downloadPath = `/api/projects/${schedule.projectId.toString()}/export-jobs/${job.id.toString()}/download`;
  const savedHref = `${env.webOrigin}/projects/${schedule.projectId.toString()}/reports/saved`;
  const recipients = parseRecipientEmails(schedule.recipientEmails);
  const now = new Date();

  for (const recipientEmail of recipients) {
    await prisma.emailOutbox.create({
      data: {
        userId: actorUserId,
        projectId: schedule.projectId,
        recipientEmail,
        kind: "report.schedule",
        subject: `Scheduled report ready: ${schedule.name}`,
        bodyText: [
          `Your scheduled report "${schedule.name}" (${exportInput.reportType}) is ready.`,
          "",
          `Rows: ${exported.totalRows}`,
          `File: ${exported.fileName}`,
          "",
          `Download (requires login): ${env.webOrigin}${downloadPath}`,
          `Saved reports & export history: ${savedHref}`
        ].join("\n"),
        status: "pending"
      }
    });
  }

  const nextRunAt = computeNextRunAt(schedule.intervalMinutes, now);
  await prisma.scheduledReport.update({
    where: { id: schedule.id },
    data: {
      lastRunAt: now,
      nextRunAt,
      lastExportJobId: job.id,
      updatedAt: now
    }
  });

  await recordActivityEvent(prisma, {
    projectId: schedule.projectId,
    actorUserId,
    entityType: "report",
    entityId: schedule.id,
    eventType: "report.schedule_run",
    title: options?.manual ? "Scheduled report run (manual)" : "Scheduled report run",
    body: schedule.name,
    payload: {
      scheduledReportId: schedule.id.toString(),
      exportJobId: job.id.toString(),
      reportType: exportInput.reportType,
      totalRows: exported.totalRows,
      recipientCount: recipients.length
    }
  });

  await recordActivityEvent(prisma, {
    projectId: schedule.projectId,
    actorUserId,
    entityType: "report",
    entityId: job.id,
    eventType: "report.schedule_email_sent",
    title: "Scheduled report email queued",
    body: `${recipients.length} recipient(s)`,
    payload: {
      scheduledReportId: schedule.id.toString(),
      exportJobId: job.id.toString(),
      recipients
    }
  });

  return {
    skipped: false,
    jobId: job.id,
    totalRows: exported.totalRows,
    fileName: exported.fileName,
    nextRunAt
  };
}

export function initialNextRunAt(intervalMinutes: number) {
  return computeNextRunAt(intervalMinutes);
}
