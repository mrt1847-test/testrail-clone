export type PrintMetaRow = { label: string; value: string };

export type PrintTable = {
  title: string;
  columns: string[];
  rows: string[][];
};

export type PrintDocumentEntityType = "case" | "cases" | "run" | "plan" | "milestone" | "report";

export type PrintDocumentSection = {
  entityType: PrintDocumentEntityType;
  title: string;
  subtitle?: string;
  meta: PrintMetaRow[];
  tables: PrintTable[];
  notes?: string[];
};

export type PrintDocument = {
  entityType: PrintDocumentEntityType;
  title: string;
  subtitle?: string;
  generatedAt: string;
  meta: PrintMetaRow[];
  tables: PrintTable[];
  notes?: string[];
  sections?: PrintDocumentSection[];
};

export const MAX_CASES_PER_PRINT = 50;
