import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ErrorState } from "../../../shared/ui/ErrorState";
import { LoadingState } from "../../../shared/ui/LoadingState";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { useProjectArchived } from "../../projects/context/ProjectArchiveContext";
import { fetchCaseTemplates, fetchCustomFieldsForUse } from "../../projects/api/settingsApi";
import { fetchSuites } from "../../projects/api/suitesApi";
import { extractApiErrorMessage } from "../caseErrors";
import { buildCaseDetailPath } from "../caseRoute";
import {
  CASE_LIST_RETURN_PARAM,
  buildCaseListPathFromReturn,
  isCaseLikelyHiddenByListReturn
} from "../utils/caseListReturnContext";
import { useCaseDetail } from "../hooks/useCaseDetail";
import { useSections } from "../hooks/useSections";
import { fetchSectionsForProject, uploadCaseAttachmentViaPresign } from "../api/catalogApi";
import { authoringCustomValuesFromCase } from "../utils/authoringCustomValuesFromCase";
import {
  persistAndRefreshCaseAuthoring,
  createAndRefreshCaseAuthoring
} from "../utils/persistCaseAuthoring";
import {
  AuthoringPersistError,
  authoringLeaveDescription,
  isAuthoringPersistError,
  resumeFromOutcome,
  type AuthoringPersistResume
} from "../utils/authoringPersistOutcome";
import {
  applyStagedCaseAttachmentPatch,
  attachmentUploadPlan,
  caseAuthoringAttachmentFailureMessage,
  hasPendingStagedCaseAttachments,
  removeStagedCaseAttachment,
  shouldUploadStagedCaseAttachments,
  stageCaseAuthoringAttachments,
  type StagedCaseAttachment
} from "../utils/caseAuthoringAttachmentStaging";
import { caseAuthoringValueKey } from "../utils/caseAuthoringValueKey";
import { sectionDestinationOptions } from "../utils/sectionTreeModel";
import { useUnsavedDraftGuard } from "../hooks/useUnsavedDraftGuard";
import { BddScenarioEditor } from "./BddScenarioEditor";
import { CaseAttachmentStagingPanel } from "./CaseAttachmentStagingPanel";
import { CaseAuthoringForm } from "./CaseAuthoringForm";
import type { CaseAuthoringSubmitInput } from "./CaseAuthoringForm";

