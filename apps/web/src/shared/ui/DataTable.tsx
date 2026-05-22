import type { ReactNode } from "react";

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  align?: "left" | "right";
  cell: (row: T) => ReactNode;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  dense?: boolean;
  className?: string;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = "No rows to display.",
  dense = false,
  className = ""
}: DataTableProps<T>) {
  const cellPad = dense ? "px-2 py-1.5" : "px-3 py-2";

  return (
    <div className={`overflow-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 ${className}`}>
      <table className="w-full min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`${cellPad} ${column.align === "right" ? "text-right" : ""} ${column.headerClassName ?? ""}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={`${cellPad} text-slate-500`}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="align-top">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`${cellPad} ${column.align === "right" ? "text-right" : ""} ${column.cellClassName ?? ""}`}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
