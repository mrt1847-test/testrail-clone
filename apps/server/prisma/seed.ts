import { PrismaClient } from "../src/db/prisma.js";

const prisma = new PrismaClient();

async function main() {
  await prisma.testResultStep.deleteMany();
  await prisma.testResult.deleteMany();
  await prisma.testInstance.deleteMany();
  await prisma.testRun.deleteMany();
  await prisma.testCaseStep.deleteMany();
  await prisma.testCase.deleteMany();
  await prisma.section.deleteMany();
  await prisma.testSuite.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Admin"
    }
  });

  const project = await prisma.project.create({
    data: {
      name: "Demo Project",
      createdBy: admin.id,
      updatedBy: admin.id
    }
  });

  const suite = await prisma.testSuite.create({
    data: {
      projectId: project.id,
      name: "MWEB Regression",
      createdBy: admin.id,
      updatedBy: admin.id
    }
  });

  const section = await prisma.section.create({
    data: {
      suiteId: suite.id,
      name: "Cart",
      displayOrder: 1,
      createdBy: admin.id,
      updatedBy: admin.id
    }
  });

  const testCasePass = await prisma.testCase.create({
    data: {
      projectId: project.id,
      suiteId: suite.id,
      sectionId: section.id,
      title: "Add product to cart",
      expectedResult: "Cart count increases",
      priority: "high",
      caseType: "functional",
      labels: ["smoke"],
      automationKey: "MWEB-CART-001",
      createdBy: admin.id,
      updatedBy: admin.id
    }
  });

  const testCaseFail = await prisma.testCase.create({
    data: {
      projectId: project.id,
      suiteId: suite.id,
      sectionId: section.id,
      title: "Checkout API returns success",
      expectedResult: "POST /checkout returns 200",
      priority: "high",
      caseType: "functional",
      labels: ["regression"],
      automationKey: "MWEB-CHECKOUT-001",
      createdBy: admin.id,
      updatedBy: admin.id
    }
  });

  await prisma.testCaseStep.createMany({
    data: [
      {
        caseId: testCaseFail.id,
        stepOrder: 1,
        content: "Open checkout page",
        expectedResult: "Checkout page opens",
        createdBy: admin.id,
        updatedBy: admin.id
      },
      {
        caseId: testCaseFail.id,
        stepOrder: 2,
        content: "Click place order",
        expectedResult: "API returns 200",
        createdBy: admin.id,
        updatedBy: admin.id
      }
    ]
  });

  const run = await prisma.testRun.create({
    data: {
      projectId: project.id,
      suiteId: suite.id,
      name: "Smoke Run",
      createdBy: admin.id,
      updatedBy: admin.id
    }
  });

  const passInstance = await prisma.testInstance.create({
    data: {
      runId: run.id,
      caseId: testCasePass.id,
      titleSnapshot: testCasePass.title,
      prioritySnapshot: testCasePass.priority,
      typeSnapshot: testCasePass.caseType,
      automationKeySnapshot: testCasePass.automationKey,
      createdBy: admin.id,
      updatedBy: admin.id
    }
  });

  const failInstance = await prisma.testInstance.create({
    data: {
      runId: run.id,
      caseId: testCaseFail.id,
      titleSnapshot: testCaseFail.title,
      prioritySnapshot: testCaseFail.priority,
      typeSnapshot: testCaseFail.caseType,
      automationKeySnapshot: testCaseFail.automationKey,
      createdBy: admin.id,
      updatedBy: admin.id
    }
  });

  const passResult = await prisma.testResult.create({
    data: {
      testInstanceId: passInstance.id,
      status: "passed",
      comment: "Initial smoke passed",
      defects: [],
      createdBy: admin.id
    }
  });

  const failResult = await prisma.testResult.create({
    data: {
      testInstanceId: failInstance.id,
      status: "failed",
      comment: "POST /checkout returned 500",
      elapsed: "8s",
      version: "build-20260427.1",
      defects: ["JIRA-777"],
      source: "automation",
      createdBy: admin.id
    }
  });

  await prisma.testResultStep.createMany({
    data: [
      {
        resultId: failResult.id,
        stepOrder: 1,
        status: "passed",
        actualResult: "Checkout page opened"
      },
      {
        resultId: failResult.id,
        stepOrder: 2,
        status: "failed",
        actualResult: "POST /checkout returned 500",
        comment: "Gateway timeout through edge"
      }
    ]
  });

  await prisma.testInstance.update({
    where: { id: passInstance.id },
    data: {
      status: "passed",
      latestResultId: passResult.id
    }
  });

  await prisma.testInstance.update({
    where: { id: failInstance.id },
    data: {
      status: "failed",
      latestResultId: failResult.id
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
