'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  Filter,
  RefreshCw,
  Search,
  Eye,
  MapPin,
  Shield,
  CheckCircle2,
  AlertCircle,
  Building2,
  FileText,
  FileSpreadsheet,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { apiClient } from '../../lib/axios';
import { getAccessToken } from '../../utils/token';
import { ApiResponse } from '../../types/api';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import StatusChip from '../../components/ui/StatusChip';
import SearchableSelect, { SearchableOption } from '../../components/ui/SearchableSelect';

const ROLE_LABELS: Record<string, string> = {
  SECURITY: 'Security Guard',
  SECURITY_GUARD: 'Security Guard',
  TECHNICIAN: 'Technician',
  CLEANER: 'House Keeping',
  SERVICE_ENGINEER: 'Service Engineer',
  SUPERVISOR: 'Supervisor',
  MANAGER: 'Community Manager',
  LIFE_GUARD: 'Lifeguard',
  PLUMBER: 'Plumber',
};

function formatRole(role?: string): string {
  if (!role) return 'Staff';
  return ROLE_LABELS[role.toUpperCase()] || role.replace(/_/g, ' ');
}

function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  employeeCode?: string;
  siteId?: string;
  siteName: string;
  shiftId?: string;
  shiftName: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  date: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  status: 'PRESENT' | 'LATE' | 'COMPLETED' | 'OFF' | string;
  workingDuration?: string | null;
  verificationMethod?: string;
  notes?: string;
  rawDetails?: any;
}

