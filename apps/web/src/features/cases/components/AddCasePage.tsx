import { useMemo, useState } from "react";
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
import { caseKeys } from "../hooks/useCases";
import { caseDetailKeys, useCaseDetail } from "../hooks/useCaseDetail";
import { sectionKeys, useSections } from "../hooks/useSections";
import { fetchSectionsForProject } from "../api/catalogApi";
import { authoringCustomValuesFromCase } from "../utils/authoringCustomValuesFromCase";
import { createCaseFromAuthoring } from "../utils/createCaseFromAuthoring";
import { updateCaseFromAuthoring } from "../utils/updateCaseFromAuthoring";
import { sectionDestinationOptions } from "../utils/sectionTreeModel";
import { BddScenarioEditor } from "./BddScenarioEditor";
import { CaseAuthoringForm } from "./CaseAuthoringForm";

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
  const [discardOpen, setDiscardOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

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

  const goToList = (savedCaseId?: number, sectionId = selectedSectionId) => {
    const params = new URLSearchParams();
    if (resolvedSuiteId) params.set("suiteId", resolvedSuiteId);
    if (sectionId != null) params.set("sectionId", String(sectionId));
    if (savedCaseId != null) {
      params.set("panelCaseId", String(savedCaseId));
      params.set("focusCaseId", String(savedCaseId));
    }
    const query = params.toString();
    navigate(`/projects/${projectId}/cases${query ? `?${query}` : ""}`);
  };

  const goToCasePage = (savedCaseId: number, sectionId = selectedSectionId) => {
    navigate(buildCaseDetailPath(projectId, savedCaseId, { sectionId }));
  };

  const leaveAuthoring = (savedCaseId?: number, sectionId = selectedSectionId) => {
    if (returnToPage && savedCaseId != null) {
      goToCasePage(savedCaseId, sectionId);
      return;
    }
    if (returnToPage && mode === "edit" && caseId != null && Number.isInteger(caseId)) {
      goToCasePage(caseId, sectionId);
      return;
    }
    goToList(savedCaseId, sectionId);
  };

  const setSectionId = (nextSectionId: number) => {
    const next = new URLSearchParams(searchParams);
    if (resolvedSuiteId) next.set("suiteId", resolvedSuiteId);
    next.set("sectionId", String(nextSectionId));
    setSearchParams(next, { replace: true });
  };

  const createMutation = useMutation({
    mutationFn: async (input: Parameters<typeof createCaseFromAuthoring>[1]) => {
      if (selectedSectionId == null) throw new Error("Select a section before adding a test case.");
      return createCaseFromAuthoring(selectedSectionId, input);
    },
    onSuccess: ({ created, stepsWarning }, input) => {
      void qc.invalidateQueries({ queryKey: caseKeys.all(projectId) });
      void qc.invalidateQueries({ queryKey: ["suite-summary", projectId] });
      void qc.invalidateQueries({ queryKey: sectionKeys.all(projectId) });
      setSubmitError(null);
      if (input.intent === "next") {
        setSuccessNotice(
          stepsWarning
            ? `Added ${created.caseCode}. Steps could not be saved (${stepsWarning}).`
            : `Successfully added ${created.caseCode}. Add another test case below.`
        );
        setFormDirty(false);
        setFormKey((current) => current + 1);
        return;
      }
      leaveAuthoring(created.id);
    },
    onError: (error) => {
      setSubmitError(extractApiErrorMessage(error, "Could not create case."));
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (input: Parameters<typeof updateCaseFromAuthoring>[3]) => {
      if (!existingCase) throw new Error("Could not load test case.");
      if (selectedSectionId == null) throw new Error("Select a section before saving this test case.");
      return updateCaseFromAuthoring(projectId, existingCase, selectedSectionId, input);
    },
    onSuccess: ({ stepsWarning }) => {
      if (!existingCase) return;
      void qc.invalidateQueries({ queryKey: caseKeys.all(projectId) });
      void qc.invalidateQueries({ queryKey: caseDetailKeys.detail(existingCase.id) });
      void qc.invalidateQueries({ queryKey: ["case-versions", existingCase.id] });
      void qc.invalidateQueries({ queryKey: ["suite-summary", projectId] });
      void qc.invalidateQueries({ queryKey: sectionKeys.all(projectId) });
      setSubmitError(null);
      setFormDirty(false);
      if (stepsWarning) {
        setSuccessNotice(`Saved ${existingCase.caseCode}. Steps could not be saved (${stepsWarning}).`);
        return;
      }
      leaveAuthoring(existingCase.id, selectedSectionId);
    },
    onError: (error) => {
      setSubmitError(extractApiErrorMessage(error, "Could not save case changes."));
    }
  });

  const requestLeave = () => {
    if (formDirty) {
      setDiscardOpen(true);
      return;
    }
    leaveAuthoring();
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
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
            valueKey={
              mode === "edit" && existingCase
                ? `edit:${existingCase.id}:${existingCase.lockVersion}`
                : `add:${selectedSectionId}:${formKey}`
            }
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
              isSaving ? (mode === "edit" ? "Saving..." : "Adding...") : mode === "edit" ? "Save Test Case" : "Add Test Case"
            }
            nextSubmitLabel={mode === "edit" ? null : "Add & Next"}
            isSubmitting={isSaving}
            submitError={submitError}
            onDirtyChange={setFormDirty}
            onSubmit={async (input) => {
              setSuccessNotice(null);
              if (mode === "edit") {
                await updateMutation.mutateAsync(input);
                return;
              }
              await createMutation.mutateAsync(input);
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
        open={discardOpen}
        title={mode === "edit" ? "Discard unsaved changes?" : "Discard unsaved case?"}
        description={
          mode === "edit"
            ? "Your unsaved test case changes will be lost."
            : "Your changes to this new test case will be lost."
        }
        cancelLabel="Keep editing"
        confirmLabel="Discard changes"
        variant="danger"
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => {
          setDiscardOpen(false);
          leaveAuthoring();
        }}
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