function parseSectionId(value: string | null): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function CaseAuthoringScreen({ mode, caseId }: { mode: "add" | "edit"; caseId?: number }) {
  const { projectId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isProjectArchived = useProjectArchived();
  const suiteIdFromUrl = searchParams.get("suiteId") ?? "";
  const requestedSectionId = parseSectionId(searchParams.get("sectionId"));
  const returnToPage = searchParams.get("from") === "page";
  const [formKey, setFormKey] = useState(0);
  const [formDirty, setFormDirty] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [stagedAttachments, setStagedAttachments] = useState<StagedCaseAttachment[]>([]);
  const [stagingRejectMessage, setStagingRejectMessage] = useState<string | null>(null);
  const [attachmentsUploading, setAttachmentsUploading] = useState(false);
  const persistResumeRef = useRef<AuthoringPersistResume | null>(null);
  const [persistResume, setPersistResume] = useState<AuthoringPersistResume | null>(null);
  const draftGuard = useUnsavedDraftGuard(false);
  const saveGenerationRef = useRef(0);
  const stagedAttachmentsRef = useRef(stagedAttachments);
  stagedAttachmentsRef.current = stagedAttachments;

  const caseQuery = useCaseDetail(mode === "edit" && caseId != null ? caseId : null);
  const preferredSuiteId = suiteIdFromUrl || undefined;
  const addSectionsQuery = useSections(mode === "add" ? projectId : undefined, preferredSuiteId);
  const editSectionsQuery = useQuery({
    queryKey: ["case-authoring-sections", projectId, preferredSuiteId ?? "", caseQuery.data?.sectionId ?? ""],
    queryFn: async () => {
      const preferred = await fetchSectionsForProject(projectId, preferredSuiteId ? { suiteId: preferredSuiteId } : undefined);
      const targetSectionId = caseQuery.data?.sectionId;
      if (targetSectionId == null || preferred.sections.some((section) => section.id === targetSectionId)) {
        return preferred;
      }
      const suites = await fetchSuites(projectId);
      for (const suite of suites) {
        if (String(suite.id) === preferred.suiteId) continue;
        const bundle = await fetchSectionsForProject(projectId, { suiteId: String(suite.id) });
        if (bundle.sections.some((section) => section.id === targetSectionId)) return bundle;
      }
      return preferred;
    },
    enabled: Boolean(projectId) && mode === "edit" && Boolean(caseQuery.data)
  });

  const sectionsQuery = mode === "edit" ? editSectionsQuery : addSectionsQuery;
  const sections = sectionsQuery.data?.sections ?? [];
  const resolvedSuiteId = sectionsQuery.data?.suiteId ?? suiteIdFromUrl;
  const sectionOptions = useMemo(() => sectionDestinationOptions(sections), [sections]);
  const selectedSectionId = useMemo(() => {
    if (requestedSectionId != null && sections.some((section) => section.id === requestedSectionId)) {
      return requestedSectionId;
    }
    if (mode === "edit" && caseQuery.data && sections.some((section) => section.id === caseQuery.data.sectionId)) {
      return caseQuery.data.sectionId;
    }
    return sectionOptions[0]?.id ?? null;
  }, [caseQuery.data, mode, requestedSectionId, sectionOptions, sections]);

  const { data: suites = [] } = useQuery({
    queryKey: ["suites", projectId],
    queryFn: () => fetchSuites(projectId),
    enabled: Boolean(projectId)
  });
  const { data: customFields = [] } = useQuery({
    queryKey: ["case-custom-fields", projectId],
    queryFn: () => fetchCustomFieldsForUse(projectId, "case"),
    enabled: Boolean(projectId)
  });
  const { data: caseTemplates = [] } = useQuery({
    queryKey: ["case-templates", projectId],
    queryFn: () => fetchCaseTemplates(projectId),
    enabled: Boolean(projectId)
  });

  const suiteName = suites.find((suite) => suite.id === resolvedSuiteId)?.name;
  const existingCase = mode === "edit" ? caseQuery.data : undefined;
  const selectedTemplate =
    caseTemplates.find((template) => template.id === String(existingCase?.caseTemplateId ?? "")) ??
    caseTemplates.find((template) => template.isDefault) ??
    caseTemplates[0] ??
    null;
  const editShowsBdd = Boolean(
    selectedTemplate?.fields.some((field) => field.trim().toLowerCase() === "scenario") ||
      selectedTemplate?.name.toLowerCase().includes("behaviour")
  );

  const goToList = (
    savedCaseId?: number,
    sectionId = selectedSectionId,
    savedMeta?: { title?: string; priority?: string; type?: string; automationStatus?: string }
  ) => {
    const returnQuery = searchParams.get(CASE_LIST_RETURN_PARAM);
    const hidden =
      savedCaseId != null &&
      isCaseLikelyHiddenByListReturn({
        returnQuery,
        title: savedMeta?.title ?? "",
        priority: savedMeta?.priority ?? "",
        type: savedMeta?.type ?? "",
        automationStatus: savedMeta?.automationStatus
      });
    navigate(
      buildCaseListPathFromReturn({
        projectId,
        returnQuery,
        fallback: { suiteId: resolvedSuiteId || null, sectionId },
        panelCaseId: savedCaseId ?? null,
        savedNotice: hidden
      })
    );
  };

  const goToCasePage = (savedCaseId: number, sectionId = selectedSectionId) => {
    navigate(buildCaseDetailPath(projectId, savedCaseId, { sectionId }));
  };

  const leaveAuthoring = (
    savedCaseId?: number,
    sectionId = selectedSectionId,
    savedMeta?: { title?: string; priority?: string; type?: string; automationStatus?: string }
  ) => {
    if (returnToPage && savedCaseId != null) {
      goToCasePage(savedCaseId, sectionId);
      return;
    }
    if (returnToPage && mode === "edit" && caseId != null && Number.isInteger(caseId)) {
      goToCasePage(caseId, sectionId);
      return;
    }
    goToList(savedCaseId, sectionId, savedMeta);
  };

  // Keep return when changing destination section on the authoring form.
  const setSectionId = (nextSectionId: number) => {
    const next = new URLSearchParams(searchParams);
    if (resolvedSuiteId) next.set("suiteId", resolvedSuiteId);
    next.set("sectionId", String(nextSectionId));
    setSearchParams(next, { replace: true });
  };

  const createMutation = useMutation({
    mutationFn: async (input: Parameters<typeof createAndRefreshCaseAuthoring>[1]["submit"]) => {
      if (selectedSectionId == null) throw new Error("Select a section before adding a test case.");
      saveGenerationRef.current += 1;
      const generation = saveGenerationRef.current;
      const result = await createAndRefreshCaseAuthoring(qc, {
        projectId,
        sectionId: selectedSectionId,
        submit: input,
        saveGeneration: generation,
        isCurrent: () => generation === saveGenerationRef.current,
        resume: persistResumeRef.current
      });
      if (!result.ok) throw new AuthoringPersistError(result);
      return result;
    },
    onError: (error) => {
      if (isAuthoringPersistError(error)) {
        const nextResume = resumeFromOutcome(error.outcome);
        persistResumeRef.current = nextResume;
        setPersistResume(nextResume);
        setSubmitError(error.outcome.message);
        setFormDirty(true);
        return;
      }
      persistResumeRef.current = null;
      setPersistResume(null);
      setSubmitError(extractApiErrorMessage(error, "Could not create case."));
    }
  });

  const uploadStagedAttachmentsForCase = async (caseId: number, caseCode: string | null) => {
    const plan = attachmentUploadPlan(stagedAttachmentsRef.current);
    if (plan.toUpload.length === 0) return true;
    setAttachmentsUploading(true);
    const failedNames: string[] = [];
    try {
      for (const item of plan.toUpload) {
        setStagedAttachments((current) =>
          applyStagedCaseAttachmentPatch(current, item.id, { status: "uploading", progress: 0, message: undefined })
        );
        try {
          await uploadCaseAttachmentViaPresign(caseId, item.file, (progress) => {
            setStagedAttachments((current) =>
              applyStagedCaseAttachmentPatch(current, item.id, { status: "uploading", progress })
            );
          });
          setStagedAttachments((current) =>
            applyStagedCaseAttachmentPatch(current, item.id, { status: "uploaded", progress: 100 })
          );
        } catch (error) {
          failedNames.push(item.file.name);
          setStagedAttachments((current) =>
            applyStagedCaseAttachmentPatch(current, item.id, {
              status: "failed",
              message: extractApiErrorMessage(error, "Upload failed")
            })
          );
        }
      }
    } finally {
      setAttachmentsUploading(false);
    }
    if (failedNames.length > 0) {
      setSubmitError(caseAuthoringAttachmentFailureMessage({ caseCode, failedNames }));
      setFormDirty(true);
      return false;
    }
    return true;
  };

  const finishCreateSuccess = async (
    input: CaseAuthoringSubmitInput,
    created: NonNullable<Awaited<ReturnType<typeof createAndRefreshCaseAuthoring>>["created"]>
  ) => {
    const pendingCount = attachmentUploadPlan(stagedAttachmentsRef.current).toUpload.length;
    if (
      shouldUploadStagedCaseAttachments({
        caseId: created.id,
        bodySaved: true,
        stepsComplete: true,
        pendingCount
      })
    ) {
      const uploaded = await uploadStagedAttachmentsForCase(created.id, created.caseCode);
      if (!uploaded) {
        const resume: AuthoringPersistResume = {
          caseId: created.id,
          caseCode: created.caseCode,
          created,
          bodySaved: true,
          moved: true,
          completedDrafts: [],
          savedStepIds: [],
          failureKind: null
        };
        persistResumeRef.current = resume;
        setPersistResume(resume);
        return;
      }
    }

    persistResumeRef.current = null;
    setPersistResume(null);
    setSubmitError(null);
    setFormDirty(false);
    setStagedAttachments([]);
    setStagingRejectMessage(null);

    if (input.intent === "next") {
      setSuccessNotice(`Successfully added ${created.caseCode ?? "the test case"}. Add another test case below.`);
      setFormKey((current) => current + 1);
      return;
    }
    leaveAuthoring(created.id, selectedSectionId, {
      title: created.title || input.title,
      priority: input.priority,
      type: input.caseType,
      automationStatus: created.automationStatus
    });
  };

  const updateMutation = useMutation({
    mutationFn: async (input: Parameters<typeof persistAndRefreshCaseAuthoring>[1]["submit"]) => {
      if (!existingCase) throw new Error("Could not load test case.");
      if (selectedSectionId == null) throw new Error("Select a section before saving this test case.");
      saveGenerationRef.current += 1;
      const generation = saveGenerationRef.current;
      let existing = existingCase;
      let resume = persistResumeRef.current;
      if (resume?.failureKind === "conflict") {
        const fresh = await caseQuery.refetch();
        if (fresh.data) existing = fresh.data;
        resume = null;
        persistResumeRef.current = null;
      }
      const result = await persistAndRefreshCaseAuthoring(qc, {
        projectId,
        existing,
        sectionId: selectedSectionId,
        submit: input,
        saveGeneration: generation,
        isCurrent: () => generation === saveGenerationRef.current,
        resume
      });
      if (!result.ok) throw new AuthoringPersistError(result);
      return result;
    },
    onSuccess: () => {
      if (!existingCase) return;
      persistResumeRef.current = null;
      setPersistResume(null);
      setSubmitError(null);
      setFormDirty(false);
      leaveAuthoring(existingCase.id, selectedSectionId, {
        title: existingCase.title,
        priority: existingCase.priority,
        type: existingCase.type,
        automationStatus: existingCase.automationStatus
      });
    },
    onError: (error) => {
      if (isAuthoringPersistError(error)) {
        const nextResume = resumeFromOutcome(error.outcome);
        persistResumeRef.current = nextResume;
        setPersistResume(nextResume);
        setSubmitError(error.outcome.message);
        setFormDirty(true);
        return;
      }
      setSubmitError(extractApiErrorMessage(error, "Could not save case changes."));
    }
  });

  const requestLeave = () => {
    draftGuard.requestLeave(() => leaveAuthoring());
  };

  const isSaving = createMutation.isPending || updateMutation.isPending || attachmentsUploading;
  const stagingDirty =
    hasPendingStagedCaseAttachments(stagedAttachments) ||
    stagedAttachments.some((row) => row.status === "uploading") ||
    (mode === "add" && stagedAttachments.length > 0 && !persistResume?.bodySaved);
  const { setDirty, setSaving } = draftGuard;

  useEffect(() => {
    setDirty(formDirty || stagingDirty);
  }, [formDirty, setDirty, stagingDirty]);

  useEffect(() => {
    setSaving(isSaving);
  }, [isSaving, setSaving]);

  const onStageFiles = (files: File[]) => {
    const result = stageCaseAuthoringAttachments(stagedAttachments, files);
    setStagedAttachments(result.next);
    setStagingRejectMessage(result.rejected[0] ?? null);
    if (result.next.length > stagedAttachments.length) setFormDirty(true);
  };

  const onRemoveStaged = (id: string) => {
    setStagedAttachments((current) => removeStagedCaseAttachment(current, id));
    setStagingRejectMessage(null);
  };

  const pageTitle = mode === "edit" ? "Edit Test Case" : "Add Test Case";
  const loadingMessage = mode === "edit" ? "Loading edit test case..." : "Loading add test case...";

  if (mode === "edit" && (caseId == null || Number.isNaN(caseId))) {
    return <ErrorState title="Invalid case link" onRetry={() => goToList()} />;
  }

  if (mode === "edit" && caseQuery.isError) {
    return <ErrorState title="Could not load test case" onRetry={() => void caseQuery.refetch()} />;
  }

  if (sectionsQuery.isError) {
    return <ErrorState title="Could not load sections" onRetry={() => void sectionsQuery.refetch()} />;
  }

  if (sectionsQuery.isLoading || (mode === "edit" && (caseQuery.isLoading || !existingCase))) {
    return <LoadingState message={loadingMessage} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Test Cases"
        title={
          mode === "edit" && existingCase ? `${existingCase.caseCode} ${existingCase.title}` : pageTitle
        }
        description={
          mode === "edit"
            ? suiteName
              ? `Edit test case · Suite: ${suiteName}`
              : "Edit test case"
            : suiteName
              ? `Suite: ${suiteName}`
              : undefined
        }
        actions={
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={requestLeave}
          >
            Back to cases
          </button>
        }
      />

      {isProjectArchived ? (
        <p className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Archived projects are read-only.{" "}
          <button type="button" className="font-medium text-blue-700 underline" onClick={() => leaveAuthoring()}>
            Return to the case repository
          </button>
        </p>
      ) : existingCase?.archivedAt ? (
        <p className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Archived test cases are read-only. Restore the case before editing.
        </p>
      ) : selectedSectionId == null ? (
        <p className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Create a section in this suite before adding a test case.
        </p>
      ) : (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          {successNotice ? (
            <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">
              {successNotice}
            </p>
          ) : null}
          <CaseAuthoringForm
            projectId={projectId}
            valueKey={caseAuthoringValueKey(
              mode === "edit" && existingCase
                ? { mode: "edit", formKey, caseId: existingCase.id, lockVersion: existingCase.lockVersion }
                : { mode: "add", formKey }
            )}
            sectionOptions={sectionOptions}
            selectedSectionId={selectedSectionId}
            onSectionIdChange={setSectionId}
            initialTitle={existingCase?.title ?? ""}
            initialPreconditions={existingCase?.preconditions ?? ""}
            initialEstimate={existingCase && existingCase.estimate !== "-" ? existingCase.estimate : ""}
            initialReferences={existingCase?.references ?? ""}
            initialExpectedResult={existingCase?.expectedResult ?? ""}
            initialCaseType={existingCase?.type}
            initialPriority={existingCase?.priority}
            initialSteps={existingCase?.steps ?? []}
            initialCaseTemplateId={existingCase?.caseTemplateId != null ? String(existingCase.caseTemplateId) : null}
            initialCustomValues={existingCase ? authoringCustomValuesFromCase(existingCase) : {}}
            customFields={customFields}
            templates={caseTemplates}
            submitLabel={
              isSaving
                ? attachmentsUploading
                  ? "Uploading..."
                  : mode === "edit"
                    ? "Saving..."
                    : "Adding..."
                : mode === "edit"
                  ? "Save Test Case"
                  : "Add Test Case"
            }
            nextSubmitLabel={mode === "edit" ? null : "Add & Next"}
            isSubmitting={isSaving}
            submitError={submitError}
            showRetry={Boolean(persistResume && submitError)}
            onDirtyChange={setFormDirty}
            beforeActions={
              mode === "add" ? (
                <CaseAttachmentStagingPanel
                  files={stagedAttachments}
                  disabled={isSaving || isProjectArchived}
                  rejectMessage={stagingRejectMessage}
                  onAddFiles={onStageFiles}
                  onRemove={onRemoveStaged}
                />
              ) : null
            }
            onSubmit={async (input) => {
              setSuccessNotice(null);
              if (mode === "edit") {
                await updateMutation.mutateAsync(input);
                return;
              }
              try {
                const result = await createMutation.mutateAsync(input);
                if (result.created) {
                  await finishCreateSuccess(input, result.created);
                }
              } catch {
                // createMutation.onError already stored resume / message
              }
            }}
            onCancel={requestLeave}
          />
          {mode === "edit" && existingCase && editShowsBdd ? (
            <div className="mt-6 border-t border-slate-200 pt-5">
              <BddScenarioEditor caseId={String(existingCase.id)} disabled={isSaving} />
            </div>
          ) : null}
        </section>
      )}

      <ConfirmDialog
        open={draftGuard.confirmOpen}
        title={mode === "edit" ? "Discard unsaved changes?" : "Discard unsaved case?"}
        description={authoringLeaveDescription({
          mode,
          bodySaved: Boolean(persistResume?.bodySaved),
          stepsComplete: persistResume == null,
          caseCode: persistResume?.caseCode,
          hasPendingAttachments:
            Boolean(persistResume?.bodySaved) && hasPendingStagedCaseAttachments(stagedAttachments)
        })}
        cancelLabel="Keep editing"
        confirmLabel="Discard changes"
        variant="danger"
        onCancel={draftGuard.keepEditing}
        onConfirm={draftGuard.discardAndLeave}
      />
    </div>
  );
}

export function AddCasePage() {
  return <CaseAuthoringScreen mode="add" />;
}

export function EditCasePage() {
  const { caseId: caseIdParam = "" } = useParams();
  return <CaseAuthoringScreen mode="edit" caseId={Number(caseIdParam)} />;
}
