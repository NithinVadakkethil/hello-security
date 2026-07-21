'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Clock, Eye } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { apiClient } from '../../lib/axios';
import { ApiResponse } from '../../types/api';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import SearchBar from '../../components/ui/SearchBar';
import StatusChip from '../../components/ui/StatusChip';

interface Checkpoint {
  id: string;
  scannedAt: string;
}

interface PatrolSession {
  id: string;
  patrolCode: string;
  status: 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  startedAt: string;
  endedAt?: string | null;
  totalDuration?: number | null;
  remarks?: string | null;
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
  const defaultTab = searchParams.get('tab') === 'history' ? 'history' : 'live';

  const [activeTab, setActiveTab] = useState<'live' | 'history'>(defaultTab);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  // Query Patrol Sessions
  const { data: sessionsRes, isLoading } = useQuery<ApiResponse<PatrolSession[]>>({
    queryKey: ['patrol-sessions'],
    queryFn: () => apiClient.get('/patrol-sessions'),
  });

  const allSessions = sessionsRes?.data || [];

  // Filter based on activeTab
  const filteredByTab = allSessions.filter((s) => {
    if (activeTab === 'live') {
      return s.status === 'IN_PROGRESS' || s.status === 'PAUSED';
    } else {
      return s.status === 'COMPLETED' || s.status === 'CANCELLED';
    }
  });

  // Filter based on search query
  let sessions = filteredByTab;
  if (search) {
    const s = search.toLowerCase();
    sessions = filteredByTab.filter(
      (session) =>
        session.patrolCode.toLowerCase().includes(s) ||
        session.assignment.employee.firstName.toLowerCase().includes(s) ||
        session.assignment.employee.lastName.toLowerCase().includes(s) ||
        session.assignment.site.name.toLowerCase().includes(s)
    );
  }

  const limit = 10;
  const totalPages = Math.max(1, Math.ceil(sessions.length / limit));
  const paginatedSessions = sessions.slice((page - 1) * limit, page * limit);

  const columns = [
    { key: 'patrolCode', label: 'Patrol Code', sortable: true },
    {
      key: 'guard',
      label: 'Security Officer',
      render: (row: PatrolSession) => (
        <span>
          {row.assignment.employee.firstName} {row.assignment.employee.lastName}
        </span>
      ),
    },
    { key: 'site', label: 'Monitored Site', render: (row: PatrolSession) => row.assignment?.site?.name || 'N/A' },
    {
      key: 'route',
      label: 'Route / Target',
      render: (row: PatrolSession) => row.assignment?.patrolRoute?.name || '🚧 Direct Checkpoints',
    },
    {
      key: 'progress',
      label: 'Checkpoints Scanned',
      render: (row: PatrolSession) => {
        const totalGates =
          row.assignment?.patrolRoute?.routeGates?.length ||
          row.assignment?.assignmentGates?.length ||
          0;
        const scannedCount = row.checkpoints?.length || 0;
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
      key: 'actions',
      label: 'Details',
      render: (row: PatrolSession) => (
        <Link
          href={`/dashboard/patrol-sessions/${row.id}`}
          className="btn btn-secondary"
          style={{ padding: '6px 10px', fontSize: '0.8rem', gap: '4px', textDecoration: 'none' }}
        >
          <Eye size={14} />
          <span>Inspect Log</span>
        </Link>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '16px' }}>
        <button
          onClick={() => {
            setActiveTab('live');
            setPage(1);
          }}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'live' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'live' ? 'var(--text-primary)' : 'var(--text-muted)',
            padding: '12px 8px',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Activity size={18} className={activeTab === 'live' ? 'text-primary' : ''} />
          <span>Live Guard Monitoring</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('history');
            setPage(1);
          }}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'history' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'history' ? 'var(--text-primary)' : 'var(--text-muted)',
            padding: '12px 8px',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Clock size={18} className={activeTab === 'history' ? 'text-primary' : ''} />
          <span>Completed Patrol History</span>
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
          onChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          placeholder="Search logs by code, guard name or site..."
        />
      </div>

      <DataTable
        columns={columns}
        data={paginatedSessions}
        isLoading={isLoading}
        emptyMessage={
          activeTab === 'live'
            ? 'No guards are currently performing patrols.'
            : 'No historical patrol records found.'
        }
      />

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={(p) => setPage(p)}
      />
    </div>
  );
}
