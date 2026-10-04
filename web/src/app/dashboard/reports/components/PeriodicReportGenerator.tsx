'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Calendar,
  User,
  MapPin,
  BarChart2,
  Layers,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../../../lib/axios';
import { getAccessToken } from '../../../utils/token';
import SearchableSelect, { SearchableOption } from './SearchableSelect';

export interface PeriodicReportGeneratorProps {
  clientId?: string;
  isCentralManager?: boolean;
  sites?: any[];
  employees?: any[];
}

export interface ReportDataset {
  metadata: {
    reportType?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    periodType: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    periodLabel: string;
    startDate: string;
    endDate: string;
    clientName: string;
    siteName?: string;
    employeeId?: string;
    employeeName?: string;
    employeeRole?: string;
    employeeNumber?: string;
    generatedAt: string;
    timezone: string;
    includeIncidents?: boolean;
    isKaizen?: boolean;
  };
  summary: {
    totalEmployees: number;
    activeEmployees: number;
    totalShifts: number;
    assignedPatrols: number;
    completedPatrols: number;
    incompletePatrols: number;
    additionalPatrols: number;
    mandatoryScheduled: number;
    mandatoryCompleted: number;
    mandatoryMissed: number;
    mandatoryCompliancePct: number;
    totalCheckpoints: number;
    checkpointsScanned: number;
    checkpointsMissed: number;
    requiredCheckpoints: number;
    completedCheckpoints: number;
    missedCheckpoints: number;
    checkpointCompletionPct: number;
    incidentsCount: number;
    mandatoryPatrolsScheduled?: number;
    mandatoryPatrolsCompleted?: number;
    mandatoryPatrolsMissed?: number;
    mandatoryPatrolCompliancePct?: number;
  };
  attendance: any[];
  patrols: any[];
  mandatoryPatrols: any[];
  checkpoints: any[];
  incidents: any[];
  siteSummary: any[];
  employeeSummary: any[];
}

function formatRoleLabel(role?: string | null, designation?: string | null): string {
  if (designation && designation.trim()) {
    const dLower = designation.trim().toLowerCase();
    if (dLower === 'security' || dLower === 'security guard' || dLower === 'guard') {
      return 'Security Guard';
    }
    return designation.trim();
  }
  if (!role) return 'Security Guard';
  const ROLE_MAP: Record<string, string> = {
    SECURITY: 'Security Guard',
    SECURITY_GUARD: 'Security Guard',
    GUARD: 'Security Guard',
    CLEANER: 'House Keeping',
    HOUSE_KEEPING: 'House Keeping',
    TECHNICIAN: 'Technician',
    SUPERVISOR: 'Supervisor',
    MANAGER: 'Community Manager',
    COMMUNITY_MANAGER: 'Community Manager',
    CENTRAL_MANAGER: 'Community Manager',
    SERVICE_ENGINEER: 'Service Engineer',
    PLUMBER: 'Plumber',
    LIFE_GUARD: 'Lifeguard',
  };
  return ROLE_MAP[role.toUpperCase()] || role;
}

