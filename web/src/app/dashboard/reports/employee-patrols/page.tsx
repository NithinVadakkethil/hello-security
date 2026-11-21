'use client';

import React, { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Download,
  Eye,
  RefreshCw,
  ShieldCheck,
  User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../../../lib/axios';
import DetailedReportModal from '../components/DetailedReportModal';
import DataTable from '../../../components/ui/DataTable';
import Pagination from '../../../components/ui/Pagination';
import StatusChip from '../../../components/ui/StatusChip';

interface EmployeePatrolsData {
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string | null;
    fullName: string;
    role: string;
    roleLabel: string;
    designation: string | null;
    emiratesId?: string | null;
  };
  project: {
    id: string;
    companyName: string;
    clientCode: string;
    clientLogoUrl?: string | null;
  };
  period: {
    periodType: string;
    periodLabel: string;
    startDate: string;
    endDate: string;
    timezone: string;
  };
  filters: {
    shiftId: string | null;
    siteId: string | null;
    role: string | null;
  };
  summary: {
    totalCompletedPatrols: number;
    totalPatrolDurationSeconds: number;
    totalPatrolDurationFormatted: string;
    totalCheckpointsScanned: number;
    totalCheckpointsRequired: number;
    averageCompliancePct: number;
  };
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    totalCount: number;
  };
  patrols: Array<{
    id: string;
    patrolCode: string;
    status: string;
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
    compliancePct: number;
    remarks: string | null;
  }>;
}

function ClientAdminEmployeeCompletedPatrolsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Query Parameters
  const clientId = searchParams.get('clientId') || '';
  const employeeId = searchParams.get('employeeId') || '';
  const periodType = searchParams.get('periodType') || 'DAILY';
  const date = searchParams.get('date') || '';
  const month = searchParams.get('month') || '';
  const week = searchParams.get('week') || '';
  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';
  const fromDate = searchParams.get('fromDate') || '';
  const toDate = searchParams.get('toDate') || '';
  const shiftId = searchParams.get('shiftId') || '';
  const siteId = searchParams.get('siteId') || '';
  const role = searchParams.get('role') || '';

  // Pagination & Sorting state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(20);
  const [sortBy, setSortBy] = useState('startedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Data & Loading state
  const [data, setData] = useState<EmployeePatrolsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected report for DetailedReportModal
  const [selectedReport, setSelectedReport] = useState<any | null>(null);

  // Fetch drill-down completed patrols
  const fetchPatrols = useCallback(async () => {
    if (!employeeId) {
      setIsLoading(false);
      setError('Employee ID is required to view employee completed patrols.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const limitVal = pageSize === 'all' ? 100 : Number(pageSize);
      const params = new URLSearchParams({
        employeeId,
        periodType,
        page: page.toString(),
        limit: limitVal.toString(),
        sortBy,
        sortOrder,
      });

      if (clientId) params.append('clientId', clientId);
      if (date) params.append('date', date);
      if (month) params.append('month', month);
      if (week) params.append('week', week);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      if (shiftId) params.append('shiftId', shiftId);
      if (siteId) params.append('siteId', siteId);
      if (role) params.append('role', role);

      let res: any;
      try {
        res = await apiClient.get(`/reports/employee-patrols?${params.toString()}`);
      } catch (err: any) {
        // Fallback to central manager endpoint if scoped with clientId
        if (clientId) {
          res = await apiClient.get(`/central-manager/reports/employee-patrols?${params.toString()}`);
        } else {
          throw err;
        }
      }

      const payload: EmployeePatrolsData = res?.data || res;
      setData(payload);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error?.message ||
        'Failed to load employee completed patrols.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [
    clientId,
    employeeId,
    periodType,
    date,
    month,
    week,
    startDate,
    endDate,
    fromDate,
    toDate,
    shiftId,
    siteId,
    role,
    page,
    pageSize,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    fetchPatrols();
  }, [fetchPatrols]);

  // Back to Periodic Report handler - Preserves exact context & filters
  const handleBackToPeriodicReport = () => {
    const params = new URLSearchParams();
    if (clientId) params.append('clientId', clientId);
    if (periodType) {
      params.append('reportType', periodType);
      params.append('periodType', periodType);
    }
    if (date) params.append('date', date);
    if (month) params.append('month', month);
    if (week) params.append('week', week);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    if (shiftId) params.append('shiftId', shiftId);
    if (siteId) params.append('siteId', siteId);
    if (role) params.append('role', role);

    params.append('tab', 'employeeSummary');
    router.push(`/dashboard/reports?${params.toString()}`);
  };

  // View Detailed Inspection Report
  const handleViewReport = async (patrolId: string) => {
    try {
      toast.loading('Loading report details...', { id: 'report-modal-toast' });
      const res: any = await apiClient.get(`/reports/inspections/${patrolId}`);
      const session = res?.data || res;
      setSelectedReport(session);
      toast.dismiss('report-modal-toast');
    } catch (err: any) {
      toast.error('Failed to load patrol inspection report', { id: 'report-modal-toast' });
    }
  };

  // Download PDF Report
  const handleDownloadPdf = async (patrolId: string, patrolCode: string) => {
    try {
      toast.loading('Generating PDF...', { id: 'pdf-toast' });
      const res: any = await apiClient.get(
        `/reports/inspections/${patrolId}/pdf`,
        { responseType: 'blob' },
      );
      const blob = res?.data || res;
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.setAttribute('download', `Patrol_Report_${patrolCode || patrolId}.pdf`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('Report downloaded successfully', { id: 'pdf-toast' });
    } catch (err: any) {
      toast.error('Failed to download PDF', { id: 'pdf-toast' });
    }
  };

  // Sorting handler
  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('desc');
    }
  };

  // Table Columns Definition
  const columns = useMemo(
    () => [
      {
        key: 'patrolCode',
        label: 'Patrol Code',
        sortable: true,
        render: (row: any) => (
          <span style={{ fontWeight: 700, color: '#2563eb', fontSize: '0.88rem', fontFamily: 'monospace' }}>
            {row.patrolCode}
          </span>
        ),
      },
      {
        key: 'startedAt',
        label: 'Date',
        sortable: true,
        render: (row: any) => (
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>
            {row.dateFormatted}
          </span>
        ),
      },
      {
        key: 'shiftName',
        label: 'Shift',
        sortable: true,
        render: (row: any) => (
          <span style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>
            {row.shiftName}
          </span>
        ),
      },
      {
        key: 'siteName',
        label: 'Site / Route',
        sortable: true,
        render: (row: any) => (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
              {row.siteName}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {row.routeName}
            </span>
          </div>
        ),
      },
      {
        key: 'startTimeFormatted',
        label: 'Start Time',
        render: (row: any) => (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {row.startTimeFormatted}
          </span>
        ),
      },
      {
        key: 'endTimeFormatted',
        label: 'End Time',
        render: (row: any) => (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {row.endTimeFormatted}
          </span>
        ),
      },
      {
        key: 'durationSeconds',
        label: 'Duration',
        sortable: true,
        render: (row: any) => (
          <span style={{ fontWeight: 600, color: '#1e40af', fontSize: '0.85rem' }}>
            {row.durationFormatted || '0 sec'}
          </span>
        ),
      },
      {
        key: 'checkpoints',
        label: 'Checkpoints',
        render: (row: any) => (
          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
            {row.scannedCheckpoints} / {row.totalCheckpoints}
          </span>
        ),
      },
      {
        key: 'compliancePct',
        label: 'Compliance',
        render: (row: any) => {
          const comp = row.compliancePct ?? 0;
          const bg = comp >= 90 ? 'rgba(22, 163, 74, 0.1)' : comp >= 70 ? 'rgba(217, 119, 6, 0.1)' : 'rgba(220, 38, 38, 0.1)';
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
      },
      {
        key: 'status',
        label: 'Status',
        render: (row: any) => <StatusChip status={row.status || 'COMPLETED'} />,
      },
      {
        key: 'actions',
        label: 'Action',
        render: (row: any) => (
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => handleViewReport(row.id)}
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: '0.8rem', gap: '4px', cursor: 'pointer' }}
              title="View detailed inspection report"
            >
              <Eye size={14} />
              <span>Report</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownloadPdf(row.id, row.patrolCode)}
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: '0.8rem', gap: '4px', cursor: 'pointer' }}
              title="Download audit PDF report"
            >
              <Download size={14} />
              <span>PDF</span>
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px 32px' }}>
      {/* Top Navigation Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <button
          type="button"
          onClick={handleBackToPeriodicReport}
          className="btn btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: 600,
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Periodic Summary Report</span>
        </button>

        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Client Admin • Reports &amp; Analytics • Employee Patrol Drill-Down
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div
          className="glass-card"
          style={{
            padding: '60px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            borderRadius: '12px',
          }}
        >
          <RefreshCw size={28} className="animate-spin text-blue-600" />
          <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Loading employee completed patrols...
          </span>
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div
          className="glass-card"
          style={{
            padding: '24px',
            borderRadius: '12px',
            borderLeft: '4px solid #dc2626',
            backgroundColor: 'rgba(220, 38, 38, 0.05)',
          }}
        >
          <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', color: '#dc2626', fontWeight: 700 }}>
            Unable to Load Patrol Sessions
          </h3>
          <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>{error}</p>
          <button
            type="button"
            onClick={fetchPatrols}
            className="btn btn-secondary"
            style={{ fontSize: '13px', padding: '6px 14px', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Content View */}
      {!isLoading && !error && data && (
        <>
          {/* Employee & Scope Header Card */}
          <div
            className="glass-card"
            style={{
              padding: '20px 24px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2563eb',
                  }}
                >
                  <User size={24} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      {data.employee.fullName}
                    </h2>
                    {data.employee.employeeNumber && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(0, 0, 0, 0.06)',
                          color: 'var(--text-secondary)',
                          fontFamily: 'monospace',
                        }}
                      >
                        {data.employee.employeeNumber}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 10px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(37, 99, 235, 0.1)',
                        color: '#2563eb',
                        textTransform: 'uppercase',
                      }}
                    >
                      {data.employee.roleLabel}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Building2 size={14} style={{ color: '#2563eb' }} />
                      <strong>{data.project.companyName}</strong>
                    </span>
                    <span>•</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Calendar size={14} style={{ color: '#2563eb' }} />
                      <span>{data.period.periodLabel}</span>
                    </span>
                    <span>•</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <ShieldCheck size={14} style={{ color: '#16a34a' }} />
                      <span>Emirates ID: {data.employee.emiratesId || 'Not provided'}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={fetchPatrols}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '7px 12px', cursor: 'pointer' }}
                  title="Refresh patrol sessions"
                >
                  <RefreshCw size={14} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>
          </div>

          {/* Aggregate KPI Summary Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
            }}
          >
            <div
              className="glass-card"
              style={{
                padding: '16px 20px',
                borderRadius: '12px',
                borderLeft: '4px solid #2563eb',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Completed Patrols
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {data.summary.totalCompletedPatrols}
              </div>
              <div style={{ fontSize: '12px', color: '#2563eb', marginTop: '2px' }}>
                Matching reporting period
              </div>
            </div>

            <div
              className="glass-card"
              style={{
                padding: '16px 20px',
                borderRadius: '12px',
                borderLeft: '4px solid #059669',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Total Patrol Duration
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {data.summary.totalPatrolDurationFormatted || '0 sec'}
              </div>
              <div style={{ fontSize: '12px', color: '#059669', marginTop: '2px' }}>
                Cumulative session time
              </div>
            </div>

            <div
              className="glass-card"
              style={{
                padding: '16px 20px',
                borderRadius: '12px',
                borderLeft: '4px solid #7c3aed',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Checkpoints Scanned
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {data.summary.totalCheckpointsScanned} / {data.summary.totalCheckpointsRequired}
              </div>
              <div style={{ fontSize: '12px', color: '#7c3aed', marginTop: '2px' }}>
                Completed checkpoints
              </div>
            </div>

            <div
              className="glass-card"
              style={{
                padding: '16px 20px',
                borderRadius: '12px',
                borderLeft: '4px solid #d97706',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Average Compliance
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {data.summary.averageCompliancePct}%
              </div>
              <div style={{ fontSize: '12px', color: '#d97706', marginTop: '2px' }}>
                Checkpoint completion rate
              </div>
            </div>
          </div>

          {/* Completed Patrols Data Table */}
          <div
            className="glass-card"
            style={{
              padding: '20px',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Patrol Sessions ({data.pagination.totalCount})
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  All completed inspection patrol sessions recorded for {data.employee.fullName} during {data.period.periodLabel}.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Show:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                    setPageSize(val);
                    setPage(1);
                  }}
                  className="form-input"
                  style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '6px' }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value="all">All</option>
                </select>
              </div>
            </div>

            <DataTable
              columns={columns}
              data={data.patrols}
              isLoading={isLoading}
              onSort={handleSort}
              sortBy={sortBy}
              sortOrder={sortOrder}
              emptyMessage={`No completed patrol sessions found for ${data.employee.fullName} in this period.`}
            />

            <Pagination
              currentPage={page}
              totalPages={data.pagination.totalPages || 1}
              onPageChange={(p) => setPage(p)}
              pageSize={pageSize}
              pageSizeOptions={[10, 20, 50, 'all']}
              onPageSizeChange={(sz) => {
                setPageSize(sz);
                setPage(1);
              }}
              totalRecords={data.pagination.totalCount}
            />
          </div>
        </>
      )}

      {/* Detailed Inspection Report Modal */}
      {selectedReport && (
        <DetailedReportModal
          isOpen={!!selectedReport}
          onClose={() => setSelectedReport(null)}
          report={selectedReport}
        />
      )}
    </div>
  );
}

export default function ClientAdminEmployeeCompletedPatrolsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading employee patrol details...
        </div>
      }
    >
      <ClientAdminEmployeeCompletedPatrolsContent />
    </Suspense>
  );
}
