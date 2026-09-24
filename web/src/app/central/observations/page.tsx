'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AlertTriangle, Eye } from 'lucide-react';
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
import ReadOnlyDetailModal, { MediaGallerySection } from '../../components/ui/ReadOnlyDetailModal';
import { formatPatrolDateTime } from '@/lib/date-formatter';
import { formatEmployeeRole } from '@/lib/role-order';

export function parseObservationDetails(descriptionText?: string, remarksField?: string) {
  let subTaskCards: { key: string; value: string }[] = [];
  let extractedDescription: string = (remarksField || '').trim();

  if (descriptionText && descriptionText.trim()) {
    const text = descriptionText.trim();
    const isStructured =
      text.includes('Sub-Task Answer:') ||
      text.includes('Task Description:') ||
      text.includes('Officer Role:') ||
      text.includes('Remarks:') ||
      text.includes('Checkpoint:') ||
      text.includes('Patrol Session:');

    if (isStructured) {
      const keyRegex = /(Sub-Task Answer|Task Description|Officer Role|Remarks|Checkpoint|Patrol Session|Answer):/gi;
      const matches = Array.from(text.matchAll(keyRegex));

      if (matches.length > 0) {
        for (let i = 0; i < matches.length; i++) {
          const match = matches[i];
          const rawKey = match[1];
          const startIndex = (match.index || 0) + match[0].length;
          const endIndex = i + 1 < matches.length ? matches[i + 1].index : text.length;
          let value = text.slice(startIndex, endIndex).trim().replace(/[,;]$/, '');

          const keyUpper = rawKey.toUpperCase().trim();

          // 1. Completely remove TASK DESCRIPTION
          if (keyUpper === 'TASK DESCRIPTION') {
            continue;
          }

          // 2. Remove REMARKS from cards, but extract its value for the Description section if not already set
          if (keyUpper === 'REMARKS') {
            if (!extractedDescription && value && value.toUpperCase() !== 'N/A') {
              extractedDescription = value;
            }
            continue;
          }

          // Format Officer Role value if applicable
          if (keyUpper === 'OFFICER ROLE' && value) {
            value = formatEmployeeRole(value);
          }

          subTaskCards.push({ key: rawKey, value });
        }
      } else if (!extractedDescription) {
        extractedDescription = text;
      }
    } else if (!extractedDescription) {
      extractedDescription = text;
    }
  }

  return {
    subTaskCards,
    descriptionText: extractedDescription,
  };
}

