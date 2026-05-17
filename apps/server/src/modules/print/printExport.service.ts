import type { PrismaClient } from "@prisma/client";

import type { PrintDocument, PrintDocumentSection } from "../../domain/printDocument.js";
import { MAX_CASES_PER_PRINT } from "../../domain/printDocument.js";
import { buildMilestoneSummary } from "../reports/milestoneSummary.service.js";
import { toRunSummaryMetrics, toStatusCounters } from "../reports/reportMetrics.service.js";
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

function toPrintSection(document: PrintDocument): PrintDocumentSection {
  return {
    entityType: document.entityType,
    title: document.title,
    subtitle: document.subtitle,
    meta: document.meta,
    tables: document.tables,
    notes: document.notes
  };
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

export async function buildCasesPrintDocument(
  projectId: bigint,
  caseIds: bigint[],
  deps: PrintDeps
): Promise<PrintDocument> {
  if (caseIds.length === 0) {
    throw new Error("NO_CASES_SELECTED");
  }
  if (caseIds.length > MAX_CASES_PER_PRINT) {
    throw new Error("TOO_MANY_CASES");
  }

  const { scopedIds } = await deps.casesService.resolveProjectScopedCaseIds(projectId, caseIds);
  if (scopedIds.length === 0) {
    throw new Error("NO_CASES_FOUND");
  }

  const sections: PrintDocumentSection[] = [];
  for (const caseId of scopedIds) {
    const single = await buildCasePrintDocument(caseId, deps);
    sections.push(toPrintSection(single));
  }

  return {
    entityType: "cases",
    title: `${sections.length} test case${sections.length === 1 ? "" : "s"}`,
    subtitle: await projectLabel(deps.prisma, projectId),
    generatedAt: isoNow(),
    meta: [{ label: "Cases included", value: String(sections.length) }],
    tables: [],
    sections
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
  const statuses = instances.map((row) => row.status);
  const metrics = toRunSummaryMetrics(statuses);
  const counters = toStatusCounters(statuses);
  const subtitle = await projectLabel(deps.prisma, projectId);

  const statusBreakdownRows = (
    ["passed", "failed", "blocked", "retest", "untested"] as const
  )
    .filter((status) => counters[status] > 0)
    .map((status) => [status, String(counters[status])]);

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
      { label: "Blocked", value: String(counters.blocked) },
      { label: "Retest", value: String(counters.retest) },
      { label: "Untested", value: String(counters.untested) },
      { label: "Progress", value: `${metrics.progress}%` }
    ],
    tables: [
      {
        title: "Status breakdown",
        columns: ["Status", "Count"],
        rows: statusBreakdownRows.length > 0 ? statusBreakdownRows : [["—", "0"]]
      },
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
      orderBy: { id: "asc" },
      include: {
        run: { select: { id: true, name: true, status: true } }
      }
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
        { label: "Entries", value: String(entries.length) },
        {
          label: "Linked runs",
          value: String(entries.filter((entry) => entry.runId != null).length)
        }
      ],
      tables: [
        {
          title: "Plan entries",
          columns: ["Entry", "Environment", "Included", "Assigned to", "Linked run", "Run status"],
          rows: entries.map((entry) => [
            entry.name,
            entry.environment ?? "—",
            entry.isIncluded ? "yes" : "no",
            entry.assignedTo?.toString() ?? "—",
            entry.run?.name ?? (entry.runId ? entry.runId.toString() : "—"),
            entry.run?.status ?? "—"
          ])
        }
      ]
    };
  }

  const plan = findMemoryPlan(projectId, planId);
  if (!plan) throw new Error("PLAN_NOT_FOUND");

  const entryRows = await Promise.all(
    plan.entries.map(async (entry) => {
      let linkedRun = "—";
      let runStatus = "—";
      if (entry.runId) {
        const run = await deps.repo.getRun(entry.runId);
        if (run) {
          linkedRun = run.name;
          runStatus = run.status;
        } else {
          linkedRun = entry.runId.toString();
        }
      }
      return [
        entry.name,
        entry.environment ?? "—",
        entry.isIncluded === false ? "no" : "yes",
        entry.assignedTo?.toString() ?? "—",
        linkedRun,
        runStatus
      ];
    })
  );

  return {
    entityType: "plan",
    title: plan.name,
    subtitle: `Project ${projectId.toString()}`,
    generatedAt: isoNow(),
    meta: [
      { label: "Plan ID", value: plan.id.toString() },
      { label: "Start date", value: formatDate(plan.startDate) },
      { label: "Due on", value: formatDate(plan.dueOn) },
      { label: "Entries", value: String(plan.entries.length) },
      {
        label: "Linked runs",
        value: String(plan.entries.filter((entry) => entry.runId != null).length)
      }
    ],
    tables: [
      {
        title: "Plan entries",
        columns: ["Entry", "Environment", "Included", "Assigned to", "Linked run", "Run status"],
        rows: entryRows
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
