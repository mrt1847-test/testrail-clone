import type { QueryClient } from "@tanstack/react-query";

import { projectKeys } from "../../projects/hooks/useProjectsApi";
import { reportKeys } from "../../projects/hooks/reportKeys";
import type { CaseAuthoringSubmitInput } from "../components/CaseAuthoringForm";
import { caseDetailKeys } from "../hooks/useCaseDetail";
import { caseKeys } from "../hooks/useCases";
import { sectionKeys } from "../hooks/useSections";
import type { TestCase } from "../types";
import {
  AuthoringPersistError,
  type AuthoringPersistOutcome,
  type AuthoringPersistResume
} from "./authoringPersistOutcome";
import { decideAuthoringSaveRefresh } from "./caseAuthoringSaveBoundary";
import { createCaseFromAuthoring } from "./createCaseFromAuthoring";
import { updateCaseFromAuthoring } from "./updateCaseFromAuthoring";

export async function refreshCaseAuthoringQueries(
  qc: QueryClient,
  input: { projectId: string; caseId?: number }
) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: caseKeys.all(input.projectId) }),
    qc.invalidateQueries({ queryKey: sectionKeys.all(input.projectId) }),
    qc.invalidateQueries({ queryKey: ["suite-summary", input.projectId] }),
    qc.invalidateQueries({ queryKey: projectKeys.overview(input.projectId) }),
    qc.invalidateQueries({ queryKey: reportKeys.all(input.projectId) }),
    ...(input.caseId != null
      ? [
          qc.invalidateQueries({ queryKey: caseDetailKeys.detail(input.caseId) }),
          qc.invalidateQueries({ queryKey: ["case-versions", input.caseId] })
        ]
      : [])
  ]);
}

function refreshDecision(result: AuthoringPersistOutcome, saveGeneration: number, isCurrent?: () => boolean) {
  const incomingGeneration = isCurrent && !isCurrent() ? saveGeneration - 1 : saveGeneration;
  return decideAuthoringSaveRefresh({
    bodyComplete: result.bodySaved,
    stepsComplete: result.ok && result.stepsComplete,
    saveGeneration,
    incomingGeneration
  });
}

export async function persistAndRefreshCaseAuthoring(
  qc: QueryClient,
  input: {
    projectId: string;
    existing: TestCase;
    sectionId: number;
    submit: CaseAuthoringSubmitInput;
    saveGeneration: number;
    isCurrent?: () => boolean;
    resume?: AuthoringPersistResume | null;
  }
): Promise<AuthoringPersistOutcome> {
  const result = await updateCaseFromAuthoring(
    input.projectId,
    input.existing,
    input.sectionId,
    input.submit,
    input.resume
  );
  if (refreshDecision(result, input.saveGeneration, input.isCurrent) === "refresh") {
    await refreshCaseAuthoringQueries(qc, { projectId: input.projectId, caseId: input.existing.id });
  }
  return result;
}

export async function createAndRefreshCaseAuthoring(
  qc: QueryClient,
  input: {
    projectId: string;
    sectionId: number;
    submit: CaseAuthoringSubmitInput;
    saveGeneration: number;
    isCurrent?: () => boolean;
    resume?: AuthoringPersistResume | null;
  }
): Promise<AuthoringPersistOutcome> {
  const result = await createCaseFromAuthoring(input.sectionId, input.submit, input.resume);
  if (refreshDecision(result, input.saveGeneration, input.isCurrent) === "refresh") {
    await refreshCaseAuthoringQueries(qc, { projectId: input.projectId, caseId: result.created?.id ?? result.caseId ?? undefined });
  }
  return result;
}

export function throwIfAuthoringPersistFailed(result: AuthoringPersistOutcome): AuthoringPersistOutcome {
  if (!result.ok) throw new AuthoringPersistError(result);
  return result;
}
