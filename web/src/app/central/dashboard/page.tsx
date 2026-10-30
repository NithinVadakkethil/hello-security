'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  MapPin,
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
import { DEMO_KAIZEN_FEATURES } from '@/config/demo-config';

export default function CentralDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = searchParams?.get('clientId') || '';

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async (targetClientId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (targetClientId || clientId) {
        params.set('clientId', targetClientId || clientId);
      }

      const res: any = await apiClient.get(
        `/central-manager/dashboard${params.toString() ? `?${params.toString()}` : ''}`
      );
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
  }, [clientId]);

  const handleSelectClient = (newClientId: string) => {
    router.push(`/central/dashboard?clientId=${newClientId}`);
  };

  if (isLoading && !dashboardData) {
    return (
      <div className="dashboard-loading-container">
        <RefreshCw className="spin-icon" size={32} />
        <p>Loading Community Manager Executive Dashboard...</p>
        <style>{`
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
        <style>{`
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
    totalCheckpoints: 0,
    totalConfiguredCheckpoints: 0,
    totalCheckpointsScanned: 0,
    totalCheckpointsMissed: 0,
    avgCompliance: 0,
  };

  const clientsList = dashboardData?.clients || [];
  const selectedClient: SelectedClientData | null = dashboardData?.selectedClient || null;

  return (
    <div className="central-dashboard-root">
      {/* Page Header */}
      <div className="dashboard-header-row">
        <div>
          <h1 className="page-header-title">Executive Dashboard</h1>
          <p className="page-header-subtitle">Multi-project operational overview & analytics</p>
        </div>
      </div>

      {/* Global Multi-Company KPI Strip */}
      <div className="global-kpi-strip">
        <button
          type="button"
          onClick={() => router.push('/central/projects')}
          className="global-kpi-card clickable"
          aria-label="View all authorized projects"
        >
          <div className="kpi-icon-badge" style={{ background: 'rgba(37, 99, 235, 0.12)', color: '#2563EB' }}>
            <Building2 size={20} />
          </div>
          <div className="kpi-text-box">
            <span className="global-kpi-value">{global.organizationsCount}</span>
            <span className="global-kpi-label">Total Projects</span>
          </div>
        </button>

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
          onClick={() => router.push('/central/reports')}
          className="global-kpi-card clickable"
          aria-label="View all checkpoints in reports"
        >
          <div className="kpi-icon-badge" style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#8B5CF6' }}>
            <MapPin size={20} />
          </div>
          <div className="kpi-text-box">
            <span className="global-kpi-value">
              {global.totalCheckpoints ?? global.totalConfiguredCheckpoints ?? 0}
            </span>
            <span className="global-kpi-label">Total Checkpoints</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => router.push('/central/reports')}
          className="global-kpi-card clickable"
        >
          <div className="kpi-icon-badge" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10B981' }}>
            <CheckSquare size={20} />
          </div>
          <div className="kpi-text-box">
            <span className="global-kpi-value">{global.totalCheckpointsScanned ?? 0}</span>
            <span className="global-kpi-label">Total Checkpoints Scanned</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => router.push('/central/reports')}
          className="global-kpi-card clickable"
        >
          <div
            className="kpi-icon-badge"
            style={{
              background: (global.totalCheckpointsMissed ?? 0) > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(148, 163, 184, 0.12)',
              color: (global.totalCheckpointsMissed ?? 0) > 0 ? '#EF4444' : '#64748B',
            }}
          >
            <AlertCircle size={20} />
          </div>
          <div className="kpi-text-box">
            <span
              className="global-kpi-value"
              style={{ color: (global.totalCheckpointsMissed ?? 0) > 0 ? '#dc2626' : undefined }}
            >
              {global.totalCheckpointsMissed ?? 0}
            </span>
            <span className="global-kpi-label">Total Checkpoints Missed</span>
          </div>
        </button>

        {DEMO_KAIZEN_FEATURES.observations && (
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
        )}

        {DEMO_KAIZEN_FEATURES.snags && (
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
        )}

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
            <span className="global-kpi-label">Average Compliance</span>
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
          <h3>No Projects Assigned</h3>
          <p>You currently have no assigned projects to manage.</p>
        </div>
      )}

      {/* Snag Analytics Area (if enabled) */}
      {selectedClient && DEMO_KAIZEN_FEATURES.snags && (
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
      )}

      {/* Attention Required Section */}
      {(DEMO_KAIZEN_FEATURES.observations || DEMO_KAIZEN_FEATURES.snags) &&
        selectedClient &&
        selectedClient.attentionRequired &&
        selectedClient.attentionRequired.length > 0 && (
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

      <style>{`
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
        .global-kpi-strip {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
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
        .global-kpi-card.clickable:focus-visible {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
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
      `}</style>
    </div>
  );
}
