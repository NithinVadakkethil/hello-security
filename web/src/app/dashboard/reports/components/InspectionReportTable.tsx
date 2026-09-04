'use client';

import { AlertTriangle, ArrowUpDown, Eye } from 'lucide-react';
import Pagination from '../../../components/ui/Pagination';
import StatusChip from '../../../components/ui/StatusChip';
import { formatPatrolDateTime } from '@/lib/date-formatter';

export interface InspectionRow {
  id: string;
  patrolCode: string;
  status: 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  startedAt: string;
  endedAt?: string | null;
  totalDuration?: number | null;
  remarks?: string | null;
  assignment: {
    employee: {
      firstName: string;
      lastName: string;
      employeeNumber: string;
      photo?: string | null;
    };
    site: {
      name: string;
    };
    patrolRoute?: {
      name: string;
      routeGates?: any[];
    } | null;
    assignmentGates?: any[];
  };
  checkpoints?: any[];
  incidents?: any[];
  snags?: any[];
}

interface InspectionReportTableProps {
  data: InspectionRow[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  totalItems: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onSelectRow: (row: InspectionRow) => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
}

export default function InspectionReportTable({
  data,
  isLoading,
  page,
  totalPages,
  totalItems,
  limit,
  onPageChange,
  onLimitChange,
  onSelectRow,
  sortBy,
  sortOrder,
  onSort,
}: InspectionReportTableProps) {
  const getSortIcon = (field: string) => {
    if (sortBy !== field)
      return <ArrowUpDown size={13} style={{ opacity: 0.4 }} />;
    return (
      <ArrowUpDown
        size={13}
        style={{ color: 'var(--primary)', fontWeight: 700 }}
      />
    );
  };

  return (
    <div
      className="glass-card"
      style={{
        padding: '24px',
        borderRadius: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
          Inspection Log Records ({totalItems} Found)
        </h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Rows per page:
          </span>
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            style={{
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-color)',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
            }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: '0.85rem',
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: '2px solid var(--border-color)',
                color: 'var(--text-secondary)',
              }}
            >
              <th
                style={{ padding: '12px 16px', cursor: 'pointer' }}
                onClick={() => onSort('patrolCode')}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <span>Report Code</span>
                  {getSortIcon('patrolCode')}
                </div>
              </th>
              <th
                style={{ padding: '12px 16px', cursor: 'pointer' }}
                onClick={() => onSort('startedAt')}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <span>Date & Time</span>
                  {getSortIcon('startedAt')}
                </div>
              </th>
              <th style={{ padding: '12px 16px' }}>Security Officer</th>
              <th style={{ padding: '12px 16px' }}>Monitored Site</th>
              <th style={{ padding: '12px 16px' }}>Route / Target</th>
              <th style={{ padding: '12px 16px' }}>Status</th>
              <th style={{ padding: '12px 16px' }}>Compliance</th>
              {/* <th style={{ padding: '12px 16px' }}>Duration</th> */}
              <th style={{ padding: '12px 16px' }}>Issues</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(5)].map((_, rowIndex) => (
                <tr
                  key={rowIndex}
                  style={{ borderBottom: '1px solid var(--border-color)' }}
                >
                  {[...Array(10)].map((_, colIndex) => (
                    <td key={colIndex} style={{ padding: '16px' }}>
                      <div
                        className="skeleton-loading"
                        style={{
                          height: '18px',
                          borderRadius: '4px',
                          width: `${50 + ((colIndex * 11 + rowIndex * 13) % 40)}%`,
                        }}
                      ></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  style={{
                    textAlign: 'center',
                    padding: '48px 16px',
                    color: 'var(--text-muted)',
                  }}
                >
                  No inspection logs match the selected filters.
                </td>
              </tr>
            ) : (
              data.map((row) => {
                const isDirectAssignment =
                  (row.assignment as any)?.assignmentType === 'DIRECT_CHECKPOINTS' ||
                  (!row.assignment?.patrolRoute &&
                    (row.assignment?.assignmentGates?.length || 0) > 0);

                const totalGates = isDirectAssignment
                  ? row.assignment?.assignmentGates?.length || 0
                  : row.assignment?.patrolRoute?.routeGates?.length || 0;

                const scannedCount = new Set(
                  (row.checkpoints || []).map((cp: any) => cp.gateId || cp.id),
                ).size;

                const compliancePct =
                  totalGates > 0
                    ? Math.round((scannedCount / totalGates) * 100)
                    : 100;
                // const durationMins = row.totalDuration
                //   ? Math.round(row.totalDuration / 60)
                //   : 0;
                const issueCount =
                  (row.incidents?.length || 0) + (row.snags?.length || 0);

                return (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      transition: 'background-color 0.15s ease',
                    }}
                    className="table-row-hover"
                  >
                    <td
                      style={{
                        padding: '14px 16px',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                      }}
                    >
                      {row.patrolCode}
                    </td>
                    <td
                      style={{
                        padding: '14px 16px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {formatPatrolDateTime(row.startedAt)}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                      >
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(59, 130, 246, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            color: 'var(--primary)',
                          }}
                        >
                          {row.assignment?.employee?.firstName?.[0] || 'G'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            {row.assignment?.employee?.firstName}{' '}
                            {row.assignment?.employee?.lastName}
                          </div>
                          <div
                            style={{
                              fontSize: '0.72rem',
                              color: 'var(--text-muted)',
                              fontFamily: 'monospace',
                            }}
                          >
                            ID:{' '}
                            {row.assignment?.employee?.employeeNumber || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 500 }}>
                      {row.assignment?.site?.name || 'N/A'}
                    </td>
                    <td
                      style={{
                        padding: '14px 16px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {row.assignment?.patrolRoute?.name || '🚧 Checkpoints'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <StatusChip status={row.status} />
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>
                          {scannedCount} / {totalGates} ({compliancePct}%)
                        </span>
                        <div
                          style={{
                            width: '80px',
                            height: '5px',
                            backgroundColor: 'var(--border-color)',
                            borderRadius: '3px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, compliancePct)}%`,
                              height: '100%',
                              backgroundColor:
                                compliancePct === 100 ? '#10b981' : '#3b82f6',
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    {/* <td
                      style={{
                        padding: '14px 16px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {durationMins > 0
                        ? `${durationMins} mins`
                        : 'In Progress'}
                    </td> */}
                    <td style={{ padding: '14px 16px' }}>
                      {issueCount > 0 ? (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '4px 8px',
                            borderRadius: '12px',
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <AlertTriangle size={12} />
                          {issueCount} Reported
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                          }}
                        >
                          0 Issues
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => onSelectRow(row)}
                        className="btn btn-secondary"
                        style={{
                          fontSize: '0.78rem',
                          padding: '6px 12px',
                          gap: '6px',
                        }}
                      >
                        <Eye size={14} />
                        <span>Report</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
