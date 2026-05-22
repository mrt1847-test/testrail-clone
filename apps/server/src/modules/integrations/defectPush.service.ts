import type { PrismaClient } from "@prisma/client";

import {
  buildDefaultDefectPushValues,
  buildResultTraceback,
  defectPushFieldsForProvider,
  type DefectPushContext
} from "../../domain/defectPushFields.js";
import { normalizeDefectProvider } from "../../domain/defectIntegrationValidation.js";
import { loadDefectIntegration } from "./defectIntegration.service.js";

async function enrichDefectPushContext(
  context: DefectPushContext,
  prisma?: PrismaClient
): Promise<DefectPushContext> {
  if (!prisma) return context;
  const testId = BigInt(context.testId);
  const row = await prisma.testInstance.findUnique({
    where: { id: testId },
    select: {
      titleSnapshot: true,
      testCase: {
        select: {
          id: true,
          title: true,
          preconditions: true,
          expectedResult: true,
          refs: true
        }
      }
    }
  });
  const testCase = row?.testCase;
  if (!testCase) return context;
  return {
    ...context,
    testTitle: context.testTitle || row?.titleSnapshot || context.testTitle,
    caseCode: context.caseCode ?? `C${testCase.id.toString()}`,
    caseTitle: context.caseTitle ?? testCase.title,
    casePreconditions: context.casePreconditions ?? testCase.preconditions,
    caseExpected: context.caseExpected ?? testCase.expectedResult,
    caseRefs: context.caseRefs ?? testCase.refs
  };
}

export async function getDefectPushFieldsForProject(
  projectId: bigint,
  providerInput: string | undefined,
  context: DefectPushContext | undefined,
  prisma?: PrismaClient
) {
  const setting = await loadDefectIntegration(projectId, prisma);
  const provider = normalizeDefectProvider(providerInput ?? setting.provider);
  const fields = defectPushFieldsForProvider(provider);
  const enrichedContext = context ? await enrichDefectPushContext(context, prisma) : undefined;
  const defaults = enrichedContext
    ? buildDefaultDefectPushValues(fields, enrichedContext, setting.defaultProjectKey)
    : {};

  return {
    provider,
    integrationEnabled: setting.isEnabled,
    issueUrlTemplate: setting.issueUrlTemplate,
    defaultProjectKey: setting.defaultProjectKey,
    fields,
    defaults,
    tracebackPreview: enrichedContext ? buildResultTraceback(enrichedContext) : null
  };
}
