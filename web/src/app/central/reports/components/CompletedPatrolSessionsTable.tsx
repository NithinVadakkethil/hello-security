'use client';

import React, { useMemo } from 'react';
import { Download, Eye } from 'lucide-react';
import DataTable from '@/app/components/ui/DataTable';
import Pagination from '@/app/components/ui/Pagination';
import StatusChip from '@/app/components/ui/StatusChip';

export interface CompletedPatrolRow {
  id: string;
  patrolCode: string;
  status: string;
  checkpointCompletionStatus?: string;
  startedAt: string;
  endedAt: string | null;
  dateFormatted: string;
  startTimeFormatted: string;
  endTimeFormatted: string;
  siteName: string;
  routeName: string;
  shiftName: string;
  durationSeconds: number;
  durationFormatted: string;
  scannedCheckpoints: number;
  totalCheckpoints: number;
  missedCheckpoints?: number;
  compliancePct: number;
  remarks: string | null;
  employeeId?: string | null;
  employeeName?: string;
  employeeCode?: string;
  employeeRole?: string;
  emiratesId?: string | null;
}

export interface CompletedPatrolSessionsTableProps {
  patrols: CompletedPatrolRow[];
  showEmployeeColumn?: boolean;
  showSiteColumn?: boolean;
  showComplianceColumn?: boolean;
  isLoading?: boolean;
  clientId: string;
  onViewReport: (patrolId: string) => void;
  onDownloadPdf?: (patrolId: string, patrolCode: string) => void;
  onOpenMissedModal?: (patrolId: string, patrolCode: string) => void;
  page?: number;
  pageSize?: number | 'all';
  totalPages?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number | 'all') => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  emptyMessage?: string;
}

/**
 * Authoritatively derives the patrol checkpoint reporting status:
 * - COMPLETED: Finalized patrol with eligible checkpoints > 0, 100% scanned, 0 missed.
 * - INCOMPLETE: Finalized patrol that missed at least 1 eligible checkpoint.
 * - IN_PROGRESS: Ongoing patrol session (not finalized).
 * - NO_CHECKPOINTS: Finalized patrol with 0 eligible checkpoints (0/0).
 * - CANCELLED / FAILED: Preserves actual lifecycle status.
 */
export function derivePatrolReportingStatus(row: {
  status: string;
  checkpointCompletionStatus?: string;
  endedAt?: string | null;
  totalCheckpoints: number;
  scannedCheckpoints: number;
  missedCheckpoints?: number;
}): string {
  if (row.checkpointCompletionStatus) {
    return row.checkpointCompletionStatus;
  }
  const lifecycle = (row.status || '').toUpperCase();
  if (lifecycle === 'CANCELLED' || lifecycle === 'FAILED') {
    return lifecycle;
  }
  const isFinalized = lifecycle === 'COMPLETED' || Boolean(row.endedAt);
  if (!isFinalized) {
    return 'IN_PROGRESS';
  }
  const total = row.totalCheckpoints || 0;
  const scanned = row.scannedCheckpoints || 0;
  const missed =
    row.missedCheckpoints !== undefined ? row.missedCheckpoints : Math.max(0, total - scanned);

  if (total === 0) {
    return 'NO_CHECKPOINTS';
  }
  if (missed === 0 && scanned >= total) {
    return 'COMPLETED';
  }
  return 'INCOMPLETE';
}

