'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Download, Eye, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../../lib/axios';
import CentralManagerOrganizationSelector, { OrganizationMetric } from '../components/CentralManagerOrganizationSelector';
import CentralCompanyHeader from '../components/CentralCompanyHeader';
import DetailedReportModal from '../../dashboard/reports/components/DetailedReportModal';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import SearchBar from '../../components/ui/SearchBar';
import StatusChip from '../../components/ui/StatusChip';
import { formatPatrolDateTime } from '@/lib/date-formatter';

export default function CentralReportsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const clientId = searchParams.get('clientId');

  // Multi-client selector states
  const [organizations, setOrganizations] = useState<OrganizationMetric[]>([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);
  const [orgsError, setOrgsError] = useState<string | null>(null);

  // Company-scoped data states
  const [reports, setReports] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Detail Modal
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [detailedReportData, setDetailedReportData] = useState<any>(null);

  // Fetch assigned organizations
  const fetchOrganizations = useCallback(async () => {
    setIsLoadingOrgs(true);
    setOrgsError(null);
    try {
      const res: any = await apiClient.get('/central-manager/organizations');
      const orgsList = res?.data || (Array.isArray(res) ? res : []);
      setOrganizations(orgsList);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error?.message || 'Unable to load assigned organizations. Please try again.';
      setOrgsError(msg);
      toast.error(msg);
    } finally {
      setIsLoadingOrgs(false);
    }
  }, []);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  // Fetch reports when clientId is present
  const fetchReports = useCallback(async () => {
    if (!clientId) return;

    setIsLoadingReports(true);
    try {
      const limitVal = pageSize === 'all' ? 100 : Number(pageSize);
      const params = new URLSearchParams({
        clientId,
        page: page.toString(),
        limit: limitVal.toString(),
      });

      if (search) params.append('search', search);
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);
      if (selectedSiteId) params.append('siteId', selectedSiteId);
      if (datePreset && datePreset !== 'custom') params.append('datePreset', datePreset);
      if (datePreset === 'custom') {
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
      }

      const res: any = await apiClient.get(`/central-manager/reports?${params.toString()}`);
      const rptList = res?.data || (Array.isArray(res) ? res : []);
      setReports(rptList);
      if (res?.meta || res?.pagination) {
        const meta = res.meta || res.pagination;
        setTotalPages(meta.totalPages || 1);
        setTotalCount(meta.totalCount || meta.total || rptList.length || 0);
      } else {
        setTotalCount(rptList.length);
        setTotalPages(1);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error?.message || 'Failed to fetch reports');
    } finally {
      setIsLoadingReports(false);
    }
  }, [clientId, page, pageSize, search, statusFilter, selectedSiteId, datePreset, startDate, endDate]);

  // Fetch sites for filtering
  useEffect(() => {
    if (!clientId) return;
    apiClient
      .get(`/sites?clientId=${clientId}&limit=100`)
      .then((res: any) => setSites(res?.data || (Array.isArray(res) ? res : [])))
      .catch(() => setSites([]));
  }, [clientId]);

  useEffect(() => {
    if (clientId) {
      fetchReports();
    }
  }, [clientId, fetchReports]);

  // Handle Organization Selection
  const handleSelectOrganization = (orgId: string) => {
    setPage(1);
    router.push(`/central/reports?clientId=${orgId}`);
  };

  // Open detailed report modal
  const handleViewReportDetails = async (reportId: string) => {
    try {
      const res: any = await apiClient.get(`/central-manager/reports/${reportId}?clientId=${clientId}`);
      const rptData = res?.data || res;
      setDetailedReportData(rptData);
      setSelectedReport(rptData);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error?.message || 'Failed to load report details');
    }
  };

  // PDF download
  const handleDownloadPdf = async (reportId: string, patrolCode: string) => {
    try {
      toast.loading('Generating PDF...', { id: 'pdf-toast' });
      const response = await apiClient.get(`/central-manager/reports/${reportId}/pdf?clientId=${clientId}`, {
        responseType: 'blob',
      });
      const blob = response?.data || response;
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Patrol_Report_${patrolCode || reportId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Report downloaded successfully', { id: 'pdf-toast' });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error?.message || 'Failed to download PDF', { id: 'pdf-toast' });
    }
  };

  // DataTable columns definition
  const columns = [
    {
      key: 'patrolCode',
      label: 'Patrol Code',
      render: (row: any) => (
        <span style={{ fontWeight: 700, color: '#2563eb', fontSize: '0.88rem', fontFamily: 'monospace' }}>
          {row.patrolCode || row.reportCode || `#${row.id.substring(0, 8)}`}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Date & Time',
      render: (row: any) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{formatPatrolDateTime(row.startedAt || row.createdAt)}</span>,
    },
    {
      key: 'officer',
      label: 'Employee / Inspector',
      render: (row: any) => {
        const officerName = row.user
          ? `${row.user.firstName || ''} ${row.user.lastName || ''}`.trim() || row.user.name || row.user.email
          : row.officerName || 'Inspector';
        return <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{officerName}</span>;
      },
    },
    {
      key: 'role',
      label: 'Role',
      render: (row: any) => {
        const userRole = row.user?.role || row.userRole || row.role || 'SECURITY_GUARD';
        return (
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '12px',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              color: '#2563eb',
              textTransform: 'uppercase',
            }}
          >
            {userRole.replace('_', ' ')}
          </span>
        );
      },
    },
    {
      key: 'site',
      label: 'Site',
      render: (row: any) => <span style={{ color: 'var(--text-secondary)' }}>{row.site?.name || row.assignment?.site?.name || 'N/A'}</span>,
    },
    {
      key: 'routeName',
      label: 'Route / Target',
      render: (row: any) => <span style={{ color: 'var(--text-secondary)' }}>{row.assignment?.patrolRoute?.name || row.routeName || 'Manager Inspection'}</span>,
    },
    {
      key: 'checkpoints',
      label: 'Checkpoints',
      render: (row: any) => {
        const scanned = row.checkpoints?.length || row.checkpointsCount || 0;
        const total = row.totalGates || row.assignment?.patrolRoute?.routeGates?.length || scanned || 1;
        return (
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
            {scanned} / {total}
          </span>
        );
      },
    },
    {
      key: 'compliance',
      label: 'Compliance',
      render: (row: any) => {
        const scanned = row.checkpoints?.length || row.checkpointsCount || 0;
        const total = row.totalGates || row.assignment?.patrolRoute?.routeGates?.length || scanned || 1;
        const compliancePct = total > 0 ? Math.round((scanned / total) * 100) : 100;
        return (
          <span
            style={{
              fontWeight: 800,
              fontSize: '0.85rem',
              color: compliancePct >= 80 ? '#16a34a' : compliancePct >= 50 ? '#d97706' : '#dc2626',
            }}
          >
            {compliancePct}%
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
            onClick={() => handleViewReportDetails(row.id)}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.8rem', gap: '4px', cursor: 'pointer' }}
            title="View detailed report"
          >
            <Eye size={14} />
            <span>Report</span>
          </button>
          <button
            onClick={() => handleDownloadPdf(row.id, row.patrolCode || row.reportCode)}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.8rem', color: '#2563eb', cursor: 'pointer' }}
            title="Download PDF"
          >
            <Download size={14} />
          </button>
        </div>
      ),
    },
  ];

  // STEP 1: ORGANIZATION SELECTION VIEW
  if (!clientId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Reports & Analytics</h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Select an assigned organization to view operational patrol reports, checkpoint compliance, and inspection audits.
          </p>
        </div>

        <CentralManagerOrganizationSelector
          organizations={organizations}
          isLoading={isLoadingOrgs}
          error={orgsError}
          onRetry={fetchOrganizations}
          onSelectOrganization={handleSelectOrganization}
          moduleName="Reports & Analytics"
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Reports & Analytics</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
          Read-only inspection reports & compliance metrics for selected organization.
        </p>
      </div>

      {/* Organization Context Bar */}
      <CentralCompanyHeader
        selectedClientId={clientId}
        organizations={organizations}
        moduleName="Reports & Analytics"
        onBackToOrganizations={() => router.push('/central/reports')}
        onSelectOrganization={handleSelectOrganization}
      />

      {/* Search & Advanced Filters Toolbar */}
      <div
        className="glass-card"
        style={{
          padding: '16px 20px',
          borderRadius: '12px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <SearchBar
          value={search}
          onChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          placeholder="Search patrol code or officer name..."
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          {/* Site Filter */}
          <select
            value={selectedSiteId}
            onChange={(e) => {
              setSelectedSiteId(e.target.value);
              setPage(1);
            }}
            className="form-input"
            style={{ maxWidth: '170px', fontSize: '0.85rem' }}
          >
            <option value="">All Sites</option>
            {sites.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="form-input"
            style={{ maxWidth: '150px', fontSize: '0.85rem' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="PENDING">Pending</option>
            <option value="EXPIRED">Expired</option>
          </select>

          {/* Date Preset Filter */}
          <select
            value={datePreset}
            onChange={(e) => {
              setDatePreset(e.target.value);
              setPage(1);
            }}
            className="form-input"
            style={{ maxWidth: '140px', fontSize: '0.85rem' }}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="custom">Custom Date</option>
          </select>

          {datePreset === 'custom' && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="form-input"
                style={{ fontSize: '0.8rem', padding: '6px 8px' }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="form-input"
                style={{ fontSize: '0.8rem', padding: '6px 8px' }}
              />
            </div>
          )}

          <button
            type="button"
            onClick={fetchReports}
            className="btn btn-secondary"
            style={{ padding: '8px 12px', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}
            title="Refresh reports dataset"
          >
            <RefreshCw size={14} className={isLoadingReports ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Reports Data Table */}
      <DataTable
        columns={columns}
        data={reports}
        isLoading={isLoadingReports}
        emptyMessage="No inspection reports found for this organization."
      />

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={(p) => setPage(p)}
        pageSize={pageSize}
        pageSizeOptions={[15, 25, 50, 'all']}
        onPageSizeChange={(sz) => {
          setPageSize(sz);
          setPage(1);
        }}
        totalRecords={totalCount}
      />

      {/* Detailed Report Modal */}
      {selectedReport && (
        <DetailedReportModal
          isOpen={!!selectedReport}
          onClose={() => setSelectedReport(null)}
          report={detailedReportData || selectedReport}
        />
      )}
    </div>
  );
}
