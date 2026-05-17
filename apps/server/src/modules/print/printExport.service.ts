import type { PrismaClient } from "@prisma/client";

import type { PrintDocument } from "../../domain/printDocument.js";
import { buildMilestoneSummary } from "../reports/milestoneSummary.service.js";
import { toRunSummaryMetrics } from "../reports/reportMetrics.service.js";
import type { CasesService } from "../cases/cases.service.js";
import type { RunsRepository } from "../runs/runs.repository.js";
import { listMemoryMilestones } from "../milestones/milestones.routes.js";
import { findMemoryPlan } from "../plans/plans.routes.js";

type PrintDeps = {
  prisma?: PrismaClient;
  repo: RunsRepository;
  casesService: CasesService;
};

function isoNow() {
  return new Date().toISOString();
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

async function projectLabel(prisma: PrismaClient | undefined, projectId: bigint) {
  if (!prisma) return `Project ${projectId.toString()}`;
  const row = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { name: true }
  });
  return row?.name ?? `Project ${projectId.toString()}`;
}

export async function buildCasePrintDocument(caseId: bigint, deps: PrintDeps): Promise<PrintDocument> {
  const testCase = await deps.casesService.getCase(caseId);
  const projectId = testCase.projectId;
  const subtitle = projectId ? await projectLabel(deps.prisma, projectId) : undefined;

  const stepsTable = {
    title: "Steps",
    columns: ["#", "Step", "Expected"],
    rows:
      testCase.steps?.length > 0
        ? testCase.steps
            .sort((a, b) => a.stepOrder - b.stepOrder)
            .map((step, index) => [
              String(index + 1),
              step.content,
              step.expectedResult ?? ""
            ])
        : [["—", "No steps defined", ""]]
  };

  return {
    entityType: "case",
    title: testCase.title,
    subtitle,
    generatedAt: isoNow(),
    meta: [
      { label: "Case ID", value: testCase.id.toString() },
      { label: "Priority", value: testCase.priority ?? "—" },
      { label: "Type", value: testCase.caseType ?? "—" },
      { label: "Estimate", value: testCase.estimate ?? "—" },
      { label: "References", value: testCase.refs ?? "—" },
      { label: "Automation key", value: testCase.automationKey ?? "—" },
      { label: "Preconditions", value: testCase.preconditions ?? "—" },
      { label: "Expected result", value: testCase.expectedResult ?? "—" },
      { label: "Mission", value: testCase.mission ?? "—" },
      { label: "Goals", value: testCase.goals ?? "—" }
    ],
    tables: [stepsTable]
  };
}

export async function buildRunPrintDocument(
  projectId: bigint,
  runId: bigint,
  deps: PrintDeps
): Promise<PrintDocument> {
  const run = await deps.repo.getRun(runId);
  if (!run || run.projectId !== projectId) {
    throw new Error("RUN_NOT_FOUND");
  }

  const instances = await deps.repo.listInstancesForRun(runId);
  const metrics = toRunSummaryMetrics(instances.map((row) => row.status));
  const subtitle = await projectLabel(deps.prisma, projectId);

  return {
    entityType: "run",
    title: run.name,
    subtitle,
    generatedAt: isoNow(),
    meta: [
      { label: "Run ID", value: run.id.toString() },
      { label: "Status", value: run.status },
      { label: "Due on", value: formatDate(run.dueOn) },
      { label: "Tests", value: String(metrics.total) },
      { label: "Passed", value: String(metrics.passed) },
      { label: "Failed", value: String(metrics.failed) },
      { label: "Progress", value: `${metrics.progress}%` }
    ],
    tables: [
      {
        title: "Tests",
        columns: ["Test ID", "Case ID", "Title", "Status", "Assignee"],
        rows: instances.map((instance) => [
          instance.id.toString(),
          instance.caseId.toString(),
          instance.titleSnapshot,
          instance.status,
          instance.assignedTo?.toString() ?? "—"
        ])
      }
    ]
  };
}

