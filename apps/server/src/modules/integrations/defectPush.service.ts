import type { PrismaClient } from "@prisma/client";

import {
  buildDefaultDefectPushValues,
  buildResultTraceback,
  defectPushFieldsForProvider,
  type DefectPushContext
} from "../../domain/defectPushFields.js";
import { normalizeDefectProvider } from "../../domain/defectIntegrationValidation.js";
import { loadDefectIntegration } from "./defectIntegration.service.js";

export async function getDefectPushFieldsForProject(
  projectId: bigint,
  providerInput: string | undefined,
  context: DefectPushContext | undefined,
  prisma?: PrismaClient
) {
  const setting = await loadDefectIntegration(projectId, prisma);
  const provider = normalizeDefectProvider(providerInput ?? setting.provider);
  const fields = defectPushFieldsForProvider(provider);
  const defaults = context
    ? buildDefaultDefectPushValues(fields, context, setting.defaultProjectKey)
    : {};

  return {
    provider,
    integrationEnabled: setting.isEnabled,
    issueUrlTemplate: setting.issueUrlTemplate,
    defaultProjectKey: setting.defaultProjectKey,
    fields,
    defaults,
    tracebackPreview: context ? buildResultTraceback(context) : null
  };
}