export default function CentralObservationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = searchParams?.get('clientId') || '';

  const [organizations, setOrganizations] = useState<OrganizationMetric[]>([]);
  const [isOrgsLoading, setIsOrgsLoading] = useState(true);
  const [orgsError, setOrgsError] = useState<string | null>(null);

  const [observations, setObservations] = useState<any[]>([]);
  const [isObservationsLoading, setIsObservationsLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams?.get('status') || 'ALL');
  const [selectedObservation, setSelectedObservation] = useState<any | null>(null);

  useEffect(() => {
    const statusParam = searchParams?.get('status') || 'ALL';
    if (statusParam !== statusFilter) {
      setStatusFilter(statusParam);
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

  // 2. Fetch observations for selected organization
  const fetchObservations = async (targetClientId: string, status?: string, searchQuery?: string) => {
    setIsObservationsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('clientId', targetClientId);
      if (status && status !== 'ALL') params.set('status', status);
      if (searchQuery) params.set('search', searchQuery);

      const res: any = await apiClient.get(`/central-manager/observations?${params.toString()}`);
      const obsList = res?.data || (Array.isArray(res) ? res : []);
      setObservations(obsList);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to fetch observations.');
    } finally {
      setIsObservationsLoading(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      fetchObservations(clientId, statusFilter, search);
    }
  }, [clientId, statusFilter, search]);

  const handleSelectOrganization = (id: string) => {
    setStatusFilter('ALL');
    setSearch('');
    setPage(1);
    router.push(`/central/observations?clientId=${id}`);
  };

  const handleBackToOrganizations = () => {
    setStatusFilter('ALL');
    setSearch('');
    setPage(1);
    router.push('/central/observations');
  };

  // Pagination calculation
  const limit = pageSize === 'all' ? observations.length : Number(pageSize);
  const totalPages = Math.max(1, Math.ceil(observations.length / (limit || 1)));
  const safePage = Math.min(page, totalPages);
  const paginatedObservations = pageSize === 'all' ? observations : observations.slice((safePage - 1) * limit, safePage * limit);

  // DataTable columns definition
  const columns = [
    {
      key: 'type',
      label: 'Type / Title',
      render: (row: any) => (
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{row.type || 'Observation'}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.description}
          </div>
        </div>
      ),
    },
    {
      key: 'checkpoint',
      label: 'Checkpoint',
      render: (row: any) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.gate?.name || 'Checkpoint'}</div>
          <span style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
            {row.gate?.gateCode || ''}
          </span>
        </div>
      ),
    },
    {
      key: 'site',
      label: 'Site',
      render: (row: any) => <span style={{ color: 'var(--text-secondary)' }}>{row.gate?.site?.name || 'N/A'}</span>,
    },
    {
      key: 'reporter',
      label: 'Reported By',
      render: (row: any) => {
        const reporterName = row.employee
          ? `${row.employee.firstName || ''} ${row.employee.lastName || ''}`.trim()
          : row.user
          ? `${row.user.firstName || ''} ${row.user.lastName || ''}`.trim() || row.user.name || row.user.email
          : 'Inspector';
        const rawRole = row.employee?.role || row.user?.role || 'SECURITY';
        const displayRole = formatEmployeeRole(rawRole);
        return (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{reporterName || 'Inspector'}</div>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
              }}
            >
              {displayRole}
            </span>
          </div>
        );
      },
    },
    {
      key: 'createdAt',
      label: 'Date & Time',
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
          onClick={() => setSelectedObservation(row)}
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
        moduleName="Observation Reports"
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
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Observation Reports</h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
          Read-only operational observation logs for selected project.
        </p>
      </div>

      {/* Organization Context Bar */}
      <CentralCompanyHeader
        selectedClientId={clientId}
        organizations={organizations}
        moduleName="Observation Reports"
        onBackToOrganizations={handleBackToOrganizations}
        onSelectOrganization={handleSelectOrganization}
      />

      {/* Status Filter Tabs */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          type="button"
          onClick={() => {
            setStatusFilter('ALL');
            setPage(1);
          }}
          className={`btn ${statusFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.85rem', borderRadius: '20px', cursor: 'pointer' }}
        >
          All Observations
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
            setStatusFilter('REVIEWED');
            setPage(1);
          }}
          className={`btn ${statusFilter === 'REVIEWED' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.85rem', borderRadius: '20px', cursor: 'pointer' }}
        >
          Reviewed
        </button>
      </div>

      {/* Search Bar Toolbar */}
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
          placeholder="Search observations by type or description..."
        />
      </div>

      {/* Observation Data Table */}
      <DataTable
        columns={columns}
        data={paginatedObservations}
        isLoading={isObservationsLoading}
        emptyMessage="No observation reports found for this organization."
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
        totalRecords={observations.length}
      />

      {/* Read-Only Observation Detail Modal */}
      <ReadOnlyDetailModal
        isOpen={!!selectedObservation}
        onClose={() => setSelectedObservation(null)}
        title="Observation Log Details"
        subtitle="Read-only operational observation record."
        icon={<AlertTriangle size={22} style={{ color: '#d97706' }} />}
        maxWidth="780px"
      >
        {selectedObservation && (() => {
          const { subTaskCards, descriptionText } = parseObservationDetails(
            selectedObservation.description,
            selectedObservation.remarks,
          );
          const reporterName = selectedObservation.employee
            ? `${selectedObservation.employee.firstName || ''} ${selectedObservation.employee.lastName || ''}`.trim()
            : selectedObservation.user
            ? `${selectedObservation.user.firstName || ''} ${selectedObservation.user.lastName || ''}`.trim() || selectedObservation.user.name || selectedObservation.user.email
            : 'Inspector';
          const reporterRole = formatEmployeeRole(
            selectedObservation.employee?.role || selectedObservation.user?.role || 'SECURITY',
          );

          return (
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
                    TYPE / CATEGORY
                  </span>
                  <p style={{ margin: '4px 0 0 0', fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                    {selectedObservation.type || 'Observation'}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    STATUS
                  </span>
                  <div style={{ marginTop: '4px' }}>
                    <StatusChip status={selectedObservation.status || 'OPEN'} />
                  </div>
                </div>
              </div>

              {/* Description & Details Sub-Task Cards (if structured keys exist) */}
              {subTaskCards.length > 0 && (
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
                    DESCRIPTION & DETAILS
                  </span>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '12px',
                      backgroundColor: 'var(--surface-color, #f8fafc)',
                      border: '1px solid var(--border-color, #e2e8f0)',
                      borderRadius: '10px',
                      padding: '14px',
                    }}
                  >
                    {subTaskCards.map((card, idx) => (
                      <div
                        key={idx}
                        style={{
                          backgroundColor: 'var(--bg-card, #ffffff)',
                          border: '1px solid var(--border-color, #e2e8f0)',
                          borderRadius: '8px',
                          padding: '10px 12px',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: 'var(--text-secondary, #64748b)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {card.key}
                        </div>
                        <div
                          style={{
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: 'var(--text-primary, #0f172a)',
                            marginTop: '2px',
                            wordBreak: 'break-word',
                          }}
                        >
                          {card.value || '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                    CHECKPOINT
                  </span>
                  <p style={{ margin: '2px 0 0 0', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {selectedObservation.gate?.name || 'N/A'}
                  </p>
                  {selectedObservation.gate?.gateCode && (
                    <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      ({selectedObservation.gate.gateCode})
                    </span>
                  )}
                </div>

                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                    SITE
                  </span>
                  <p style={{ margin: '2px 0 0 0', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {selectedObservation.gate?.site?.name || selectedObservation.site?.name || 'N/A'}
                  </p>
                </div>

                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                    REPORTED BY
                  </span>
                  <p style={{ margin: '2px 0 0 0', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {reporterName || 'Inspector'}
                  </p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Role: {reporterRole}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                    DATE & TIME
                  </span>
                  <p style={{ margin: '2px 0 0 0', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {formatPatrolDateTime(selectedObservation.createdAt)}
                  </p>
                </div>
              </div>

              {/* Attached Media Section */}
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
                  ATTACHED MEDIA ({selectedObservation.images?.length || 0})
                </span>
                <MediaGallerySection images={selectedObservation.images} />
              </div>

              {/* Description Section below Attached Media */}
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
                  DESCRIPTION
                </span>
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--surface-color, #f8fafc)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: descriptionText ? 'var(--text-primary, #0f172a)' : 'var(--text-secondary, #64748b)',
                    fontStyle: descriptionText ? 'normal' : 'italic',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {descriptionText || 'No description provided.'}
                </div>
              </div>
            </div>
          );
        })()}
      </ReadOnlyDetailModal>
    </div>
  );
}