export async function buildPlanPrintDocument(
  projectId: bigint,
  planId: bigint,
  deps: PrintDeps
): Promise<PrintDocument> {
  if (deps.prisma) {
    const plan = await deps.prisma.testPlan.findFirst({
      where: { id: planId, projectId, deletedAt: null }
    });
    if (!plan) throw new Error("PLAN_NOT_FOUND");

    const entries = await deps.prisma.testPlanEntry.findMany({
      where: { planId, deletedAt: null },
      orderBy: { id: "asc" }
    });

    return {
      entityType: "plan",
      title: plan.name,
      subtitle: await projectLabel(deps.prisma, projectId),
      generatedAt: isoNow(),
      meta: [
        { label: "Plan ID", value: plan.id.toString() },
        { label: "Description", value: plan.description ?? "—" },
        { label: "Start date", value: formatDate(plan.startDate) },
        { label: "Due on", value: formatDate(plan.dueOn) },
        { label: "Entries", value: String(entries.length) }
      ],
      tables: [
        {
          title: "Plan entries",
          columns: ["Entry", "Environment", "Included", "Assigned to"],
          rows: entries.map((entry) => [
            entry.name,
            entry.environment ?? "—",
            entry.isIncluded ? "yes" : "no",
            entry.assignedTo?.toString() ?? "—"
          ])
        }
      ]
    };
  }

  const plan = findMemoryPlan(projectId, planId);
  if (!plan) throw new Error("PLAN_NOT_FOUND");

  return {
    entityType: "plan",
    title: plan.name,
    subtitle: `Project ${projectId.toString()}`,
    generatedAt: isoNow(),
    meta: [
      { label: "Plan ID", value: plan.id.toString() },
      { label: "Start date", value: formatDate(plan.startDate) },
      { label: "Due on", value: formatDate(plan.dueOn) },
      { label: "Entries", value: String(plan.entries.length) }
    ],
    tables: [
      {
        title: "Plan entries",
        columns: ["Entry", "Environment", "Included", "Assigned to"],
        rows: plan.entries.map((entry) => [
          entry.name,
          entry.environment ?? "—",
          entry.isIncluded === false ? "no" : "yes",
          entry.assignedTo?.toString() ?? "—"
        ])
      }
    ]
  };
}

export async function buildMilestonePrintDocument(
  projectId: bigint,
  milestoneId: bigint,
  deps: PrintDeps
): Promise<PrintDocument> {
  let milestoneName = `Milestone ${milestoneId.toString()}`;
  let meta: PrintDocument["meta"] = [{ label: "Milestone ID", value: milestoneId.toString() }];
  let childNames: string[] = [];

  if (deps.prisma) {
    const milestone = await deps.prisma.milestone.findFirst({
      where: { id: milestoneId, projectId, deletedAt: null }
    });
    if (!milestone) throw new Error("MILESTONE_NOT_FOUND");
    milestoneName = milestone.name;
    const children = await deps.prisma.milestone.findMany({
      where: { projectId, parentMilestoneId: milestoneId, deletedAt: null },
      orderBy: { name: "asc" }
    });
    childNames = children.map((row) => row.name);
    meta = [
      { label: "Milestone ID", value: milestone.id.toString() },
      { label: "Status", value: milestone.isCompleted ? "completed" : "open" },
      { label: "Start date", value: formatDate(milestone.startDate) },
      { label: "Due date", value: formatDate(milestone.dueDate) },
      { label: "Child milestones", value: childNames.length > 0 ? childNames.join(", ") : "—" }
    ];
  } else {
    const row = listMemoryMilestones(projectId).find((item) => item.id === milestoneId);
    if (!row) throw new Error("MILESTONE_NOT_FOUND");
    milestoneName = row.name;
    childNames = listMemoryMilestones(projectId)
      .filter((item) => item.parentMilestoneId === milestoneId)
      .map((item) => item.name);
    meta = [
      { label: "Milestone ID", value: row.id.toString() },
      { label: "Status", value: row.isCompleted ? "completed" : "open" },
      { label: "Start date", value: formatDate(row.startDate) },
      { label: "Due date", value: formatDate(row.dueDate) },
      { label: "Child milestones", value: childNames.length > 0 ? childNames.join(", ") : "—" }
    ];
  }

  const summary = await buildMilestoneSummary(projectId, deps);
  const rollup = summary.items.find((row) => row.milestoneId === milestoneId.toString());

  const runs = await deps.repo.listRunsByProject(projectId);
  const linkedRuns = runs.filter((run) => run.milestoneId === milestoneId);

  return {
    entityType: "milestone",
    title: milestoneName,
    subtitle: await projectLabel(deps.prisma, projectId),
    generatedAt: isoNow(),
    meta: [
      ...meta,
      ...(rollup
        ? [
            { label: "Linked runs", value: String(rollup.runCount) },
            { label: "Open runs", value: String(rollup.openRunCount) },
            { label: "Progress", value: `${rollup.progress}%` },
            { label: "Passed", value: String(rollup.passed) },
            { label: "Failed", value: String(rollup.failed) }
          ]
        : [])
    ],
    tables: [
      {
        title: "Runs in milestone",
        columns: ["Run", "Status", "Tests", "Passed", "Failed", "Progress"],
        rows: await Promise.all(
          linkedRuns.map(async (run) => {
            const instances = await deps.repo.listInstancesForRun(run.id);
            const metrics = toRunSummaryMetrics(instances.map((row) => row.status));
            return [
              run.name,
              run.status,
              String(metrics.total),
              String(metrics.passed),
              String(metrics.failed),
              `${metrics.progress}%`
            ];
          })
        )
      }
    ]
  };
}
