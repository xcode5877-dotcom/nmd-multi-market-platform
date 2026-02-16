import { forwardRef } from 'react';

export interface DataTableProps extends React.HTMLAttributes<HTMLDivElement> {
  columns: { key: string; label: string; className?: string }[];
  rows: Record<string, React.ReactNode>[];
  emptyMessage?: string;
  onRowClick?: (row: Record<string, React.ReactNode>, index: number) => void;
}

export const DataTable = forwardRef<HTMLDivElement, DataTableProps>(
  ({ columns, rows, emptyMessage = 'لا توجد بيانات', onRowClick, className = '', ...props }, ref) => (
    <div ref={ref} className={`overflow-x-auto rounded-[var(--radius)] border border-gray-200 ${className}`} {...props}>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-start font-medium text-gray-700 ${col.className ?? ''}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={i}
                onClick={() => onRowClick?.(row, i)}
                className={`border-t border-gray-100 ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 ${col.className ?? ''}`}>
                    {row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
);

DataTable.displayName = 'DataTable';
