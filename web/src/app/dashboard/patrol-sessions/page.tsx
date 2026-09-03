'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, Clock, Eye } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import SearchBar from '../../components/ui/SearchBar';
import StatusChip from '../../components/ui/StatusChip';
import { apiClient } from '../../lib/axios';

interface Checkpoint {
  id: string;
  gateId?: string;
  scannedAt: string;
}

interface PatrolSession {
  id: string;
  patrolCode: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  startedAt: string;
  endedAt?: string | null;
  totalDuration?: number | null;
  remarks?: string | null;
  verificationStatus?: 'PENDING' | 'VERIFIED' | 'NOT_VERIFIED' | null;
  verificationTime?: string | null;
  supervisorRemarks?: string | null;
  scannedCount?: number;
  totalCheckpointCount?: number;
  verifiedBy?: {
    id: string;
    email: string;
    employee?: {
      firstName: string;
      lastName: string;
    } | null;
  } | null;
  createdAt: string;
  assignment: {
    employee: {
      firstName: string;
      lastName: string;
      employeeNumber: string;
    };
    site: {
      name: string;
    };
    shift: {
      name: string;
    };
    patrolRoute?: {
      name: string;
      _count?: {
        routeGates: number;
      } | null;
      routeGates?: any[];
    } | null;
    assignmentGates?: any[];
  };
  checkpoints?: Checkpoint[];
}

export default function PatrolSessionsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeTab = searchParams.get('tab') === 'live' ? 'live' : 'history';
  const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1;
  const search = searchParams.get('search') || '';

  const updateUrlParams = (newTab: 'live' | 'history', newPage: number, newSearch: string) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));

    if (newTab === 'live') {
      current.set('tab', 'live');
    } else {
      current.delete('tab');
    }

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

    const query = current.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const handleTabChange = (t: 'live' | 'history') => {
    updateUrlParams(t, 1, search);
  };

  const handleSearchChange = (s: string) => {
    updateUrlParams(activeTab, 1, s);
  };

  const handlePageChange = (p: number) => {
    updateUrlParams(activeTab, p, search);
  };

  // Query Patrol Sessions with backend pagination & search
  const { data: responseRes, isLoading } = useQuery<{
    success: boolean;
    data: PatrolSession[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }>({
    queryKey: ['patrol-sessions', activeTab, page, search],
    queryFn: () =>
      apiClient.get('/patrol-sessions', {
        params: {
          tab: activeTab,
          page,
          limit: 10,
          search: search.trim() || undefined,
        },
      }),
    placeholderData: (previousData) => previousData,
  });

  const sessions = responseRes?.data || [];
  const pagination = responseRes?.pagination || {
    total: sessions.length,
    page,
    limit: 10,
    totalPages: 1,
  };

  const columns = [
    { key: 'patrolCode', label: 'Patrol Code', sortable: true },
    {
      key: 'guard',
      label: 'Security Officer',
      render: (row: PatrolSession) => (
        <span>
          {row.assignment?.employee?.firstName}{' '}
          {row.assignment?.employee?.lastName}
        </span>
      ),
    },
    {
      key: 'site',
      label: 'Monitored Site',
      render: (row: PatrolSession) => row.assignment?.site?.name || 'N/A',
    },
    {
      key: 'route',
      label: 'Route / Target',
      render: (row: PatrolSession) =>
        row.assignment?.patrolRoute?.name || '🚧 Checkpoints',
    },
    {
      key: 'progress',
      label: 'Checkpoints Scanned',
      render: (row: PatrolSession) => {
        const isDirectAssignment =
          (row.assignment as any)?.assignmentType === 'DIRECT_CHECKPOINTS' ||
          (!row.assignment?.patrolRoute &&
            (row.assignment?.assignmentGates?.length || 0) > 0);

        const totalGates =
          row.totalCheckpointCount ??
          (isDirectAssignment
            ? row.assignment?.assignmentGates?.length || 0
            : row.assignment?.patrolRoute?.routeGates?.length || 0);

        const uniqueScannedGates = new Set(
          (row.checkpoints || []).map((cp: any) => cp.gateId || cp.id).filter(Boolean),
        );
        const scannedCount =
          row.scannedCount ?? (row.checkpoints ? uniqueScannedGates.size : 0);

        return (
          <span style={{ fontWeight: 600 }}>
            {scannedCount} / {totalGates} Scanned
          </span>
        );
      },
    },
    {
      key: 'startedAt',
      label: 'Started Time',
      render: (row: PatrolSession) => new Date(row.startedAt).toLocaleString(),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: PatrolSession) => <StatusChip status={row.status} />,
    },
    {
      key: 'verification',
      label: 'Supervisor Verification',
      render: (row: PatrolSession) => {
        const vStatus = row.verificationStatus || 'PENDING';
        const verifier = row.verifiedBy?.employee
          ? `${row.verifiedBy.employee.firstName} ${row.verifiedBy.employee.lastName}`
          : row.verifiedBy?.email;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span
              className={`status-chip ${
                vStatus === 'VERIFIED'
                  ? 'status-active'
                  : vStatus === 'NOT_VERIFIED'
                    ? 'status-expired'
                    : 'status-trial'
              }`}
              style={{
                fontSize: '0.75rem',
                padding: '3px 8px',
                width: 'fit-content',
                fontWeight: 700,
              }}
            >
              {vStatus === 'VERIFIED'
                ? '✓ VERIFIED'
                : vStatus === 'NOT_VERIFIED'
                  ? '✕ NOT VERIFIED'
                  : '⏳ PENDING'}
            </span>
            {verifier && (
              <span
                style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}
              >
                By: {verifier}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      label: 'Details',
      render: (row: PatrolSession) => {
        const queryStr = searchParams.toString();
        const detailsHref = queryStr
          ? `/dashboard/patrol-sessions/${row.id}?${queryStr}`
          : `/dashboard/patrol-sessions/${row.id}`;

        return (
          <Link
            href={detailsHref}
            className="btn btn-secondary"
            style={{
              padding: '6px 10px',
              fontSize: '0.8rem',
              gap: '4px',
              textDecoration: 'none',
            }}
          >
            <Eye size={14} />
            <span>Logs</span>
          </Link>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          gap: '16px',
        }}
      >
        <button
          onClick={() => handleTabChange('history')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom:
              activeTab === 'history'
                ? '2px solid var(--primary)'
                : '2px solid transparent',
            color:
              activeTab === 'history'
                ? 'var(--text-primary)'
                : 'var(--text-muted)',
            padding: '12px 8px',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Clock
            size={18}
            className={activeTab === 'history' ? 'text-primary' : ''}
          />
          <span>Completed Patrol History</span>
        </button>

        <button
          onClick={() => handleTabChange('live')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom:
              activeTab === 'live'
                ? '2px solid var(--primary)'
                : '2px solid transparent',
            color:
              activeTab === 'live'
                ? 'var(--text-primary)'
                : 'var(--text-muted)',
            padding: '12px 8px',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Activity
            size={18}
            className={activeTab === 'live' ? 'text-primary' : ''}
          />
          <span>Live Guard Monitoring</span>
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <SearchBar
          value={search}
          onChange={handleSearchChange}
          placeholder="Search logs by code, guard name or site..."
        />
      </div>

      <DataTable
        columns={columns}
        data={sessions}
        isLoading={isLoading}
        emptyMessage={
          activeTab === 'live'
            ? 'No guards are currently performing patrols.'
            : 'No historical patrol records found.'
        }
      />

      <Pagination
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
