export const caseDeleteCopy = {
  markDeletedTitle: "Mark test case as deleted?",
  markDeletedDescription:
    "The test case will be hidden from the active repository and run composition. You can restore it from the deleted view or case history.",
  markDeletedConfirm: "Mark as deleted",
  markDeletedBulkTitle: "Mark selected test cases as deleted?",
  undeleteTitle: "Restore deleted test case?",
  undeleteDescription: "The test case will return to the active repository list.",
  undeleteConfirm: "Undelete",
  undeleteBulkTitle: "Restore selected test cases?",
  permanentTitle: "Delete test case permanently?",
  permanentDescription:
    "This permanently removes the test case and its history from the project. Associated tests and results may also be removed. This cannot be undone.",
  permanentConfirm: "Delete permanently",
  permanentBulkTitle: "Delete test cases permanently?",
  permanentBulkDescription:
    "This permanently removes the selected test cases from the project. Associated tests and results may also be removed. This cannot be undone."
} as const;
