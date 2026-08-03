'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Wrench,
  FileSpreadsheet,
  Filter,
  RefreshCw,
  Search,
  Eye,
} from 'lucide-react';
import Link from 'next/link';
import DataTable from '../../../components/ui/DataTable';
import Pagination from '../../../components/ui/Pagination';
import { apiClient } from '../../../lib/axios';
import { ApiResponse } from '../../../types/api';

interface SnagItem {
  id: string;
  category: string;
  subCategory?: string | null;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED' | 'REJECTED';
  images: string[];
  createdAt: string;
  site?: { id: string; name: string };
  gate?: { id: string; name: string; gateCode: string };
  employee?: { id: string; firstName: string; lastName: string; employeeNumber: string };
  assignments?: Array<{
    assignedTo?: { email: string; employee?: { firstName: string; lastName: string } };
  }>;
}

interface SnagStats {
  total: number;
  open: number;
  inProgress: number;
  waiting: number;
  resolved: number;
  closed: number;
  highPriority: number;
}

export default function SnagsListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 1. Fetch Stats
  const { data: statsRes } = useQuery<ApiResponse<SnagStats>>({
    queryKey: ['snag-stats'],
    queryFn: () => apiClient.get('/snags/stats'),
  });
  const stats = statsRes?.data || {
    total: 0,
    open: 0,
    inProgress: 0,
    waiting: 0,
    resolved: 0,
    closed: 0,
    highPriority: 0,
  };

  // 2. Fetch Sites for dropdown
  const { data: sitesRes } = useQuery<ApiResponse<any>>({
    queryKey: ['sites-list'],
    queryFn: () => apiClient.get('/sites'),
  });
  const rawSites = sitesRes?.data;
  const sites: any[] = Array.isArray(rawSites) ? rawSites : Array.isArray(rawSites?.items) ? rawSites.items : [];

  // 3. Fetch Snags List
  const { data: snagsRes, isLoading, refetch } = useQuery<ApiResponse<any>>({
    queryKey: ['snags-list', page, search, statusFilter, priorityFilter, siteFilter, startDate, endDate],
    queryFn: () =>
      apiClient.get('/snags', {
        params: {
          page,
          limit: 10,
          search: search || undefined,
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
          siteId: siteFilter || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
      }),
  });

  const rawSnags = snagsRes?.data;
  const snags: SnagItem[] = Array.isArray(rawSnags) ? rawSnags : Array.isArray(rawSnags?.items) ? rawSnags.items : [];
  const pagination = (snagsRes as any)?.pagination || { total: 0, totalPages: 1 };

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPriorityFilter('');
    setSiteFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleExportCSV = () => {
    if (snags.length === 0) return;
    const headers = ['Snag ID', 'Priority', 'Status', 'Category', 'Sub Category', 'Site', 'Checkpoint', 'Reported By', 'Created Date'];
    const rows = snags.map(s => [
      s.id,
      s.priority,
      s.status,
      `"${s.category}"`,
      `"${s.subCategory || ''}"`,
      `"${s.site?.name || ''}"`,
      `"${s.gate?.name || ''} (${s.gate?.gateCode || ''})"`,
      `"${s.employee?.firstName || ''} ${s.employee?.lastName || ''}"`,
      new Date(s.createdAt).toLocaleDateString(),
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `snags-maintenance-report-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'OPEN':
        return { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)', label: 'Open' };
      case 'IN_PROGRESS':
        return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)', label: 'In Progress' };
      case 'WAITING':
        return { bg: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', border: 'rgba(168, 85, 247, 0.3)', label: 'Waiting for Parts' };
      case 'RESOLVED':
        return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)', label: 'Resolved' };
      case 'CLOSED':
        return { bg: 'rgba(107, 114, 128, 0.15)', color: '#9ca3af', border: 'rgba(107, 114, 128, 0.3)', label: 'Closed' };
      case 'REJECTED':
        return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)', label: 'Rejected' };
      default:
        return { bg: 'var(--bg-secondary)', color: 'var(--text-muted)', border: 'var(--border-color)', label: status };
    }
  };

  const getPriorityBadgeStyle = (prio: string) => {
    switch (prio) {
      case 'HIGH':
        return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' };
      case 'MEDIUM':
        return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' };
      case 'LOW':
        return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
      default:
        return { bg: 'var(--bg-secondary)', color: 'var(--text-muted)', border: 'var(--border-color)' };
    }
  };

  const columns = [
    {
      key: 'snagId',
      label: 'Snag ID & Code',
      render: (s: SnagItem) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary)' }}>
            #{s.id.slice(-8).toUpperCase()}
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {new Date(s.createdAt).toLocaleDateString()} {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (s: SnagItem) => {
        const style = getPriorityBadgeStyle(s.priority);
        return (
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: style.bg,
              color: style.color,
              border: `1px solid ${style.border}`,
              letterSpacing: '0.5px',
            }}
          >
            {s.priority}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (s: SnagItem) => {
        const style = getStatusBadgeStyle(s.status);
        return (
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '8px',
              backgroundColor: style.bg,
              color: style.color,
              border: `1px solid ${style.border}`,
            }}
          >
            {style.label}
          </span>
        );
      },
    },
    {
      key: 'category',
      label: 'Category & Defect',
      render: (s: SnagItem) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {s.category}
          </span>
          {s.subCategory && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {s.subCategory}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'location',
      label: 'Location & Checkpoint',
      render: (s: SnagItem) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {s.site?.name || 'N/A'}
          </span>
          {s.gate && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Gate: {s.gate.name} ({s.gate.gateCode})
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'reportedBy',
      label: 'Reported By',
      render: (s: SnagItem) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {s.employee ? `${s.employee.firstName} ${s.employee.lastName || ''}` : 'Security Officer'}
          </span>
          {s.employee?.employeeNumber && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              EMP: {s.employee.employeeNumber}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'assigned',
      label: 'Assigned Staff',
      render: (s: SnagItem) => {
        const assigned = s.assignments && s.assignments.length > 0 ? s.assignments[0]?.assignedTo : null;
        if (!assigned) {
          return <span style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>Unassigned</span>;
        }
        return (
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)' }}>
            {assigned.employee ? `${assigned.employee.firstName} ${assigned.employee.lastName}` : assigned.email}
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (s: SnagItem) => (
        <Link
          href={`/dashboard/maintenance/snags/${s.id}`}
          className="btn btn-secondary"
          style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Eye size={14} />
          <span>View Ticket</span>
        </Link>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}
            >
              <Wrench size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Maintenance Snag Management
              </h2>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Track defect tickets, assign maintenance personnel, and resolve site inspection snags
              </p>
            </div>
          </div>
        </div>

        {/* Actions Button */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={handleExportCSV}
            className="btn btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.82rem', gap: '6px' }}
          >
            <FileSpreadsheet size={16} />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => refetch()}
            className="btn btn-primary"
            style={{ padding: '8px 14px', fontSize: '0.82rem', gap: '6px' }}
          >
            <RefreshCw size={16} />
            <span>Refresh Feed</span>
          </button>
        </div>
      </div>

      {/* Top Dashboard Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '14px',
        }}
      >
        {/* Total */}
        <div
          style={{
            padding: '16px',
            borderRadius: '12px',
            backgroundColor: 'var(--surface-color)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Total Snags
          </span>
          <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {stats.total}
          </span>
        </div>

        {/* Open */}
        <div
          style={{
            padding: '16px',
            borderRadius: '12px',
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase' }}>
            Open
          </span>
          <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#3b82f6' }}>
            {stats.open}
          </span>
        </div>

        {/* In Progress */}
        <div
          style={{
            padding: '16px',
            borderRadius: '12px',
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase' }}>
            In Progress
          </span>
          <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f59e0b' }}>
            {stats.inProgress}
          </span>
        </div>

        {/* Waiting */}
        <div
          style={{
            padding: '16px',
            borderRadius: '12px',
            backgroundColor: 'rgba(168, 85, 247, 0.08)',
            border: '1px solid rgba(168, 85, 247, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a855f7', textTransform: 'uppercase' }}>
            Waiting Parts
          </span>
          <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#a855f7' }}>
            {stats.waiting}
          </span>
        </div>

        {/* Resolved */}
        <div
          style={{
            padding: '16px',
            borderRadius: '12px',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>
            Resolved
          </span>
          <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981' }}>
            {stats.resolved}
          </span>
        </div>

        {/* Closed */}
        <div
          style={{
            padding: '16px',
            borderRadius: '12px',
            backgroundColor: 'var(--surface-color)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Closed
          </span>
          <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
            {stats.closed}
          </span>
        </div>

        {/* High Priority */}
        <div
          style={{
            padding: '16px',
            borderRadius: '12px',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase' }}>
            High Priority
          </span>
          <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ef4444' }}>
            {stats.highPriority}
          </span>
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <div
        style={{
          padding: '18px 20px',
          borderRadius: '12px',
          backgroundColor: 'var(--surface-color)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Ticket Search & Filter Controls
            </span>
          </div>
          <button
            type="button"
            onClick={handleClearFilters}
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
          >
            Clear Filters
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          {/* Search Input */}
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '0 10px' }}>
            <Search size={16} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
            <input
              type="text"
              placeholder="Search description, category, site..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
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

          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="form-input"
            style={{ fontSize: '0.82rem', padding: '8px' }}
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="WAITING">Waiting for Parts</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
            <option value="REJECTED">Rejected</option>
          </select>

          {/* Priority Dropdown */}
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            className="form-input"
            style={{ fontSize: '0.82rem', padding: '8px' }}
          >
            <option value="">All Priorities</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="LOW">Low Priority</option>
          </select>

          {/* Site Dropdown */}
          <select
            value={siteFilter}
            onChange={(e) => {
              setSiteFilter(e.target.value);
              setPage(1);
            }}
            className="form-input"
            style={{ fontSize: '0.82rem', padding: '8px' }}
          >
            <option value="">All Sites</option>
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Start Date */}
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            className="form-input"
            style={{ fontSize: '0.82rem', padding: '8px' }}
          />

          {/* End Date */}
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            className="form-input"
            style={{ fontSize: '0.82rem', padding: '8px' }}
          />
        </div>
      </div>

      {/* Main Data Table */}
      <DataTable
        columns={columns}
        data={snags}
        isLoading={isLoading}
        emptyMessage="No maintenance snag tickets found matching the selected filters."
      />

      {/* Pagination Footer */}
      {pagination.totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={pagination.totalPages}
          onPageChange={(p) => setPage(p)}
        />
      )}
    </div>
  );
}