export default function AttendancePage() {
  const [selectedDatePreset, setSelectedDatePreset] = useState<string>('TODAY');
  const [date, setDate] = useState<string>(getTodayString());
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [employeeId, setEmployeeId] = useState<string>('');
  const [siteId, setSiteId] = useState<string>('');
  const [status, setStatus] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number | 'all'>(10);
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);

  // Fetch employees list for searchable employee filter
  const { data: employeesRes } = useQuery<ApiResponse<any[]>>({
    queryKey: ['attendance-filter-employees'],
    queryFn: () => apiClient.get('/employees'),
  });
  const employees = employeesRes?.data || [];

  // Fetch sites list for site filter
  const { data: sitesRes } = useQuery<ApiResponse<any[]>>({
    queryKey: ['attendance-filter-sites'],
    queryFn: () => apiClient.get('/sites'),
  });
  const sites = sitesRes?.data || [];

  // Handle Preset Changes
  const handleDatePresetChange = (preset: string) => {
    setSelectedDatePreset(preset);
    const now = new Date();
    const todayStr = getTodayString();

    if (preset === 'TODAY') {
      setDate(todayStr);
      setStartDate('');
      setEndDate('');
    } else if (preset === 'YESTERDAY') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
      setDate(yStr);
      setStartDate('');
      setEndDate('');
    } else if (preset === 'THIS_WEEK') {
      const first = new Date(now.setDate(now.getDate() - now.getDay()));
      const last = new Date(now.setDate(now.getDate() - now.getDay() + 6));
      setDate('');
      setStartDate(first.toISOString().split('T')[0]);
      setEndDate(last.toISOString().split('T')[0]);
    } else if (preset === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setDate('');
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(lastDay.toISOString().split('T')[0]);
    } else if (preset === 'ALL') {
      setDate('');
      setStartDate('');
      setEndDate('');
    } else if (preset === 'CUSTOM') {
      setDate('');
      if (!startDate) setStartDate(todayStr);
      if (!endDate) setEndDate(todayStr);
    }
    setPage(1);
  };

  const handleResetFilters = () => {
    setSelectedDatePreset('TODAY');
    setDate(getTodayString());
    setStartDate('');
    setEndDate('');
    setEmployeeId('');
    setSiteId('');
    setStatus('ALL');
    setSearch('');
    setPage(1);
  };

  // Build query params
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit === 'all' ? '1000' : limit.toString(),
    sortBy,
    sortOrder,
    ...(date ? { date } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
    ...(employeeId ? { employeeId } : {}),
    ...(siteId ? { siteId } : {}),
    ...(status !== 'ALL' ? { status } : {}),
    ...(search ? { search } : {}),
  });

  const {
    data: attendanceRes,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<any>({
    queryKey: ['attendance-list', queryParams.toString()],
    queryFn: () => apiClient.get(`/attendance?${queryParams.toString()}`),
  });

  const rawData: any = attendanceRes?.data;
  const records: AttendanceRecord[] = Array.isArray(rawData) ? rawData : (rawData?.records || []);
  const metrics = rawData?.metrics || attendanceRes?.metrics;
  const totalRecords = rawData?.total ?? attendanceRes?.pagination?.total ?? records.length;
  const totalPages = rawData?.totalPages ?? attendanceRes?.pagination?.totalPages ?? 1;

  // Options for employee dropdown
  const employeeOptions: SearchableOption[] = employees.map((emp) => {
    const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || '—';
    const roleLabel = formatRole(emp.role);
    const code = emp.employeeNumber || emp.employeeCode || emp.staffId || undefined;
    return {
      id: emp.id,
      label: name,
      subLabel: roleLabel,
      description: code ? `ID: ${code}` : undefined,
      searchValues: [name, roleLabel, code, emp.email],
    };
  });

  // Table Columns
  const columns = [
    {
      key: 'employeeName',
      label: 'Employee',
      sortable: true,
      render: (row: AttendanceRecord) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              backgroundColor: 'rgba(37, 99, 235, 0.12)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.8rem',
              flexShrink: 0,
            }}
          >
            {row.employeeName.substring(0, 2).toUpperCase()}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.employeeName}</span>
            {row.employeeCode && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                {row.employeeCode}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'employeeRole',
      label: 'Role',
      sortable: true,
      render: (row: AttendanceRecord) => (
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
          {formatRole(row.employeeRole)}
        </span>
      ),
    },
    {
      key: 'siteName',
      label: 'Site',
      sortable: true,
      render: (row: AttendanceRecord) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <MapPin size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{row.siteName || '—'}</span>
        </div>
      ),
    },
    {
      key: 'shiftName',
      label: 'Shift',
      sortable: true,
      render: (row: AttendanceRecord) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{row.shiftName || '—'}</span>
          {row.shiftStartTime && row.shiftEndTime && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {row.shiftStartTime} - {row.shiftEndTime}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'date',
      label: 'Attendance Date',
      sortable: true,
      render: (row: AttendanceRecord) => (
        <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
          {row.date}
        </span>
      ),
    },
    {
      key: 'checkInTime',
      label: 'Check-In',
      sortable: true,
      render: (row: AttendanceRecord) => (
        <span style={{ fontSize: '0.85rem', fontWeight: row.checkInTime ? 600 : 400, color: row.checkInTime ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          {row.checkInTime ? row.checkInTime : '—'}
        </span>
      ),
    },
    {
      key: 'checkOutTime',
      label: 'Check-Out',
      sortable: true,
      render: (row: AttendanceRecord) => (
        <span style={{ fontSize: '0.85rem', fontWeight: row.checkOutTime ? 600 : 400, color: row.checkOutTime ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          {row.checkOutTime ? row.checkOutTime : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row: AttendanceRecord) => <StatusChip status={row.status} />,
    },
    {
      key: 'workingDuration',
      label: 'Duration',
      sortable: true,
      render: (row: AttendanceRecord) => (
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: row.workingDuration ? 'var(--primary)' : 'var(--text-muted)' }}>
          {row.workingDuration || '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row: AttendanceRecord) => (
        <button
          type="button"
          onClick={() => {
            setSelectedRecord(row);
            setIsDetailModalOpen(true);
          }}
          className="btn btn-secondary"
          style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}
          title="View Attendance Details"
        >
          <Eye size={14} />
          <span>Details</span>
        </button>
      ),
    },
  ];

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);

  const buildExportQueryParams = () => {
    return new URLSearchParams({
      sortBy,
      sortOrder,
      ...(date ? { date } : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(selectedDatePreset ? { datePreset: selectedDatePreset.toLowerCase() } : {}),
      ...(employeeId ? { employeeId } : {}),
      ...(siteId ? { siteId } : {}),
      ...(status !== 'ALL' ? { status } : {}),
      ...(search ? { search } : {}),
    });
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    const toastId = toast.loading('Generating Attendance PDF Report...');
    try {
      const qParams = buildExportQueryParams();
      const token = getAccessToken();
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

      const response = await fetch(`${API_BASE_URL}/attendance/export/pdf?${qParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download Attendance PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `HelloOrbit_Attendance_Report_${date || 'export'}.pdf`;
      if (contentDisposition && contentDisposition.includes('filename=')) {
        filename = contentDisposition.split('filename=')[1].replace(/"/g, '');
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('Attendance PDF Report downloaded!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to download PDF.', { id: toastId });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleDownloadExcel = async () => {
    setIsDownloadingExcel(true);
    const toastId = toast.loading('Generating Attendance Excel Spreadsheet...');
    try {
      const qParams = buildExportQueryParams();
      const token = getAccessToken();
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

      const response = await fetch(`${API_BASE_URL}/attendance/export/excel?${qParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download Attendance Excel');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `HelloOrbit_Attendance_Report_${date || 'export'}.xlsx`;
      if (contentDisposition && contentDisposition.includes('filename=')) {
        filename = contentDisposition.split('filename=')[1].replace(/"/g, '');
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('Attendance Excel Report downloaded!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to download Excel.', { id: toastId });
    } finally {
      setIsDownloadingExcel(false);
    }
  };

  // Calculate quick stats from records/metrics
  const totalCheckInCount =
    metrics?.totalCheckedIn ??
    records.filter((r) => Boolean(r.checkInTime && r.checkInTime !== '—')).length;
  const lateCount = metrics?.totalLate ?? records.filter((r) => r.status === 'LATE').length;
  const completedCount = metrics?.totalCompleted ?? records.filter((r) => r.status === 'COMPLETED').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Attendance Management
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Monitor real-time guard attendance, check-in logs, and shift working durations.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', fontSize: '0.85rem' }}
            title="Download Attendance Report as PDF"
          >
            <FileText size={15} style={{ color: '#ef4444' }} />
            <span>{isDownloadingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={isDownloadingExcel}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', fontSize: '0.85rem' }}
            title="Download Attendance Report as Excel"
          >
            <FileSpreadsheet size={15} style={{ color: '#10b981' }} />
            <span>{isDownloadingExcel ? 'Generating Excel...' : 'Download Excel'}</span>
          </button>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
            <span>{isFetching ? 'Refreshing...' : 'Refresh Data'}</span>
          </button>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        <div className="glass-card" style={{ padding: '16px 20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Total Records</span>
            <Shield size={18} style={{ color: 'var(--primary)' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '8px', color: 'var(--text-primary)' }}>
            {totalRecords}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '16px 20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Total Check In Count</span>
            <CheckCircle2 size={18} style={{ color: 'var(--success, #10B981)' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '8px', color: 'var(--success, #10B981)' }}>
            {totalCheckInCount}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '16px 20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Late Check-ins</span>
            <AlertCircle size={18} style={{ color: 'var(--warning, #F59E0B)' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '8px', color: 'var(--warning, #F59E0B)' }}>
            {lateCount}
          </div>
        </div>

        <div className="glass-card" style={{ padding: '16px 20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Shift Completed</span>
            <Clock size={18} style={{ color: 'var(--primary)' }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '8px', color: 'var(--primary)' }}>
            {completedCount}
          </div>
        </div>
      </div>

      {/* Filter Control Box */}
      <div className="glass-card" style={{ padding: '20px', borderRadius: '14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Attendance Filters</h3>
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '6px 12px', gap: '6px' }}
          >
            <RefreshCw size={13} />
            <span>Reset Filters</span>
          </button>
        </div>

        {/* Date Preset Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: '4px' }}>
            Date Preset:
          </span>
          {[
            { id: 'TODAY', label: 'Today' },
            { id: 'YESTERDAY', label: 'Yesterday' },
            { id: 'THIS_WEEK', label: 'This Week' },
            { id: 'THIS_MONTH', label: 'This Month' },
            { id: 'ALL', label: 'All Dates' },
            { id: 'CUSTOM', label: 'Custom Range' },
          ].map((preset) => {
            const isSel = selectedDatePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleDatePresetChange(preset.id)}
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  padding: '5px 12px',
                  borderRadius: '20px',
                  border: isSel ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                  backgroundColor: isSel ? 'rgba(59, 130, 246, 0.15)' : 'var(--surface-color)',
                  color: isSel ? 'var(--primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Custom Range Date Pickers */}
        {selectedDatePreset === 'CUSTOM' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Start Date:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="form-input"
                style={{ fontSize: '0.82rem', padding: '6px 10px', borderRadius: '6px' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>End Date:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="form-input"
                style={{ fontSize: '0.82rem', padding: '6px 10px', borderRadius: '6px' }}
              />
            </div>
          </div>
        )}

        {/* Main Filter Dropdowns Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            alignItems: 'flex-end',
          }}
        >
          {/* Employee Searchable Select */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
              Employee
            </label>
            <SearchableSelect
              value={employeeId}
              onChange={(val) => {
                setEmployeeId(val);
                setPage(1);
              }}
              options={employeeOptions}
              defaultLabel="All Employees"
              searchPlaceholder="Search guard name, role, ID..."
              emptyMessage="No employees found"
              ariaLabel="Select employee filter"
            />
          </div>

          {/* Site Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
              Site / Location
            </label>
            <select
              value={siteId}
              onChange={(e) => {
                setSiteId(e.target.value);
                setPage(1);
              }}
              className="form-input"
              style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: '8px' }}
            >
              <option value="">All Sites</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
              Attendance Status
            </label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="form-input"
              style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: '8px' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="PRESENT">Present (Active)</option>
              <option value="LATE">Late Check-in</option>
              <option value="COMPLETED">Shift Completed</option>
              <option value="OFF">Off / Scheduled</option>
            </select>
          </div>

          {/* Keyword Search */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
              Search
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search name, code, site, shift..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="form-input"
                style={{ width: '100%', padding: '8px 12px 8px 34px', fontSize: '0.85rem', borderRadius: '8px' }}
              />
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Data Table */}
      {error ? (
        <div
          className="glass-card"
          style={{
            padding: '40px 24px',
            textAlign: 'center',
            borderRadius: '14px',
            color: 'var(--danger, #EF4444)',
          }}
        >
          <AlertCircle size={36} style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 6px' }}>Failed to Load Attendance</h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
            {(error as any)?.response?.data?.message || 'An unexpected error occurred while loading attendance records.'}
          </p>
          <button type="button" onClick={() => refetch()} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
            Try Again
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <DataTable
            columns={columns}
            data={records}
            isLoading={isLoading}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={(key) => {
              if (sortBy === key) {
                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
              } else {
                setSortBy(key);
                setSortOrder('desc');
              }
            }}
            emptyMessage={
              date
                ? `No attendance records found for date: ${date}.`
                : 'No attendance records found for the selected filter criteria.'
            }
          />

          {/* Pagination */}
          {!isLoading && totalRecords > 0 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(p) => setPage(p)}
              pageSize={limit}
              pageSizeOptions={[10, 25, 50, 'all']}
              onPageSizeChange={(size) => {
                setLimit(size);
                setPage(1);
              }}
              totalRecords={totalRecords}
            />
          )}
        </div>
      )}

      {/* Attendance Record Detail Modal */}
      {isDetailModalOpen && selectedRecord && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title="Attendance Record Details"
          maxWidth="680px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '8px 4px' }}>
            {/* Employee Hero Card */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1.1rem',
                  }}
                >
                  {selectedRecord.employeeName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                    {selectedRecord.employeeName}
                  </h4>
                  <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    {formatRole(selectedRecord.employeeRole)}
                    {selectedRecord.employeeCode ? ` • Staff ID: ${selectedRecord.employeeCode}` : ''}
                  </p>
                </div>
              </div>
              <StatusChip status={selectedRecord.status} />
            </div>

            {/* Attendance Activity Metrics */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '12px',
              }}
            >
              <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Attendance Date
                </span>
                <p style={{ margin: '4px 0 0', fontSize: '0.95rem', fontWeight: 700, fontFamily: 'monospace' }}>
                  {selectedRecord.date}
                </p>
              </div>

              <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Check-In Time
                </span>
                <p style={{ margin: '4px 0 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--success, #10B981)' }}>
                  {selectedRecord.checkInTime || '—'}
                </p>
              </div>

              <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Check-Out Time
                </span>
                <p style={{ margin: '4px 0 0', fontSize: '0.95rem', fontWeight: 700, color: selectedRecord.checkOutTime ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {selectedRecord.checkOutTime || '—'}
                </p>
              </div>

              <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Working Duration
                </span>
                <p style={{ margin: '4px 0 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary)' }}>
                  {selectedRecord.workingDuration || '—'}
                </p>
              </div>
            </div>

            {/* Shift & Location Details */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '14px',
              }}
            >
              <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Building2 size={16} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Site & Location</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600 }}>{selectedRecord.siteName || '—'}</p>
                {selectedRecord.siteId && (
                  <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    Site ID: {selectedRecord.siteId}
                  </p>
                )}
              </div>

              <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Clock size={16} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Shift Information</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600 }}>{selectedRecord.shiftName || '—'}</p>
                {selectedRecord.shiftStartTime && selectedRecord.shiftEndTime && (
                  <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Scheduled Hours: {selectedRecord.shiftStartTime} - {selectedRecord.shiftEndTime}
                  </p>
                )}
              </div>
            </div>

            {/* Verification & Telemetry */}
            <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Shield size={16} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Verification & Metadata</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', fontSize: '0.82rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Verification Method:</span>{' '}
                  <span style={{ fontWeight: 600 }}>{selectedRecord.verificationMethod || 'Biometric / Facial Recognition'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Record ID:</span>{' '}
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedRecord.id}</span>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="btn btn-secondary"
                style={{ padding: '8px 20px', fontSize: '0.85rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
