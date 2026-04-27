import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
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
    const testCase = await prisma.testCase.create({
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
    const run = await prisma.testRun.create({
        data: {
            projectId: project.id,
            suiteId: suite.id,
            name: "Smoke Run",
            createdBy: admin.id,
            updatedBy: admin.id
        }
    });
    const instance = await prisma.testInstance.create({
        data: {
            runId: run.id,
            caseId: testCase.id,
            titleSnapshot: testCase.title,
            prioritySnapshot: testCase.priority,
            typeSnapshot: testCase.caseType,
            automationKeySnapshot: testCase.automationKey,
            createdBy: admin.id,
            updatedBy: admin.id
        }
    });
    const result = await prisma.testResult.create({
        data: {
            testInstanceId: instance.id,
            status: "passed",
            comment: "Initial smoke passed",
            defects: [],
            createdBy: admin.id
        }
    });
    await prisma.testInstance.update({
        where: { id: instance.id },
        data: {
            status: "passed",
            latestResultId: result.id
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
