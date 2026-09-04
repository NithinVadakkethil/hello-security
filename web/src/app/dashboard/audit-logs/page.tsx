'use client';

import React, { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Eye, User, Clock } from 'lucide-react';

import { apiClient } from '../../lib/axios';
import { ApiResponse } from '../../types/api';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import SearchBar from '../../components/ui/SearchBar';
import Modal from '../../components/ui/Modal';
import { useAuthStore } from '../../store/auth-store';
import { formatPatrolDateTime } from '../../../lib/date-formatter';

interface AuditLog {
  id: string;
  action: 'LOGIN' | 'LOGOUT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'DOWNLOAD';
  entity: string;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
  };
  client?: {
    id: string;
    companyName: string;
  } | null;
}

export default function AuditLogsPage() {
  const { user: currentUser } = useAuthStore();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [entityFilter, setEntityFilter] = useState('');
  const [clientIdFilter, setClientIdFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected Log for details modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Fetch Logs
  const { data, isLoading } = useQuery<
    ApiResponse<{ items: AuditLog[]; pagination: { totalPages: number } }>
  >({
    queryKey: [
      'audit-logs',
      page,
      search,
      actionFilter,
      entityFilter,
      clientIdFilter,
      startDate,
      endDate,
    ],
    queryFn: () =>
      apiClient.get('/audit-logs', {
        params: {
          page,
          limit: 10,
          search: search || undefined,
          action: actionFilter !== 'ALL' ? actionFilter : undefined,
          entity: entityFilter || undefined,
          clientId: clientIdFilter !== 'ALL' ? clientIdFilter : undefined,
          startDate: startDate ? new Date(startDate).toISOString() : undefined,
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
        },
      }),
    placeholderData: keepPreviousData,
  });

  // Fetch Clients for dropdown
  const { data: clientsData } = useQuery<ApiResponse<{ items: { id: string; companyName: string }[] }>>({
    queryKey: ['clients-dropdown'],
    queryFn: () => apiClient.get('/clients', { params: { limit: 100 } }),
    enabled: currentUser?.role === 'SUPER_ADMIN',
  });

  const clientsList = clientsData?.data?.items || [];

  const getActionColor = (action: string) => {
    switch (action) {
      case 'LOGIN':
        return 'var(--success)';
      case 'LOGOUT':
        return 'var(--text-secondary)';
      case 'CREATE':
        return 'var(--primary)';
      case 'UPDATE':
        return 'var(--warning)';
      case 'DELETE':
        return 'var(--danger)';
      default:
        return 'var(--text-muted)';
    }
  };

  const columns = [
    {
      key: 'createdAt',
      label: 'Timestamp',
      render: (row: AuditLog) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={14} style={{ color: 'var(--text-muted)' }} />
          <span>{formatPatrolDateTime(row.createdAt, undefined, false)}</span>
        </div>
      ),
    },
    {
      key: 'user',
      label: 'User',
      render: (row: AuditLog) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <User size={14} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontWeight: 500 }}>{row.user?.email || 'System'}</span>
        </div>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      render: (row: AuditLog) => (
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '2px 8px',
            background: 'var(--bg-tertiary)',
            color: getActionColor(row.action),
            borderRadius: '4px',
            border: `1px solid ${getActionColor(row.action)}30`,
          }}
        >
          {row.action}
        </span>
      ),
    },
    {
      key: 'entity',
      label: 'Entity Target',
      render: (row: AuditLog) => (
        <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
          {row.entity} {row.entityId ? `(${row.entityId.substring(0, 8)}...)` : ''}
        </span>
      ),
    },
    {
      key: 'client',
      label: 'Client Workspace',
      render: (row: AuditLog) =>
        row.client?.companyName || <em style={{ color: 'var(--text-muted)' }}>Global / System</em>,
    },
    {
      key: 'actions',
      label: 'Details',
      render: (row: AuditLog) => (
        <button
          onClick={() => setSelectedLog(row)}
          className="btn btn-secondary"
          style={{ padding: '6px 10px', fontSize: '0.8rem', gap: '4px' }}
        >
          <Eye size={14} />
          <span>Inspect</span>
        </button>
      ),
    },
  ];

  return (
    <div>
      {/* Filters Box */}
      <div className="glass-card" style={{ padding: '20px', marginBottom: '24px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
          }}
        >
          <div>
            <label className="form-label">Search Context</label>
            <SearchBar
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="IP Address, User Agent..."
            />
          </div>

          <div>
            <label className="form-label">Action</label>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="form-input"
            >
              <option value="ALL">All Actions</option>
              <option value="LOGIN">LOGIN</option>
              <option value="LOGOUT">LOGOUT</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="DOWNLOAD">DOWNLOAD</option>
            </select>
          </div>

          <div>
            <label className="form-label">Entity Filter</label>
            <input
              type="text"
              value={entityFilter}
              onChange={(e) => {
                setEntityFilter(e.target.value);
                setPage(1);
              }}
              placeholder="e.g. Client, User"
              className="form-input"
            />
          </div>

          {currentUser?.role === 'SUPER_ADMIN' && (
            <div>
              <label className="form-label">Client Account</label>
              <select
                value={clientIdFilter}
                onChange={(e) => {
                  setClientIdFilter(e.target.value);
                  setPage(1);
                }}
                className="form-input"
              >
                <option value="ALL">All Workspaces</option>
                {clientsList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="form-label">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="form-input"
            />
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.data?.items}
        isLoading={isLoading}
        emptyMessage="No audit logs matching search filters found."
      />

      <Pagination
        currentPage={page}
        totalPages={data?.data?.pagination?.totalPages || 1}
        onPageChange={(p) => setPage(p)}
      />

      {/* INSPECT LOG MODAL */}
      <Modal
        isOpen={selectedLog !== null}
        onClose={() => setSelectedLog(null)}
        title="Audit Event Details"
      >
        {selectedLog && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>TIMESTAMP</p>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>
                  {formatPatrolDateTime(selectedLog.createdAt, undefined, false)}
                </p>
              </div>

              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>AUDIT ACTION</p>
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    background: 'var(--bg-tertiary)',
                    color: getActionColor(selectedLog.action),
                    borderRadius: '4px',
                  }}
                >
                  {selectedLog.action}
                </span>
              </div>

              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>PERFORMED BY</p>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>
                  {selectedLog.user?.email || 'System'}
                </p>
              </div>

              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>CLIENT SCOPE</p>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>
                  {selectedLog.client?.companyName || 'Global System'}
                </p>
              </div>

              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>ENTITY TARGET</p>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>
                  {selectedLog.entity}
                </p>
              </div>

              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>ENTITY ID</p>
                <p style={{ fontSize: '0.9rem', fontFamily: 'monospace', margin: 0 }}>
                  {selectedLog.entityId || 'N/A'}
                </p>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>IP ADDRESS</p>
              <p style={{ fontSize: '0.9rem', fontWeight: 500, margin: 0 }}>
                {selectedLog.ipAddress || 'Not Recorded'}
              </p>
            </div>

            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>USER AGENT</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, wordBreak: 'break-all' }}>
                {selectedLog.userAgent || 'Not Recorded'}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button onClick={() => setSelectedLog(null)} className="btn btn-primary">
                Close Detail
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
