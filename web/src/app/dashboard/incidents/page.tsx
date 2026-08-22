'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  Clock,
  Eye,
  MapPin,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { resolveImageUrl } from '../../../lib/image';
import LoadingState from '../../components/ui/LoadingState';
import Pagination from '../../components/ui/Pagination';
import SearchBar from '../../components/ui/SearchBar';
import { apiClient } from '../../lib/axios';
import { ApiResponse } from '../../types/api';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
}

interface Gate {
  id: string;
  name: string;
  gateCode: string;
  site?: {
    id: string;
    name: string;
    siteCode?: string;
  };
}

interface PatrolSession {
  id: string;
  patrolCode: string;
  assignment?: {
    site?: {
      id: string;
      name: string;
      siteCode?: string;
    };
  };
}

interface Incident {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status?: string;
  description: string;
  images: string[];
  createdAt: string;
  employee: Employee;
  gate?: Gate | null;
  patrolSession?: PatrolSession | null;
}

export default function IncidentsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1;
  const search = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || 'ALL';

  const updateUrlParams = (
    newPage: number,
    newSearch: string,
    newStatus: string,
  ) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    if (newPage > 1) {
      current.set('page', String(newPage));
    } else {
      current.delete('page');
    }
    if (newSearch.trim()) {
      current.set('search', newSearch.trim());
    } else {
      current.delete('search');
    }
    if (newStatus !== 'ALL') {
      current.set('status', newStatus);
    } else {
      current.delete('status');
    }
    const query = current.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const handlePageChange = (p: number) => {
    updateUrlParams(p, search, statusFilter);
  };

  const handleSearchChange = (s: string) => {
    updateUrlParams(1, s, statusFilter);
  };

  const handleStatusFilterChange = (st: string) => {
    updateUrlParams(1, search, st);
  };

  // Fetch Incident logs from API
  const { data: incidentsRes, isLoading } = useQuery<ApiResponse<Incident[]>>({
    queryKey: ['incidents-list'],
    queryFn: () => apiClient.get('/incidents'),
  });

  const allIncidents = incidentsRes?.data || [];

  // Filter based on search query & status filter
  let incidents = allIncidents;
  if (statusFilter !== 'ALL') {
    incidents = incidents.filter(
      (inc) => (inc.status || 'OPEN').toUpperCase() === statusFilter,
    );
  }
  if (search) {
    const s = search.toLowerCase();
    incidents = incidents.filter(
      (inc) =>
        inc.type.toLowerCase().includes(s) ||
        inc.severity.toLowerCase().includes(s) ||
        (inc.status || 'OPEN').toLowerCase().includes(s) ||
        inc.description.toLowerCase().includes(s) ||
        `${inc.employee.firstName} ${inc.employee.lastName}`
          .toLowerCase()
          .includes(s),
    );
  }

  const limit = 6;
  const totalPages = Math.max(1, Math.ceil(incidents.length / limit));
  const safePage = Math.min(page, totalPages);
  const paginatedIncidents = incidents.slice(
    (safePage - 1) * limit,
    safePage * limit,
  );

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' };
      case 'HIGH':
        return { bg: '#ffedd5', text: '#c2410c', border: '#fed7aa' };
      case 'MEDIUM':
        return { bg: '#fef9c3', text: '#854d0e', border: '#fef08a' };
      default:
        return { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' };
    }
  };

  const getStatusColor = (st?: string) => {
    switch (st?.toUpperCase()) {
      case 'REVIEWED':
        return { bg: '#fef9c3', text: '#854d0e', border: '#fef08a' };
      case 'RESOLVED':
        return { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' };
      case 'CLOSED':
        return { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' };
      case 'OPEN':
      default:
        return { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' };
    }
  };

  if (isLoading) {
    return (
      <LoadingState message="Loading observation reports..." variant="page" />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Title Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
            Observation Reports
          </h2>
          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              margin: '4px 0 0 0',
            }}
          >
            Browse and review safety, security, and checkpoint observations
            logged by officers.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="glass-card"
        style={{
          padding: '16px',
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: '240px' }}>
          <SearchBar
            value={search}
            onChange={handleSearchChange}
            placeholder="Search by type, status, description or officer..."
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
            }}
          >
            Status:
          </span>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className="input"
            style={{
              padding: '6px 12px',
              fontSize: '0.85rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-color)',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="REVIEWED">Reviewed</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* Incidents Grid */}
      {paginatedIncidents.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '20px',
          }}
        >
          {paginatedIncidents.map((incident) => {
            const sevColors = getSeverityColor(incident.severity);
            const stColors = getStatusColor(incident.status);

            return (
              <div
                key={incident.id}
                className="glass-card hover-effect"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '20px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                }}
              >
                {/* Header: Type, Status and Severity */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <AlertTriangle
                      size={18}
                      style={{ color: sevColors.text }}
                    />
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      {incident.type}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '4px 8px',
                        borderRadius: '6px',
                        backgroundColor: stColors.bg,
                        color: stColors.text,
                        border: `1px solid ${stColors.border}`,
                      }}
                    >
                      {incident.status || 'OPEN'}
                    </span>
                    {/* <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '4px 8px',
                        borderRadius: '6px',
                        backgroundColor: sevColors.bg,
                        color: sevColors.text,
                        border: `1px solid ${sevColors.border}`,
                      }}
                    >
                      {incident.severity}
                    </span> */}
                  </div>
                </div>

                {/* Site & Checkpoint Context */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    marginBottom: '12px',
                    padding: '8px 10px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}
                  >
                    <MapPin size={14} style={{ color: 'var(--primary)' }} />
                    <span>
                      Site:{' '}
                      {incident.gate?.site?.name ||
                        incident.patrolSession?.assignment?.site?.name ||
                        'Unassigned Site'}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <Building2
                      size={13}
                      style={{ color: 'var(--text-muted)' }}
                    />
                    <span>
                      Checkpoint:{' '}
                      {incident.gate
                        ? `${incident.gate.name} (${incident.gate.gateCode})`
                        : 'Direct Incident'}
                    </span>
                  </div>
                </div>

                {/* Description Body */}
                <p
                  style={{
                    fontSize: '0.85rem',
                    lineHeight: '1.5',
                    margin: '0 0 16px 0',
                    flex: 1,
                    color: 'var(--text-color)',
                  }}
                >
                  {incident.description.length > 120
                    ? `${incident.description.substring(0, 120)}...`
                    : incident.description}
                </p>

                {/* Image Previews */}
                {incident.images && incident.images.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      marginBottom: '16px',
                    }}
                  >
                    {incident.images.slice(0, 3).map((img, idx) => (
                      <div
                        key={idx}
                        style={{
                          position: 'relative',
                          width: '60px',
                          height: '60px',
                          borderRadius: '6px',
                          overflow: 'hidden',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        <img
                          src={resolveImageUrl(img)}
                          alt="Incident"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                        {idx === 2 && incident.images.length > 3 && (
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              backgroundColor: 'rgba(0,0,0,0.5)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#ffffff',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                            }}
                          >
                            +{incident.images.length - 3}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer details */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: '12px',
                    marginTop: 'auto',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Shield size={12} />
                      Officer: {incident.employee.firstName}{' '}
                      {incident.employee.lastName}
                    </span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Clock size={12} />
                      {new Date(incident.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <Link
                    href={`/dashboard/incidents/${incident.id}`}
                    className="btn btn-outline"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.8rem',
                      padding: '6px 12px',
                    }}
                  >
                    <Eye size={14} />
                    <span>Details</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="glass-card"
          style={{ padding: '60px', textAlign: 'center' }}
        >
          <AlertTriangle
            size={48}
            style={{
              color: 'var(--text-muted)',
              marginBottom: '16px',
              display: 'inline-block',
            }}
          />
          <h3
            style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 700 }}
          >
            No Incidents Logged
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
            }}
          >
            There are no safety or security incidents matching your filters.
          </p>
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: '12px',
          }}
        >
          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
}
