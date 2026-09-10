'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Eye, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../../lib/axios';
import { CentralCompanyHeader } from '../components/CentralCompanyHeader';
import {
  CentralManagerOrganizationSelector,
  OrganizationMetric,
} from '../components/CentralManagerOrganizationSelector';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import SearchBar from '../../components/ui/SearchBar';
import StatusChip from '../../components/ui/StatusChip';
import ReadOnlyDetailModal, { FormattedDescriptionBlock, MediaGallerySection } from '../../components/ui/ReadOnlyDetailModal';
import { formatPatrolDateTime } from '@/lib/date-formatter';

export default function CentralSnagsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = searchParams?.get('clientId') || '';

  const [organizations, setOrganizations] = useState<OrganizationMetric[]>([]);
  const [isOrgsLoading, setIsOrgsLoading] = useState(true);
  const [orgsError, setOrgsError] = useState<string | null>(null);

  const [snags, setSnags] = useState<any[]>([]);
  const [isSnagsLoading, setIsSnagsLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams?.get('status') || 'ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>(searchParams?.get('category') || '');
  const [selectedSnag, setSelectedSnag] = useState<any | null>(null);

  useEffect(() => {
    const statusParam = searchParams?.get('status') || 'ALL';
    const categoryParam = searchParams?.get('category') || '';
    if (statusParam !== statusFilter) {
      setStatusFilter(statusParam);
    }
    if (categoryParam !== categoryFilter) {
      setCategoryFilter(categoryParam);
    }
  }, [searchParams]);

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(10);

  // 1. Fetch assigned organizations
  const fetchOrganizations = async () => {
    setIsOrgsLoading(true);
    setOrgsError(null);
    try {
      const res: any = await apiClient.get('/central-manager/organizations');
      const orgsList = res?.data || (Array.isArray(res) ? res : []);
      setOrganizations(orgsList);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Unable to load assigned organizations. Please try again.';
      setOrgsError(msg);
      toast.error(msg);
    } finally {
      setIsOrgsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  // 2. Fetch snags for selected organization
  const fetchSnags = async (targetClientId: string, status?: string, searchQuery?: string, categoryQuery?: string) => {
    setIsSnagsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('clientId', targetClientId);
      if (status && status !== 'ALL') params.set('status', status);
      if (searchQuery) params.set('search', searchQuery);
      if (categoryQuery) params.set('category', categoryQuery);

      const res: any = await apiClient.get(`/central-manager/snags?${params.toString()}`);
      const snagList = res?.data || (Array.isArray(res) ? res : []);
      setSnags(snagList);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to fetch snag list.');
    } finally {
      setIsSnagsLoading(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      fetchSnags(clientId, statusFilter, search, categoryFilter);
    }
  }, [clientId, statusFilter, search, categoryFilter]);

  const handleSelectOrganization = (id: string) => {
    setStatusFilter('ALL');
    setSearch('');
    setPage(1);
    router.push(`/central/snags?clientId=${id}`);
  };

  const handleBackToOrganizations = () => {
    setStatusFilter('ALL');
    setSearch('');
    setPage(1);
    router.push('/central/snags');
  };

  // Pagination calculation
  const limit = pageSize === 'all' ? snags.length : Number(pageSize);
  const totalPages = Math.max(1, Math.ceil(snags.length / (limit || 1)));
  const safePage = Math.min(page, totalPages);
  const paginatedSnags = pageSize === 'all' ? snags : snags.slice((safePage - 1) * limit, safePage * limit);

  // DataTable columns definition
  const columns = [
    {
      key: 'category',
      label: 'Snag Category',
      render: (row: any) => (
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
            {row.category?.name || row.title || 'Snag Item'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.description}
          </div>
        </div>
      ),
    },
    {
      key: 'checkpoint',
      label: 'Site / Checkpoint',
      render: (row: any) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.gate?.site?.name || row.site?.name || 'N/A'}</div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {row.gate?.name || 'General Site'} {row.gate?.gateCode ? `(${row.gate.gateCode})` : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'reporter',
      label: 'Reported By',
      render: (row: any) => {
        const reporterName = row.user
          ? `${row.user.firstName || ''} ${row.user.lastName || ''}`.trim() || row.user.name || row.user.email
          : 'Inspector';
        return (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{reporterName}</div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>
              {(row.user?.role || 'STAFF').replace('_', ' ')}
            </span>
          </div>
        );
      },
    },
    {
      key: 'createdAt',
      label: 'Date Logged',
      render: (row: any) => <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{formatPatrolDateTime(row.createdAt)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: any) => <StatusChip status={row.status || 'OPEN'} />,
    },
    {
      key: 'actions',
      label: 'Action',
      render: (row: any) => (
        <button
          onClick={() => setSelectedSnag(row)}
          className="btn btn-secondary"
          style={{ padding: '6px 12px', fontSize: '0.8rem', gap: '6px', cursor: 'pointer' }}
        >
          <Eye size={14} />
          <span>View</span>
        </button>
      ),
    },
  ];

  // If no company selected, render Organization Selector
  if (!clientId) {
    return (
      <CentralManagerOrganizationSelector
        moduleName="Snag List"
        organizations={organizations}
        isLoading={isOrgsLoading}
        error={orgsError}
        onRetry={fetchOrganizations}
        onSelectOrganization={handleSelectOrganization}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Snag List</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
          Read-only maintenance issues & snag tracking for selected organization.
        </p>
      </div>

      {/* Organization Context Bar */}
      <CentralCompanyHeader
        selectedClientId={clientId}
        organizations={organizations}
        moduleName="Snag List"
        onBackToOrganizations={handleBackToOrganizations}
        onSelectOrganization={handleSelectOrganization}
      />

      {/* Status Filter Tabs */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => {
            setStatusFilter('ALL');
            setPage(1);
          }}
          className={`btn ${statusFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.85rem', borderRadius: '20px', cursor: 'pointer' }}
        >
          All Snags
        </button>
        <button
          type="button"
          onClick={() => {
            setStatusFilter('OPEN');
            setPage(1);
          }}
          className={`btn ${statusFilter === 'OPEN' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.85rem', borderRadius: '20px', cursor: 'pointer' }}
        >
          Open
        </button>
        <button
          type="button"
          onClick={() => {
            setStatusFilter('IN_PROGRESS');
            setPage(1);
          }}
          className={`btn ${statusFilter === 'IN_PROGRESS' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.85rem', borderRadius: '20px', cursor: 'pointer' }}
        >
          In Progress
        </button>
        <button
          type="button"
          onClick={() => {
            setStatusFilter('RESOLVED');
            setPage(1);
          }}
          className={`btn ${statusFilter === 'RESOLVED' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.85rem', borderRadius: '20px', cursor: 'pointer' }}
        >
          Resolved
        </button>
        <button
          type="button"
          onClick={() => {
            setStatusFilter('CLOSED');
            setPage(1);
          }}
          className={`btn ${statusFilter === 'CLOSED' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.85rem', borderRadius: '20px', cursor: 'pointer' }}
        >
          Closed
        </button>
      </div>

      {/* Search Toolbar */}
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
          placeholder="Search snags by category or description..."
        />
      </div>

      {/* Snag Data Table */}
      <DataTable
        columns={columns}
        data={paginatedSnags}
        isLoading={isSnagsLoading}
        emptyMessage="No snag items found for this organization."
      />

      {/* Pagination */}
      <Pagination
        currentPage={safePage}
        totalPages={totalPages}
        onPageChange={(p) => setPage(p)}
        pageSize={pageSize}
        pageSizeOptions={[10, 25, 50, 'all']}
        onPageSizeChange={(sz) => {
          setPageSize(sz);
          setPage(1);
        }}
        totalRecords={snags.length}
      />

      {/* Read-Only Snag Detail Modal */}
      <ReadOnlyDetailModal
        isOpen={!!selectedSnag}
        onClose={() => setSelectedSnag(null)}
        title="Snag Item Details"
        subtitle="Read-only maintenance snag record."
        icon={<Wrench size={22} style={{ color: '#2563eb' }} />}
        maxWidth="800px"
      >
        {selectedSnag && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Top Summary Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                padding: '16px',
                borderRadius: '12px',
                backgroundColor: 'var(--surface-color, #f8fafc)',
                border: '1px solid var(--border-color, #e2e8f0)',
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  SNAG CATEGORY
                </span>
                <p style={{ margin: '4px 0 0 0', fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                  {selectedSnag.category?.name || selectedSnag.title || 'Snag Item'}
                </p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  STATUS
                </span>
                <div style={{ marginTop: '4px' }}>
                  <StatusChip status={selectedSnag.status || 'OPEN'} />
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  PRIORITY / SEVERITY
                </span>
                <p style={{ margin: '4px 0 0 0', fontWeight: 700, fontSize: '0.9rem', color: selectedSnag.priority === 'HIGH' ? '#ef4444' : 'var(--text-primary)' }}>
                  {selectedSnag.priority || selectedSnag.severity || 'NORMAL'}
                </p>
              </div>
            </div>

            {/* Description Section */}
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
                DESCRIPTION & REMARKS
              </span>
              <FormattedDescriptionBlock text={selectedSnag.description} />
            </div>

            {/* Location & Reported By Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                padding: '16px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-card, #ffffff)',
                border: '1px solid var(--border-color, #e2e8f0)',
              }}
            >
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                  ORGANIZATION / CLIENT
                </span>
                <p style={{ margin: '2px 0 0 0', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {selectedSnag.client?.companyName || 'Assigned Client'}
                </p>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                  SITE & CHECKPOINT
                </span>
                <p style={{ margin: '2px 0 0 0', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {selectedSnag.site?.name || selectedSnag.gate?.site?.name || 'General Site'}
                </p>
                {selectedSnag.gate?.name && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Gate: {selectedSnag.gate.name}
                  </span>
                )}
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                  REPORTED BY
                </span>
                <p style={{ margin: '2px 0 0 0', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {selectedSnag.employee
                    ? `${selectedSnag.employee.firstName || ''} ${selectedSnag.employee.lastName || ''}`.trim()
                    : selectedSnag.user
                    ? `${selectedSnag.user.firstName || ''} ${selectedSnag.user.lastName || ''}`.trim() || selectedSnag.user.name || selectedSnag.user.email
                    : 'Inspector'}
                </p>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                  TECHNICIAN ASSIGNED
                </span>
                <p style={{ margin: '2px 0 0 0', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {selectedSnag.technician
                    ? `${selectedSnag.technician.firstName || ''} ${selectedSnag.technician.lastName || ''}`.trim() || 'Assigned'
                    : selectedSnag.assignedTo
                    ? selectedSnag.assignedTo
                    : 'Unassigned'}
                </p>
              </div>
            </div>

            {/* Timestamps Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                padding: '14px 16px',
                borderRadius: '10px',
                backgroundColor: 'var(--surface-color, #f8fafc)',
                border: '1px solid var(--border-color, #e2e8f0)',
              }}
            >
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                  DATE LOGGED
                </span>
                <p style={{ margin: '2px 0 0 0', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                  {formatPatrolDateTime(selectedSnag.createdAt)}
                </p>
              </div>

              {selectedSnag.updatedAt && (
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                    LAST UPDATED
                  </span>
                  <p style={{ margin: '2px 0 0 0', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                    {formatPatrolDateTime(selectedSnag.updatedAt)}
                  </p>
                </div>
              )}
            </div>

            {/* Attached Media Section */}
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
                ATTACHED MEDIA ({selectedSnag.images?.length || 0})
              </span>
              <MediaGallerySection images={selectedSnag.images} />
            </div>
          </div>
        )}
      </ReadOnlyDetailModal>
    </div>
  );
}