export default function PeriodicReportGenerator({
  clientId,
  isCentralManager = false,
  sites: propSites,
  employees: propEmployees,
}: PeriodicReportGeneratorProps) {
  const [reportType, setReportType] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);
  const [reportData, setReportData] = useState<ReportDataset | null>(null);
  const [activeTab, setActiveTab] = useState<
    'summary' | 'mandatory' | 'attendance' | 'patrols' | 'checkpoints' | 'incidents' | 'employeeSummary'
  >('summary');

  // Sites and Employees state
  const [localSites, setLocalSites] = useState<any[]>(propSites || []);
  const [localEmployees, setLocalEmployees] = useState<any[]>(propEmployees || []);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);

  useEffect(() => {
    if (propSites && propSites.length > 0) {
      setLocalSites(propSites);
    } else {
      const url = clientId ? `/sites?clientId=${clientId}&limit=100` : '/sites?limit=100';
      apiClient
        .get(url)
        .then((res: any) => setLocalSites(res?.data || (Array.isArray(res) ? res : [])))
        .catch(() => setLocalSites([]));
    }
  }, [clientId, propSites]);

  useEffect(() => {
    if (propEmployees && propEmployees.length > 0) {
      setLocalEmployees(propEmployees);
    } else {
      setIsLoadingEmployees(true);
      const url = isCentralManager && clientId
        ? `/central-manager/employees?clientId=${clientId}&limit=1000`
        : clientId
        ? `/employees?clientId=${clientId}&limit=1000`
        : '/employees?limit=1000';

      apiClient
        .get(url)
        .then((res: any) => {
          const list = res?.data || (Array.isArray(res) ? res : []);
          setLocalEmployees(Array.isArray(list) ? list : []);
        })
        .catch(() => setLocalEmployees([]))
        .finally(() => setIsLoadingEmployees(false));
    }
  }, [clientId, isCentralManager, propEmployees]);

  const selectedEmployeeObj = localEmployees.find((e: any) => e.id === selectedEmployeeId);

  const employeeOptions: SearchableOption[] = localEmployees.map((emp: any) => {
    const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Employee';
    const role = formatRoleLabel(emp.role, emp.designation);
    const code = emp.employeeNumber || emp.employeeCode || undefined;
    return {
      id: emp.id,
      label: name,
      subLabel: code ? `${role} • ID: ${code}` : role,
      searchValues: [
        name,
        emp.firstName,
        emp.lastName,
        code,
        role,
        emp.role,
        emp.designation,
        emp.email,
      ],
    };
  });

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.append('reportType', reportType);
    params.append('date', selectedDate);
    if (clientId) params.append('clientId', clientId);
    if (selectedSiteId) params.append('siteId', selectedSiteId);
    if (selectedEmployeeId) params.append('employeeId', selectedEmployeeId);
    return params.toString();
  };

  const handleGenerateReport = async () => {
    setIsLoading(true);
    try {
      const qParams = buildQueryParams();
      const res: any = await apiClient.get(`/reports/summary/generate?${qParams}`);
      const data = res?.data || res;
      setReportData(data);
      if (!selectedEmployeeId && activeTab === 'patrols') {
        setActiveTab('summary');
      }
      toast.success(
        selectedEmployeeId
          ? `${reportType} Employee Report generated!`
          : `${reportType} General Summary Report generated!`
      );
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error?.message ||
        'Failed to generate periodic report.';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    const toastId = toast.loading('Generating PDF document...');
    try {
      const qParams = buildQueryParams();
      const token = getAccessToken();
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

      const response = await fetch(`${API_BASE_URL}/reports/summary/pdf?${qParams}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `HelloOrbit_${reportType}_Report_${selectedDate}.pdf`;
      if (contentDisposition && contentDisposition.includes('filename=')) {
        filename = contentDisposition.split('filename=')[1].replace(/"/g, '');
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('PDF report downloaded successfully!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to download PDF.', { id: toastId });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleDownloadExcel = async () => {
    setIsDownloadingExcel(true);
    const toastId = toast.loading('Generating Excel spreadsheet...');
    try {
      const qParams = buildQueryParams();
      const token = getAccessToken();
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

      const response = await fetch(`${API_BASE_URL}/reports/summary/excel?${qParams}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download Excel file');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `HelloOrbit_${reportType}_Report_${selectedDate}.xlsx`;
      if (contentDisposition && contentDisposition.includes('filename=')) {
        filename = contentDisposition.split('filename=')[1].replace(/"/g, '');
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('Excel report downloaded successfully!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to download Excel.', { id: toastId });
    } finally {
      setIsDownloadingExcel(false);
    }
  };

  const isEmployeeScoped = Boolean(reportData?.metadata?.employeeId);

  return (
    <div
      className="glass-card"
      style={{
        padding: '24px',
        borderRadius: '16px',
        border: '1px solid rgba(226, 232, 240, 0.8)',
        background: '#ffffff',
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      {/* Header & Type Switcher */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          paddingBottom: '16px',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={22} className="text-blue-600" />
            Periodic Summary Reports
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '4px 0 0 0' }}>
            Generate authoritative general or employee-specific compliance, attendance, and patrol reports.
          </p>
        </div>

        {/* Period Selector Buttons */}
        <div
          style={{
            display: 'inline-flex',
            backgroundColor: '#f1f5f9',
            padding: '4px',
            borderRadius: '10px',
            gap: '4px',
          }}
        >
          {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setReportType(type);
                setReportData(null);
              }}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '0.88rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backgroundColor: reportType === type ? '#2563eb' : 'transparent',
                color: reportType === type ? '#ffffff' : '#64748b',
                boxShadow: reportType === type ? '0 2px 4px rgba(37,99,235,0.2)' : 'none',
              }}
            >
              {type.charAt(0) + type.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Controls Bar: Employee -> Report Type -> Date -> Site -> Generate */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          backgroundColor: '#f8fafc',
          padding: '18px',
          borderRadius: '12px',
          border: '1px solid #edf2f7',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            alignItems: 'end',
          }}
        >
          {/* 1. Searchable Employee Dropdown */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <User size={14} />
                Employee (Optional)
              </label>
              {selectedEmployeeId && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEmployeeId('');
                    setReportData(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    padding: '0 4px',
                  }}
                  title="Clear employee filter"
                >
                  <X size={12} /> Clear
                </button>
              )}
            </div>
            <SearchableSelect
              value={selectedEmployeeId}
              onChange={(val) => {
                setSelectedEmployeeId(val);
                setReportData(null);
              }}
              options={employeeOptions}
              defaultLabel={isLoadingEmployees ? 'Loading employees...' : 'Select employee...'}
              searchPlaceholder="Search by name, role, staff ID..."
              emptyMessage={isLoadingEmployees ? 'Loading employee directory...' : 'No matching employees found.'}
              ariaLabel="Filter Report by Employee"
            />
          </div>

          {/* 2. Date Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
              <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} />
              {reportType === 'DAILY' ? 'Target Date' : reportType === 'WEEKLY' ? 'Week Reference Date' : 'Target Month'}
            </label>
            <input
              type={reportType === 'MONTHLY' ? 'month' : 'date'}
              value={reportType === 'MONTHLY' ? selectedDate.substring(0, 7) : selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setReportData(null);
              }}
              className="form-input"
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '0.88rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
              }}
            />
          </div>

          {/* 3. Site Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
              <MapPin size={14} style={{ display: 'inline', marginRight: '4px' }} />
              Filter Site (Optional)
            </label>
            <select
              value={selectedSiteId}
              onChange={(e) => {
                setSelectedSiteId(e.target.value);
                setReportData(null);
              }}
              className="form-input"
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '0.88rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
              }}
            >
              <option value="">All Sites</option>
              {localSites.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Action Button */}
          <div>
            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '9px 16px',
                fontSize: '0.9rem',
                fontWeight: 600,
                borderRadius: '8px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
              }}
            >
              {isLoading ? (
                <span>Generating...</span>
              ) : (
                <>
                  <BarChart2 size={16} />
                  <span>Generate Report</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Scope Indicator Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.8rem',
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: selectedEmployeeId ? '#eff6ff' : '#f1f5f9',
            border: `1px solid ${selectedEmployeeId ? '#bfdbfe' : '#e2e8f0'}`,
            color: selectedEmployeeId ? '#1e40af' : '#475569',
          }}
        >
          {selectedEmployeeId ? (
            <>
              <User size={14} style={{ color: '#2563eb' }} />
              <span>
                <strong>Employee Scope:</strong> Generating employee-specific report for{' '}
                <strong>
                  {selectedEmployeeObj
                    ? `${selectedEmployeeObj.firstName} ${selectedEmployeeObj.lastName || ''}`.trim()
                    : 'Selected Employee'}
                </strong>{' '}
                ({selectedEmployeeObj ? formatRoleLabel(selectedEmployeeObj.role, selectedEmployeeObj.designation) : 'Staff'})
                • Includes individual Patrol Sessions Activity.
              </span>
            </>
          ) : (
            <>
              <Layers size={14} style={{ color: '#64748b' }} />
              <span>
                <strong>General Scope:</strong> Generating client-wide summary report without individual employee patrol session tables.
              </span>
            </>
          )}
        </div>
      </div>

      {/* Generated Report Summary Container */}
      {reportData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Metadata Banner & Export Controls */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderRadius: '12px',
              backgroundColor: isEmployeeScoped ? '#f0fdf4' : '#eff6ff',
              border: `1px solid ${isEmployeeScoped ? '#bbf7d0' : '#bfdbfe'}`,
              gap: '16px',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '0.8rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: isEmployeeScoped ? '#166534' : '#1e40af',
                  fontWeight: 700,
                }}
              >
                {reportData.metadata.periodType || reportData.metadata.reportType} {isEmployeeScoped ? 'EMPLOYEE REPORT' : 'REPORT AUDIT'}
              </div>
              <div
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  color: isEmployeeScoped ? '#14532d' : '#1e3a8a',
                  marginTop: '2px',
                }}
              >
                {reportData.metadata.clientName} {reportData.metadata.siteName ? `• ${reportData.metadata.siteName}` : ''}
              </div>

              {isEmployeeScoped && (
                <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#166534', marginTop: '4px' }}>
                  👤 Employee: <strong>{reportData.metadata.employeeName}</strong> ({reportData.metadata.employeeRole || 'Security Guard'})
                  {reportData.metadata.employeeNumber ? ` • ID: ${reportData.metadata.employeeNumber}` : ''}
                </div>
              )}

              <div style={{ fontSize: '0.82rem', color: isEmployeeScoped ? '#15803d' : '#3b82f6', marginTop: '2px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <span>Period: <strong>{reportData.metadata.periodLabel || `${reportData.metadata.startDate} to ${reportData.metadata.endDate}`}</strong></span>
                <span>Timezone: {reportData.metadata.timezone}</span>
                <span>Generated: {new Date(reportData.metadata.generatedAt).toLocaleString()}</span>
              </div>
            </div>

            {/* Download Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  cursor: isDownloadingPdf ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
                }}
              >
                <Download size={14} />
                <span>{isDownloadingPdf ? 'Downloading...' : 'PDF Report'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadExcel}
                disabled={isDownloadingExcel}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  cursor: isDownloadingExcel ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
                }}
              >
                <Download size={14} />
                <span>{isDownloadingExcel ? 'Downloading...' : 'Excel (.xlsx)'}</span>
              </button>
            </div>
          </div>

          {/* Executive Metrics Overview Cards (6 distinct cards including 3 separate Checkpoint metrics) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '14px',
            }}
          >
            {/* Card 1: Mandatory Patrols Completed */}
            <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Mandatory Patrols Completed</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>
                {reportData.summary.mandatoryCompleted ?? reportData.summary.mandatoryPatrolsCompleted ?? 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '4px' }}>
                {reportData.summary.mandatoryCompleted ?? 0} / {reportData.summary.mandatoryScheduled ?? 0} Scheduled Completed
              </div>
            </div>

            {/* Card 2: Mandatory Patrols Missed */}
            <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Mandatory Patrols Missed</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: (reportData.summary.mandatoryMissed ?? 0) > 0 ? '#dc2626' : '#1e293b', marginTop: '4px' }}>
                {reportData.summary.mandatoryMissed ?? 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '4px' }}>
                {(reportData.summary.mandatoryMissed ?? 0) === 0 ? 'Zero missed scheduled patrols' : `${reportData.summary.mandatoryMissed} Missed Scheduled Patrols`}
              </div>
            </div>

            {/* Card 3: Total Patrol Sessions */}
            <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Patrol Sessions</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#1e293b', marginTop: '4px' }}>
                {reportData.summary.assignedPatrols}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '4px' }}>
                {reportData.summary.completedPatrols} Completed • +{reportData.summary.additionalPatrols} Extra
              </div>
            </div>

            {/* Card 4: Total Checkpoints */}
            <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Checkpoints</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                {reportData.summary.totalCheckpoints ?? reportData.summary.requiredCheckpoints ?? 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '4px' }}>
                Required Checkpoint Scans
              </div>
            </div>

            {/* Card 5: Checkpoints Scanned */}
            <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Checkpoints Scanned</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#16a34a', marginTop: '4px' }}>
                {reportData.summary.checkpointsScanned ?? reportData.summary.completedCheckpoints ?? 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '4px' }}>
                {reportData.summary.checkpointCompletionPct ?? 100}% Compliance Rate
              </div>
            </div>

            {/* Card 6: Checkpoints Missed */}
            <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Checkpoints Missed</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: (reportData.summary.checkpointsMissed ?? reportData.summary.missedCheckpoints ?? 0) > 0 ? '#dc2626' : '#1e293b', marginTop: '4px' }}>
                {reportData.summary.checkpointsMissed ?? reportData.summary.missedCheckpoints ?? 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '4px' }}>
                {(reportData.summary.checkpointsMissed ?? reportData.summary.missedCheckpoints ?? 0) === 0 ? 'Zero missed checkpoint scans' : 'Missed scheduled checkpoints'}
              </div>
            </div>
          </div>

          {/* Section Navigation Tabs: Conditionally include Patrol Activity only for employee reports */}
          <div style={{ borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '8px', overflowX: 'auto' }}>
            {[
              { id: 'summary', label: `Site Summary (${reportData.siteSummary?.length || 0})` },
              { id: 'mandatory', label: `Mandatory Patrols (${reportData.mandatoryPatrols?.length || 0})` },
              ...(isEmployeeScoped ? [{ id: 'patrols', label: `Patrol Activity (${reportData.patrols?.length || 0})` }] : []),
              { id: 'attendance', label: `Attendance (${reportData.attendance?.length || 0})` },
              ...((!(reportData.metadata?.isKaizen || reportData.metadata?.includeIncidents === false || reportData.metadata?.clientName?.toLowerCase().includes('kaizen')) && reportData.incidents)
                ? [{ id: 'incidents', label: `Incidents (${reportData.incidents.length})` }]
                : []),
              { id: 'employeeSummary', label: `Employee Performance (${reportData.employeeSummary?.length || 0})` },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as any)}
                style={{
                  padding: '10px 16px',
                  fontSize: '0.85rem',
                  fontWeight: activeTab === t.id ? 700 : 500,
                  color: activeTab === t.id ? '#2563eb' : '#64748b',
                  borderBottom: activeTab === t.id ? '2px solid #2563eb' : '2px solid transparent',
                  background: 'none',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab Content Display */}
          <div style={{ overflowX: 'auto' }}>
            {activeTab === 'summary' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>Site</th>
                    <th style={{ padding: '10px 12px' }}>Staff Count</th>
                    <th style={{ padding: '10px 12px' }}>Shifts</th>
                    <th style={{ padding: '10px 12px' }}>Completed Patrols</th>
                    <th style={{ padding: '10px 12px' }}>Mandatory Compliance</th>
                    <th style={{ padding: '10px 12px' }}>Checkpoints Scanned</th>
                    {!(reportData.metadata?.isKaizen || reportData.metadata?.includeIncidents === false || reportData.metadata?.clientName?.toLowerCase().includes('kaizen')) && (
                      <th style={{ padding: '10px 12px' }}>Incidents</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {reportData.siteSummary?.map((site, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{site.siteName}</td>
                      <td style={{ padding: '10px 12px' }}>{site.activeEmployees || site.employeesCount || 0}</td>
                      <td style={{ padding: '10px 12px' }}>{site.totalShifts || 0}</td>
                      <td style={{ padding: '10px 12px' }}>{site.completedPatrols}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: site.mandatoryCompliancePct >= 90 ? '#16a34a' : '#d97706' }}>
                        {site.mandatoryCompliancePct}% ({site.mandatoryCompleted}/{site.mandatoryScheduled})
                      </td>
                      <td style={{ padding: '10px 12px' }}>{site.completedCheckpoints} / {site.requiredCheckpoints}</td>
                      {!(reportData.metadata?.isKaizen || reportData.metadata?.includeIncidents === false || reportData.metadata?.clientName?.toLowerCase().includes('kaizen')) && (
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: site.incidentsCount > 0 ? '#dc2626' : '#64748b' }}>
                          {site.incidentsCount || site.incidents || 0}
                        </td>
                      )}
                    </tr>
                  ))}
                  {(!reportData.siteSummary || reportData.siteSummary.length === 0) && (
                    <tr>
                      <td colSpan={(reportData.metadata?.isKaizen || reportData.metadata?.includeIncidents === false || reportData.metadata?.clientName?.toLowerCase().includes('kaizen')) ? 6 : 7} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                        No site summary data for the selected filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'mandatory' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>Sequence</th>
                    <th style={{ padding: '10px 12px' }}>Employee</th>
                    <th style={{ padding: '10px 12px' }}>Role</th>
                    <th style={{ padding: '10px 12px' }}>Site</th>
                    <th style={{ padding: '10px 12px' }}>Shift</th>
                    <th style={{ padding: '10px 12px' }}>Scheduled Time</th>
                    <th style={{ padding: '10px 12px' }}>Mandatory Window</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                    <th style={{ padding: '10px 12px' }}>Completed At</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.mandatoryPatrols?.map((mp, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>Patrol {mp.sequence}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{mp.guardName || mp.employeeName}</td>
                      <td style={{ padding: '10px 12px' }}>{mp.employeeRole || 'Security Guard'}</td>
                      <td style={{ padding: '10px 12px' }}>{mp.siteName}</td>
                      <td style={{ padding: '10px 12px' }}>{mp.shiftName}</td>
                      <td style={{ padding: '10px 12px' }}>{mp.scheduledAt}</td>
                      <td style={{ padding: '10px 12px' }}>{mp.windowStart} - {mp.windowEnd}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: mp.status === 'COMPLETED' ? '#dcfce7' : '#fee2e2', color: mp.status === 'COMPLETED' ? '#15803d' : '#b91c1c' }}>
                          {mp.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>{mp.completedAt || '—'}</td>
                    </tr>
                  ))}
                  {(!reportData.mandatoryPatrols || reportData.mandatoryPatrols.length === 0) && (
                    <tr>
                      <td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                        No mandatory patrols recorded for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {isEmployeeScoped && activeTab === 'patrols' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>Patrol Code</th>
                    <th style={{ padding: '10px 12px' }}>Employee</th>
                    <th style={{ padding: '10px 12px' }}>Role</th>
                    <th style={{ padding: '10px 12px' }}>Site / Route</th>
                    <th style={{ padding: '10px 12px' }}>Started At</th>
                    <th style={{ padding: '10px 12px' }}>Completed At</th>
                    <th style={{ padding: '10px 12px' }}>Checkpoints</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.patrols?.map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>{p.patrolCode}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{p.employeeName || p.guardName}</td>
                      <td style={{ padding: '10px 12px' }}>{p.employeeRole || 'Security Guard'}</td>
                      <td style={{ padding: '10px 12px' }}>{p.siteName} - {p.routeName}</td>
                      <td style={{ padding: '10px 12px' }}>{p.startedAt}</td>
                      <td style={{ padding: '10px 12px' }}>{p.completedAt || '—'}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                        {p.checkpointsDisplay || `${p.checkpointsCompleted ?? p.checkpointsScanned ?? 0} / ${p.checkpointsRequired ?? p.totalCheckpoints ?? 0}`}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: p.status === 'COMPLETED' ? '#dcfce7' : '#fef3c7', color: p.status === 'COMPLETED' ? '#15803d' : '#b45309' }}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!reportData.patrols || reportData.patrols.length === 0) && (
                    <tr>
                      <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                        No patrol sessions recorded for this employee.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'attendance' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>Date</th>
                    <th style={{ padding: '10px 12px' }}>Employee</th>
                    <th style={{ padding: '10px 12px' }}>Role</th>
                    <th style={{ padding: '10px 12px' }}>Site</th>
                    <th style={{ padding: '10px 12px' }}>Shift</th>
                    <th style={{ padding: '10px 12px' }}>Check-In</th>
                    <th style={{ padding: '10px 12px' }}>Check-Out</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.attendance?.map((att, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 12px' }}>{att.shiftDate}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{att.employeeName}</td>
                      <td style={{ padding: '10px 12px' }}>{att.employeeRole || 'Security Guard'}</td>
                      <td style={{ padding: '10px 12px' }}>{att.siteName}</td>
                      <td style={{ padding: '10px 12px' }}>{att.shiftName}</td>
                      <td style={{ padding: '10px 12px' }}>{att.checkInTime || '—'}</td>
                      <td style={{ padding: '10px 12px' }}>{att.checkOutTime || '—'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: att.status === 'PRESENT' ? '#dcfce7' : '#fee2e2', color: att.status === 'PRESENT' ? '#15803d' : '#b91c1c' }}>
                          {att.status} {att.isLate ? '(Late)' : ''}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!reportData.attendance || reportData.attendance.length === 0) && (
                    <tr>
                      <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                        No attendance logs recorded for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {!(reportData.metadata?.isKaizen || reportData.metadata?.includeIncidents === false || reportData.metadata?.clientName?.toLowerCase().includes('kaizen')) && activeTab === 'incidents' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>Reported At</th>
                    <th style={{ padding: '10px 12px' }}>Incident ID</th>
                    <th style={{ padding: '10px 12px' }}>Site</th>
                    <th style={{ padding: '10px 12px' }}>Employee</th>
                    <th style={{ padding: '10px 12px' }}>Type / Severity</th>
                    <th style={{ padding: '10px 12px' }}>Description</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.incidents?.map((inc, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 12px' }}>{inc.reportedAt || inc.timestamp}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#dc2626' }}>{inc.id || inc.incidentId}</td>
                      <td style={{ padding: '10px 12px' }}>{inc.siteName}</td>
                      <td style={{ padding: '10px 12px' }}>{inc.guardName || inc.reportedBy}</td>
                      <td style={{ padding: '10px 12px' }}>{inc.type || inc.category} ({inc.severity})</td>
                      <td style={{ padding: '10px 12px', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {inc.description}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#fef3c7', color: '#b45309' }}>
                          {inc.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!reportData.incidents || reportData.incidents.length === 0) && (
                    <tr>
                      <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                        No incidents reported during this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'employeeSummary' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>Employee</th>
                    <th style={{ padding: '10px 12px' }}>Role</th>
                    <th style={{ padding: '10px 12px' }}>Site</th>
                    <th style={{ padding: '10px 12px' }}>Completed Patrols</th>
                    <th style={{ padding: '10px 12px' }}>Mandatory Patrols</th>
                    <th style={{ padding: '10px 12px' }}>Mandatory %</th>
                    <th style={{ padding: '10px 12px' }}>Checkpoints Scanned</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.employeeSummary?.map((emp, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{emp.employeeName}</td>
                      <td style={{ padding: '10px 12px' }}>{emp.employeeRole || 'Security Guard'}</td>
                      <td style={{ padding: '10px 12px' }}>{emp.siteName}</td>
                      <td style={{ padding: '10px 12px' }}>{emp.completedPatrols}</td>
                      <td style={{ padding: '10px 12px' }}>{emp.mandatoryCompleted} / {emp.mandatoryScheduled}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: emp.mandatoryCompliancePct >= 90 ? '#16a34a' : '#d97706' }}>
                        {emp.mandatoryCompliancePct}%
                      </td>
                      <td style={{ padding: '10px 12px' }}>{emp.checkpointsScanned}</td>
                    </tr>
                  ))}
                  {(!reportData.employeeSummary || reportData.employeeSummary.length === 0) && (
                    <tr>
                      <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                        No employee summary records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