export default function CompletedPatrolSessionsTable({
  patrols,
  showEmployeeColumn = true,
  showSiteColumn = false,
  showComplianceColumn = false,
  isLoading = false,
  clientId,
  onViewReport,
  onDownloadPdf,
  onOpenMissedModal,
  page = 1,
  pageSize = 20,
  totalPages = 1,
  totalCount = 0,
  onPageChange,
  onPageSizeChange,
  sortBy = 'startedAt',
  sortOrder = 'desc',
  onSort,
  emptyMessage = 'No completed patrol sessions found matching the selected reporting filters.',
}: CompletedPatrolSessionsTableProps) {
  const columns = useMemo(() => {
    const cols: any[] = [
      {
        key: 'patrolCode',
        label: 'Patrol Code',
        sortable: true,
        render: (row: CompletedPatrolRow) => (
          <button
            type="button"
            onClick={() => onViewReport(row.id)}
            style={{
              fontWeight: 700,
              color: '#2563eb',
              fontSize: '0.88rem',
              fontFamily: 'monospace',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
              textAlign: 'left',
            }}
            title={`View detailed inspection report for ${row.patrolCode}`}
            aria-label={`View detailed inspection report for ${row.patrolCode}`}
          >
            {row.patrolCode}
          </button>
        ),
      },
    ];

    if (showEmployeeColumn) {
      cols.push({
        key: 'employeeName',
        label: 'Employee',
        sortable: true,
        render: (row: CompletedPatrolRow) => {
          const empName = row.employeeName || '—';
          const empCode = row.employeeCode && row.employeeCode !== '—' ? row.employeeCode : null;
          const roleLabel = row.employeeRole && row.employeeRole !== '—' ? row.employeeRole : null;
          const emiratesId = row.emiratesId && row.emiratesId !== '—' && row.emiratesId !== 'Not provided' ? row.emiratesId : null;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                {empName}
              </span>
              {(empCode || roleLabel) && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    fontFamily: empCode ? 'monospace' : 'inherit',
                  }}
                >
                  {[empCode, roleLabel].filter(Boolean).join(' • ')}
                </span>
              )}
              {emiratesId && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: '#6b7280',
                    fontFamily: 'monospace',
                  }}
                >
                  EID: {emiratesId}
                </span>
              )}
            </div>
          );
        },
      });
    }

    cols.push({
      key: 'startedAt',
      label: 'Date',
      sortable: true,
      render: (row: CompletedPatrolRow) => (
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>
          {row.dateFormatted}
        </span>
      ),
    });

    if (showSiteColumn) {
      cols.push({
        key: 'siteName',
        label: 'Site',
        render: (row: CompletedPatrolRow) => (
          <span style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>{row.siteName}</span>
        ),
      });
    }

    cols.push(
      {
        key: 'routeName',
        label: 'Route / Target',
        render: (row: CompletedPatrolRow) => (
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {row.routeName}
          </span>
        ),
      },
      {
        key: 'shiftName',
        label: 'Shift',
        render: (row: CompletedPatrolRow) => (
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {row.shiftName}
          </span>
        ),
      },
      {
        key: 'startTime',
        label: 'Start Time',
        render: (row: CompletedPatrolRow) => (
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {row.startTimeFormatted}
          </span>
        ),
      },
      {
        key: 'endTime',
        label: 'Completion Time',
        render: (row: CompletedPatrolRow) => (
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {row.endTimeFormatted}
          </span>
        ),
      },
      {
        key: 'durationSeconds',
        label: 'Duration',
        sortable: true,
        render: (row: CompletedPatrolRow) => (
          <span style={{ fontWeight: 600, color: '#1e40af', fontSize: '0.85rem' }}>
            {row.durationFormatted || '0 sec'}
          </span>
        ),
      },
      {
        key: 'checkpoints',
        label: 'Checkpoints',
        render: (row: CompletedPatrolRow) => {
          const missed =
            row.missedCheckpoints !== undefined
              ? row.missedCheckpoints
              : Math.max(0, (row.totalCheckpoints || 0) - (row.scannedCheckpoints || 0));

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{row.totalCheckpoints}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Scanned:</span>
                <strong style={{ color: '#16a34a' }}>{row.scannedCheckpoints}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Missed:</span>
                {missed > 0 && onOpenMissedModal ? (
                  <button
                    type="button"
                    onClick={() => onOpenMissedModal(row.id, row.patrolCode)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: '#dc2626',
                      backgroundColor: 'rgba(220, 38, 38, 0.1)',
                      border: '1px solid rgba(220, 38, 38, 0.25)',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      textUnderlineOffset: '2px',
                    }}
                    title={`View ${missed} missed checkpoint(s) for ${row.patrolCode}`}
                    aria-label={`View ${missed} missed checkpoint(s) for ${row.patrolCode}`}
                  >
                    {missed}
                  </button>
                ) : (
                  <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>0</span>
                )}
              </div>
            </div>
          );
        },
      },
    );

    if (showComplianceColumn) {
      cols.push({
        key: 'compliancePct',
        label: 'Compliance',
        sortable: true,
        render: (row: CompletedPatrolRow) => {
          const comp = row.compliancePct ?? 0;
          const bg =
            comp >= 90
              ? 'rgba(22, 163, 74, 0.1)'
              : comp >= 70
                ? 'rgba(217, 119, 6, 0.1)'
                : 'rgba(220, 38, 38, 0.1)';
          const color = comp >= 90 ? '#16a34a' : comp >= 70 ? '#d97706' : '#dc2626';
          return (
            <span
              style={{
                fontWeight: 700,
                fontSize: '0.8rem',
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: bg,
                color,
              }}
            >
              {comp}%
            </span>
          );
        },
      });
    }

    cols.push(
      {
        key: 'status',
        label: 'Status',
        render: (row: CompletedPatrolRow) => <StatusChip status={derivePatrolReportingStatus(row)} />,
      },
      {
        key: 'actions',
        label: 'Action',
        render: (row: CompletedPatrolRow) => (
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => onViewReport(row.id)}
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: '0.8rem', gap: '4px', cursor: 'pointer' }}
              title="View detailed inspection report"
            >
              <Eye size={14} />
              <span>Report</span>
            </button>
            {onDownloadPdf && (
              <button
                type="button"
                onClick={() => onDownloadPdf(row.id, row.patrolCode)}
                className="btn btn-secondary"
                style={{
                  padding: '6px 10px',
                  fontSize: '0.8rem',
                  color: '#2563eb',
                  cursor: 'pointer',
                }}
                title="Download PDF"
              >
                <Download size={14} />
              </button>
            )}
          </div>
        ),
      }
    );

    return cols;
  }, [showEmployeeColumn, showSiteColumn, onViewReport, onDownloadPdf, onOpenMissedModal]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <DataTable
        columns={columns}
        data={patrols}
        isLoading={isLoading}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={onSort}
        emptyMessage={emptyMessage}
      />

      {/* Pagination */}
      {!isLoading && totalCount > 0 && onPageChange && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
          pageSize={pageSize}
          pageSizeOptions={[10, 20, 50, 'all']}
          onPageSizeChange={onPageSizeChange}
          totalRecords={totalCount}
        />
      )}
    </div>
  );
}
