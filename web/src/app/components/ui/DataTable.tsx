import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data?: T[];
  isLoading?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  emptyMessage?: string;
}

export default function DataTable<T extends { id: string | number }>({
  columns,
  data = [],
  isLoading = false,
  sortBy,
  sortOrder,
  onSort,
  emptyMessage = 'No data available.',
}: DataTableProps<T>) {
  return (
    <div className="glass-card table-container" style={{ overflowX: 'auto', width: '100%' }}>
      <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: '16px 20px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-secondary)',
                  cursor: col.sortable && onSort ? 'pointer' : 'default',
                  userSelect: 'none',
                }}
                onClick={() => col.sortable && onSort && onSort(col.key)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{col.label}</span>
                  {col.sortable && onSort && (
                    <span style={{ color: sortBy === col.key ? 'var(--primary)' : 'var(--text-muted)' }}>
                      {sortBy === col.key ? (
                        sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            [...Array(5)].map((_, rowIndex) => (
              <tr key={rowIndex} style={{ borderBottom: '1px solid var(--border-color)' }}>
                {columns.map((col) => (
                  <td key={col.key} style={{ padding: '20px' }}>
                    <div className="skeleton-loading" style={{ height: '18px', borderRadius: '4px', width: '80%' }}></div>
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <p style={{ fontSize: '0.95rem', fontWeight: 500 }}>{emptyMessage}</p>
                </div>
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={row.id}
                className="table-row hover-effect"
                style={{ borderBottom: '1px solid var(--border-color)', transition: 'background var(--transition-fast)' }}
              >
                {columns.map((col) => (
                  <td key={col.key} style={{ padding: '16px 20px', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {col.render ? col.render(row) : (row[col.key as keyof T] as unknown as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      <style jsx>{`
        .table-row:hover {
          background: var(--bg-tertiary);
        }
      `}</style>
    </div>
  );
}
