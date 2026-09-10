'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  FileText,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wrench,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiClient } from '../../lib/axios';

import CompanyCarouselHeader from './components/CompanyCarouselHeader';
import OrganizationHeroCard, { SelectedClientData } from './components/OrganizationHeroCard';
import SnagDonutChart from './components/SnagDonutChart';

const ROLE_LABELS: Record<string, string> = {
  SECURITY: 'Security Guard',
  SECURITY_GUARD: 'Security Guard',
  TECHNICIAN: 'Technician',
  CLEANER: 'House Keeping',
  SERVICE_ENGINEER: 'Service Engineer',
  SUPERVISOR: 'Supervisor',
  MANAGER: 'Manager',
  LIFE_GUARD: 'Lifeguard',
  PLUMBER: 'Plumber',
};

function getRoleLabel(role?: string): string {
  if (!role) return 'Employee';
  return ROLE_LABELS[role.toUpperCase()] || role.replace('_', ' ');
}

export default function CentralDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = searchParams?.get('clientId') || '';

  const [dateRange, setDateRange] = useState<string>('THIS_MONTH');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Compute dateFrom and dateTo strings based on dateRange selection
  const getDateParams = () => {
    const now = new Date();
    let from: string | undefined;
    let to: string | undefined;

    if (dateRange === 'TODAY') {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
    } else if (dateRange === 'YESTERDAY') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      from = new Date(y.getFullYear(), y.getMonth(), y.getDate()).toISOString();
      to = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59).toISOString();
    } else if (dateRange === 'LAST_7_DAYS') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      from = d.toISOString();
    } else if (dateRange === 'LAST_30_DAYS') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      from = d.toISOString();
    } else if (dateRange === 'THIS_MONTH') {
      from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    } else if (dateRange === 'CUSTOM' && customFrom && customTo) {
      from = new Date(customFrom).toISOString();
      to = new Date(customTo).toISOString();
    }

    return { dateFrom: from, dateTo: to };
  };

  const fetchDashboard = async (targetClientId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { dateFrom, dateTo } = getDateParams();
      const params = new URLSearchParams();
      if (targetClientId || clientId) {
        params.set('clientId', targetClientId || clientId);
      }
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res: any = await apiClient.get(`/central-manager/dashboard?${params.toString()}`);
      setDashboardData(res?.data || res);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Unable to load dashboard data. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard(clientId);
  }, [clientId, dateRange, customFrom, customTo]);

  const handleSelectClient = (newClientId: string) => {
    router.push(`/central/dashboard?clientId=${newClientId}`);
  };

  if (isLoading && !dashboardData) {
    return (
      <div className="dashboard-loading-container">
        <RefreshCw className="spin-icon" size={32} />
        <p>Loading Centralized Manager Executive Dashboard...</p>
        <style jsx>{`
          .dashboard-loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 400px;
            gap: 16px;
            color: var(--text-secondary);
          }
          :global(.spin-icon) {
            animation: spin 1s linear infinite;
            color: #2563eb;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error && !dashboardData) {
    return (
      <div className="dashboard-error-container">
        <AlertTriangle size={40} style={{ color: '#ef4444' }} />
        <h3>Unable to load dashboard</h3>
        <p>{error}</p>
        <button onClick={() => fetchDashboard(clientId)} className="btn btn-primary" style={{ marginTop: '12px' }}>
          Retry Loading
        </button>
        <style jsx>{`
          .dashboard-error-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 350px;
            text-align: center;
            padding: 32px;
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 16px;
          }
        `}</style>
      </div>
    );
  }

  const global = dashboardData?.global || {
    organizationsCount: 0,
    totalEmployees: 0,
    completedPatrols: 0,
    openObservations: 0,
    openSnags: 0,
    avgCompliance: 100,
  };

  const clientsList = dashboardData?.clients || [];
  const selectedClient: SelectedClientData | null = dashboardData?.selectedClient || null;

  return (
    <div className="central-dashboard-root">
      {/* Page Header */}
      <div className="dashboard-header-row">
        <div>
          <h1 className="page-header-title">Executive Dashboard</h1>
          <p className="page-header-subtitle">Multi-organization operational overview & analytics</p>
        </div>

        {/* Date Range Selector */}
        <div className="date-filter-group">
          <div className="date-select-wrapper">
            <Calendar size={16} className="date-icon" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="date-select-input"
            >
              <option value="THIS_MONTH">This Month</option>
              <option value="TODAY">Today</option>
              <option value="YESTERDAY">Yesterday</option>
              <option value="LAST_7_DAYS">Last 7 Days</option>
              <option value="LAST_30_DAYS">Last 30 Days</option>
              <option value="CUSTOM">Custom Range</option>
            </select>
          </div>

          {dateRange === 'CUSTOM' && (
            <div className="custom-date-inputs">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="custom-date-field"
              />
              <span style={{ color: 'var(--text-muted)' }}>to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="custom-date-field"
              />
            </div>
          )}
        </div>
      </div>

      {/* Global Multi-Company KPI Strip */}
      <div className="global-kpi-strip">
        <div className="global-kpi-card">
          <div className="kpi-icon-badge" style={{ background: 'rgba(37, 99, 235, 0.12)', color: '#2563EB' }}>
            <Building2 size={20} />
          </div>
          <div className="kpi-text-box">
            <span className="global-kpi-value">{global.organizationsCount}</span>
            <span className="global-kpi-label">Organizations</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => router.push('/central/employees')}
          className="global-kpi-card clickable"
        >
          <div className="kpi-icon-badge" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3B82F6' }}>
            <Users size={20} />
          </div>
          <div className="kpi-text-box">
            <span className="global-kpi-value">{global.totalEmployees}</span>
            <span className="global-kpi-label">Total Employees</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => router.push('/central/reports')}
          className="global-kpi-card clickable"
        >
          <div className="kpi-icon-badge" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10B981' }}>
            <CheckCircle2 size={20} />
          </div>
          <div className="kpi-text-box">
            <span className="global-kpi-value">{global.completedPatrols}</span>
            <span className="global-kpi-label">Completed Patrols</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => router.push('/central/observations')}
          className="global-kpi-card clickable"
        >
          <div className="kpi-icon-badge" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#F59E0B' }}>
            <AlertTriangle size={20} />
          </div>
          <div className="kpi-text-box">
            <span className="global-kpi-value">{global.openObservations}</span>
            <span className="global-kpi-label">Open Observations</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => router.push('/central/snags')}
          className="global-kpi-card clickable"
        >
          <div className="kpi-icon-badge" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#EF4444' }}>
            <Wrench size={20} />
          </div>
          <div className="kpi-text-box">
            <span className="global-kpi-value">{global.openSnags}</span>
            <span className="global-kpi-label">Open Snags</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => router.push('/central/reports')}
          className="global-kpi-card clickable"
        >
          <div className="kpi-icon-badge" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#6366F1' }}>
            <ShieldCheck size={20} />
          </div>
          <div className="kpi-text-box">
            <span className="global-kpi-value">{global.avgCompliance}%</span>
            <span className="global-kpi-label">Avg Compliance</span>
          </div>
        </button>
      </div>

      {/* Multi-Company Carousel Header & Selected Hero Card */}
      {clientsList.length > 0 && selectedClient ? (
        <div className="hero-section-wrapper">
          <CompanyCarouselHeader
            clients={clientsList}
            selectedClientId={selectedClient.id}
            onSelectClient={handleSelectClient}
          />
          <OrganizationHeroCard client={selectedClient} />
        </div>
      ) : (
        <div className="no-orgs-empty-card">
          <Building2 size={48} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <h3>No Organizations Assigned</h3>
          <p>You currently have no assigned client organizations to manage.</p>
        </div>
      )}

      {/* Secondary 2-Column Analytics Area */}
      {selectedClient && (
        <div className="analytics-two-col-grid">
          {/* LEFT: Snag Donut & Categories */}
          <div className="analytics-card">
            <div className="card-header-bar">
              <div className="card-header-title">
                <Wrench size={18} style={{ color: '#2563EB' }} />
                <h3>Snag Categories & Status Breakdown</h3>
              </div>
              <button
                type="button"
                onClick={() => router.push(`/central/snags?clientId=${selectedClient.id}`)}
                className="view-all-link"
              >
                <span>View Snags</span>
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="card-body">
              <SnagDonutChart
                clientId={selectedClient.id}
                totalSnags={selectedClient.snagStatusSummary?.total ?? selectedClient.metrics?.totalSnagsCount ?? 0}
                openSnags={selectedClient.snagStatusSummary?.open ?? selectedClient.metrics?.openSnagsCount ?? 0}
                wipSnags={selectedClient.snagStatusSummary?.wip ?? selectedClient.metrics?.wipSnagsCount ?? 0}
                closedSnags={selectedClient.snagStatusSummary?.closed ?? selectedClient.metrics?.closedSnagsCount ?? 0}
                categories={selectedClient.snagDistribution || []}
              />
            </div>
          </div>

          {/* RIGHT: Operational Summary & Employee Roles */}
          <div className="analytics-card">
            <div className="card-header-bar">
              <div className="card-header-title">
                <FileText size={18} style={{ color: '#2563EB' }} />
                <h3>Operational & Workforce Summary</h3>
              </div>
            </div>

            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Observation Summary */}
              <div className="sub-analytics-box">
                <div className="sub-box-header">
                  <span className="sub-title">Observation Reports</span>
                  <button
                    onClick={() => router.push(`/central/observations?clientId=${selectedClient.id}`)}
                    className="view-link-sm"
                  >
                    View All ({selectedClient.observationSummary?.total ?? selectedClient.metrics?.totalObservationsCount ?? 0})
                  </button>
                </div>
                <div className="metric-pills-row">
                  <button
                    onClick={() => router.push(`/central/observations?clientId=${selectedClient.id}`)}
                    className="metric-pill"
                  >
                    <span className="pill-val">{selectedClient.observationSummary?.total ?? selectedClient.metrics?.totalObservationsCount ?? 0}</span>
                    <span className="pill-lbl">Total</span>
                  </button>
                  <button
                    onClick={() => router.push(`/central/observations?clientId=${selectedClient.id}&status=OPEN`)}
                    className="metric-pill open"
                  >
                    <span className="pill-val">{selectedClient.observationSummary?.open ?? selectedClient.metrics?.openObservationsCount ?? 0}</span>
                    <span className="pill-lbl">Open</span>
                  </button>
                  <button
                    onClick={() => router.push(`/central/observations?clientId=${selectedClient.id}&status=REVIEWED`)}
                    className="metric-pill reviewed"
                  >
                    <span className="pill-val">{selectedClient.observationSummary?.reviewed ?? selectedClient.metrics?.reviewedObservationsCount ?? 0}</span>
                    <span className="pill-lbl">Reviewed</span>
                  </button>
                </div>
              </div>

              {/* Patrol Summary */}
              <div className="sub-analytics-box">
                <div className="sub-box-header">
                  <span className="sub-title">Patrol Performance</span>
                  <button
                    onClick={() => router.push(`/central/reports?clientId=${selectedClient.id}`)}
                    className="view-link-sm"
                  >
                    Audit Reports
                  </button>
                </div>
                <div className="metric-pills-row">
                  <button
                    onClick={() => router.push(`/central/reports?clientId=${selectedClient.id}`)}
                    className="metric-pill"
                  >
                    <span className="pill-val">{selectedClient.patrolSummary?.completedPatrols ?? selectedClient.metrics?.completedPatrolsCount ?? 0}</span>
                    <span className="pill-lbl">Completed</span>
                  </button>
                  <button
                    onClick={() => router.push(`/central/reports?clientId=${selectedClient.id}`)}
                    className="metric-pill active"
                  >
                    <span className="pill-val">{selectedClient.patrolSummary?.activePatrols ?? selectedClient.metrics?.activePatrolsCount ?? 0}</span>
                    <span className="pill-lbl">Active</span>
                  </button>
                  <button
                    onClick={() => router.push(`/central/reports?clientId=${selectedClient.id}`)}
                    className="metric-pill compliance"
                  >
                    <span className="pill-val">{selectedClient.patrolSummary?.avgCompliance ?? selectedClient.metrics?.complianceRate ?? 0}%</span>
                    <span className="pill-lbl">Compliance</span>
                  </button>
                </div>
              </div>

              {/* Employee Role Distribution */}
              <div className="sub-analytics-box">
                <div className="sub-box-header">
                  <span className="sub-title">Workforce Roles ({selectedClient.metrics?.employeesCount ?? 0})</span>
                  <button
                    onClick={() => router.push(`/central/employees?clientId=${selectedClient.id}`)}
                    className="view-link-sm"
                  >
                    Employees List
                  </button>
                </div>
                <div className="role-tags-grid">
                  {(selectedClient.employeeRoles && selectedClient.employeeRoles.length > 0) ? (
                    selectedClient.employeeRoles.map((r, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() =>
                          router.push(
                            `/central/employees?clientId=${selectedClient.id}&role=${encodeURIComponent(r.role)}`
                          )
                        }
                        className="role-tag-btn"
                      >
                        <span className="role-name">{getRoleLabel(r.role)}</span>
                        <span className="role-count">{r.count}</span>
                      </button>
                    ))
                  ) : (
                    <span className="muted-text">No active employee roles recorded.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attention Required Section */}
      {selectedClient && selectedClient.attentionRequired && selectedClient.attentionRequired.length > 0 && (
        <div className="attention-section-card">
          <div className="card-header-bar">
            <div className="card-header-title">
              <ShieldAlert size={20} style={{ color: '#EF4444' }} />
              <h3>Attention Required Items</h3>
            </div>
            <span className="attention-count-badge">
              {selectedClient.attentionRequired.length} Urgent Items
            </span>
          </div>

          <div className="attention-list-grid">
            {selectedClient.attentionRequired.map((item: any) => (
              <div
                key={item.id}
                onClick={() => {
                  if (item.type === 'SNAG') {
                    router.push(`/central/snags?clientId=${selectedClient.id}`);
                  } else {
                    router.push(`/central/observations?clientId=${selectedClient.id}`);
                  }
                }}
                className="attention-item-card"
              >
                <div className="attention-item-header">
                  <span
                    className={`attention-type-badge ${item.type.toLowerCase()}`}
                  >
                    {item.type}
                  </span>
                  <span className="attention-date">
                    {new Date(item.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                <h4 className="attention-item-title">{item.title}</h4>
                <p className="attention-item-sub">{item.subtitle}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .central-dashboard-root {
          display: flex;
          flex-direction: column;
          gap: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }
        .dashboard-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .page-header-title {
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--text-primary, #0f172a);
          margin: 0;
          letter-spacing: -0.01em;
        }
        .page-header-subtitle {
          font-size: 0.875rem;
          color: var(--text-secondary, #64748b);
          margin: 2px 0 0 0;
        }
        .date-filter-group {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .date-select-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        :global(.date-icon) {
          position: absolute;
          left: 12px;
          color: var(--text-secondary, #64748b);
          pointer-events: none;
        }
        .date-select-input {
          padding: 8px 16px 8px 36px;
          border-radius: 8px;
          border: 1px solid var(--border-color, #e2e8f0);
          background: var(--bg-card, #ffffff);
          color: var(--text-primary, #0f172a);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
        }
        .custom-date-inputs {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .custom-date-field {
          padding: 6px 10px;
          border-radius: 6px;
          border: 1px solid var(--border-color, #e2e8f0);
          font-size: 0.8rem;
          background: var(--bg-card, #ffffff);
        }
        .global-kpi-strip {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
        }
        .global-kpi-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 18px;
          background: var(--bg-card, #ffffff);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 14px;
          box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.03);
          text-align: left;
        }
        .global-kpi-card.clickable {
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .global-kpi-card.clickable:hover {
          border-color: #2563eb;
          transform: translateY(-2px);
          box-shadow: 0 8px 20px -4px rgba(37, 99, 235, 0.12);
        }
        .kpi-icon-badge {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .kpi-text-box {
          display: flex;
          flex-direction: column;
        }
        .global-kpi-value {
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--text-primary, #0f172a);
          line-height: 1.1;
        }
        .global-kpi-label {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text-secondary, #64748b);
          margin-top: 2px;
        }
        .hero-section-wrapper {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .no-orgs-empty-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          background: var(--bg-card, #ffffff);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 16px;
          text-align: center;
          color: var(--text-secondary);
        }
        .analytics-two-col-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        .analytics-card {
          background: var(--bg-card, #ffffff);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 16px;
          box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.03);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .card-header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          background: var(--surface-color, #f8fafc);
          border-bottom: 1px solid var(--border-color, #e2e8f0);
        }
        .card-header-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .card-header-title h3 {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text-primary, #0f172a);
        }
        .view-all-link {
          display: flex;
          align-items: center;
          gap: 4px;
          background: transparent;
          border: none;
          color: #2563eb;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
        }
        .view-all-link:hover {
          text-decoration: underline;
        }
        .card-body {
          padding: 20px;
          flex: 1;
        }
        .stacked-analytics {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .sub-analytics-box {
          background: var(--surface-color, #f8fafc);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 12px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .sub-box-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .sub-title {
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--text-primary, #0f172a);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .view-link-sm {
          background: transparent;
          border: none;
          color: #2563eb;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
        }
        .view-link-sm:hover {
          text-decoration: underline;
        }
        .metric-pills-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .metric-pill {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 8px;
          background: var(--bg-card, #ffffff);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .metric-pill:hover {
          border-color: #2563eb;
          transform: translateY(-1px);
        }
        .pill-val {
          font-size: 1.15rem;
          font-weight: 800;
          color: var(--text-primary, #0f172a);
        }
        .metric-pill.open .pill-val {
          color: #f59e0b;
        }
        .metric-pill.reviewed .pill-val {
          color: #10b981;
        }
        .metric-pill.active .pill-val {
          color: #3b82f6;
        }
        .metric-pill.compliance .pill-val {
          color: #6366f1;
        }
        .pill-lbl {
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--text-secondary, #64748b);
          margin-top: 2px;
        }
        .role-tags-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .role-tag-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: var(--bg-card, #ffffff);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.8rem;
          transition: all 0.15s ease;
        }
        .role-tag-btn:hover {
          border-color: #2563eb;
          color: #2563eb;
          transform: translateY(-1px);
        }
        .role-name {
          font-weight: 600;
          color: var(--text-primary, #0f172a);
        }
        .role-count {
          font-weight: 800;
          color: #2563eb;
          background: rgba(37, 99, 235, 0.1);
          padding: 2px 6px;
          border-radius: 4px;
        }
        .muted-text {
          font-size: 0.8rem;
          color: var(--text-secondary);
          font-style: italic;
        }
        .attention-section-card {
          background: var(--bg-card, #ffffff);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 16px;
          box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.03);
          overflow: hidden;
        }
        .attention-count-badge {
          font-size: 0.75rem;
          font-weight: 800;
          color: #ef4444;
          background: rgba(239, 68, 68, 0.12);
          padding: 4px 10px;
          border-radius: 6px;
        }
        .attention-list-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
          padding: 20px;
        }
        .attention-item-card {
          padding: 14px;
          border-radius: 10px;
          background: var(--surface-color, #f8fafc);
          border: 1px solid var(--border-color, #e2e8f0);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .attention-item-card:hover {
          border-color: #ef4444;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.1);
        }
        .attention-item-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
        }
        .attention-type-badge {
          font-size: 0.68rem;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
        }
        .attention-type-badge.snag {
          background: rgba(239, 68, 68, 0.12);
          color: #ef4444;
        }
        .attention-type-badge.observation {
          background: rgba(245, 158, 11, 0.12);
          color: #f59e0b;
        }
        .attention-date {
          font-size: 0.72rem;
          color: var(--text-muted, #94a3b8);
        }
        .attention-item-title {
          margin: 0;
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--text-primary, #0f172a);
        }
        .attention-item-sub {
          margin: 4px 0 0 0;
          font-size: 0.78rem;
          color: var(--text-secondary, #64748b);
        }
        @media (max-width: 960px) {
          .analytics-two-col-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
