'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Eye,
  Shield,
  Wrench,
  Sparkles,
  UserCheck,
  Briefcase,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import { apiClient } from '../../lib/axios';
import { ApiResponse } from '../../types/api';
import { formatPatrolDateTime } from '@/lib/date-formatter';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  role?: string;
  designation?: string;
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
  const roleFilter = searchParams.get('role') || 'ALL';

  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const updateUrlParams = (
    newPage: number,
    newSearch: string,
    newStatus: string,
    newRole: string,
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
    if (newRole !== 'ALL') {
      current.set('role', newRole);
    } else {
      current.delete('role');
    }
    const query = current.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const handlePageChange = (p: number) => {
    updateUrlParams(p, searchInput, statusFilter, roleFilter);
  };

  const handleSearchChange = (s: string) => {
    setSearchInput(s);
    updateUrlParams(1, s, statusFilter, roleFilter);
  };

  const handleStatusFilterChange = (st: string) => {
    updateUrlParams(1, searchInput, st, roleFilter);
  };

  const handleRoleFilterChange = (rl: string) => {
    updateUrlParams(1, searchInput, statusFilter, rl);
  };

  const handleClearFilters = () => {
    setSearchInput('');
    router.replace(pathname, { scroll: false });
  };

  // Fetch Incident logs from API
  const { data: incidentsRes, isLoading } = useQuery<ApiResponse<Incident[]>>({
    queryKey: ['incidents-list'],
    queryFn: () => apiClient.get('/incidents'),
  });

  const allIncidents = incidentsRes?.data || [];

  // Filter based on search query, status, & role filter
  let incidents = allIncidents;
  if (statusFilter !== 'ALL') {
    incidents = incidents.filter(
      (inc) => (inc.status || 'OPEN').toUpperCase() === statusFilter,
    );
  }
  if (roleFilter !== 'ALL') {
    incidents = incidents.filter(
      (inc) => (inc.employee?.role || 'SECURITY').toUpperCase() === roleFilter,
    );
  }
  if (searchInput.trim()) {
    const s = searchInput.trim().toLowerCase();
    incidents = incidents.filter(
      (inc) =>
        inc.type.toLowerCase().includes(s) ||
        inc.severity.toLowerCase().includes(s) ||
        (inc.status || 'OPEN').toLowerCase().includes(s) ||
        inc.description.toLowerCase().includes(s) ||
        `${inc.employee?.firstName || ''} ${inc.employee?.lastName || ''}`
          .toLowerCase()
          .includes(s) ||
        (inc.employee?.employeeNumber || '').toLowerCase().includes(s) ||
        (inc.gate?.site?.name || '').toLowerCase().includes(s) ||
        (inc.patrolSession?.assignment?.site?.name || '').toLowerCase().includes(s) ||
        (inc.gate?.name || '').toLowerCase().includes(s) ||
        (inc.gate?.gateCode || '').toLowerCase().includes(s),
    );
  }

  const limit = 10;
  const totalPages = Math.max(1, Math.ceil(incidents.length / limit));
  const safePage = Math.min(page, totalPages);
  const paginatedIncidents = incidents.slice(
    (safePage - 1) * limit,
    safePage * limit,
  );

  const getStatusColor = (st?: string) => {
    switch (st?.toUpperCase()) {
      case 'REVIEWED':
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' };
      case 'RESOLVED':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
      case 'CLOSED':
        return { bg: 'rgba(107, 114, 128, 0.15)', text: '#9ca3af', border: 'rgba(107, 114, 128, 0.3)' };
      case 'OPEN':
      default:
        return { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' };
    }
  };

  const getRoleBadgeStyle = (role?: string) => {
    const normalized = (role || 'SECURITY').toUpperCase();
    switch (normalized) {
      case 'TECHNICIAN':
        return {
          label: 'Technician',
          icon: <Wrench size={13} />,
          bg: 'rgba(245, 158, 11, 0.12)',
          color: '#f59e0b',
          border: 'rgba(245, 158, 11, 0.3)',
        };
      case 'CLEANER':
      case 'HOUSE_KEEPING':
      case 'HOUSEKEEPING':
        return {
          label: 'House Keeping',
          icon: <Sparkles size={13} />,
          bg: 'rgba(168, 85, 247, 0.12)',
          color: '#a855f7',
          border: 'rgba(168, 85, 247, 0.3)',
        };
      case 'SUPERVISOR':
        return {
          label: 'Supervisor',
          icon: <UserCheck size={13} />,
          bg: 'rgba(16, 185, 129, 0.12)',
          color: '#10b981',
          border: 'rgba(16, 185, 129, 0.3)',
        };
      case 'MANAGER':
      case 'ADMIN':
      case 'SUPER_ADMIN':
        return {
          label: 'Manager',
          icon: <Briefcase size={13} />,
          bg: 'rgba(99, 102, 241, 0.12)',
          color: '#6366f1',
          border: 'rgba(99, 102, 241, 0.3)',
        };
      case 'SECURITY':
      case 'SECURITY_GUARD':
      default:
        return {
          label: 'Security Guard',
          icon: <Shield size={13} />,
          bg: 'rgba(59, 130, 246, 0.12)',
          color: '#3b82f6',
          border: 'rgba(59, 130, 246, 0.3)',
        };
    }
  };

  const columns = [
    {
      key: 'type',
      label: 'Observation',
      render: (inc: Incident) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {inc.type}
          </span>
          {inc.description && (
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: '1.4',
                maxWidth: '320px',
              }}
            >
              {inc.description}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'location',
      label: 'Site / Checkpoint',
      render: (inc: Incident) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {inc.gate?.site?.name || inc.patrolSession?.assignment?.site?.name || 'Unassigned Site'}
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {inc.gate ? inc.gate.name : 'Direct Observation'}
          </span>
          {inc.gate?.gateCode && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              {inc.gate.gateCode}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'officer',
      label: 'Officer',
      render: (inc: Incident) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {inc.employee ? `${inc.employee.firstName} ${inc.employee.lastName || ''}` : 'Security Officer'}
          </span>
          {inc.employee?.employeeNumber && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              EMP: {inc.employee.employeeNumber}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      render: (inc: Incident) => {
        const roleStyle = getRoleBadgeStyle(inc.employee?.role);
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: '6px',
              backgroundColor: roleStyle.bg,
              color: roleStyle.color,
              border: `1px solid ${roleStyle.border}`,
            }}
          >
            {roleStyle.icon}
            <span>{roleStyle.label}</span>
          </span>
        );
      },
    },
    {
      key: 'createdAt',
      label: 'Date & Time',
      render: (inc: Incident) => (
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          {formatPatrolDateTime(inc.createdAt, undefined, false)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (inc: Incident) => {
        const stColors = getStatusColor(inc.status);
        return (
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '8px',
              backgroundColor: stColors.bg,
              color: stColors.text,
              border: `1px solid ${stColors.border}`,
            }}
          >
            {inc.status || 'OPEN'}
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (inc: Incident) => (
        <Link
          href={`/dashboard/incidents/${inc.id}`}
          className="btn btn-secondary"
          style={{
            padding: '6px 12px',
            fontSize: '0.78rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Eye size={14} />
          <span>Details</span>
        </Link>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Title Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Observation Reports
          </h2>
          <p
            style={{
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
              margin: '4px 0 0 0',
            }}
          >
            Browse and review safety, security, and checkpoint observations logged by officers.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="glass-card"
        style={{
          padding: '18px 20px',
          display: 'flex',
          gap: '14px',
          alignItems: 'center',
          flexWrap: 'wrap',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
        }}
      >
        {/* Search Field with Immediate Input State */}
        <div
          style={{
            flex: 1,
            minWidth: '240px',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            padding: '0 12px',
          }}
        >
          <Search size={16} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by observation, description, site, checkpoint or officer..."
            aria-label="Search observation reports"
            style={{
              width: '100%',
              padding: '8px 0',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              outline: 'none',
            }}
          />
        </div>

        {/* Role Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            Role:
          </span>
          <select
            value={roleFilter}
            onChange={(e) => handleRoleFilterChange(e.target.value)}
            className="form-input"
            style={{
              padding: '8px 12px',
              fontSize: '0.82rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">All Roles</option>
            <option value="SECURITY">Security Guard</option>
            <option value="TECHNICIAN">Technician</option>
            <option value="CLEANER">House Keeping</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="MANAGER">Manager</option>
          </select>
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            Status:
          </span>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className="form-input"
            style={{
              padding: '8px 12px',
              fontSize: '0.82rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
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

        {(searchInput || statusFilter !== 'ALL' || roleFilter !== 'ALL') && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Main Data Table */}
      <DataTable
        columns={columns}
        data={paginatedIncidents}
        isLoading={isLoading}
        emptyMessage={
          searchInput || statusFilter !== 'ALL' || roleFilter !== 'ALL'
            ? 'No observation reports match the selected filters.'
            : 'No observation reports found.'
        }
      />

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
