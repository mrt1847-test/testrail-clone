export type PrintMetaRow = { label: string; value: string };

export type PrintTable = {
  title: string;
  columns: string[];
  rows: string[][];
};

export type PrintDocument = {
  entityType: "case" | "run" | "plan" | "milestone";
  title: string;
  subtitle?: string;
  generatedAt: string;
  meta: PrintMetaRow[];
  tables: PrintTable[];
  notes?: string[];
};
