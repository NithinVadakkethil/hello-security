'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowRight,
  Calendar,
  Clock,
  FileText,
  Lock,
  MapPin,
  Plus,
  Route,
  Shield,
  Users,
} from 'lucide-react';
import Link from 'next/link';

import StatusChip from '../components/ui/StatusChip';
import { apiClient } from '../lib/axios';
import { useAuthStore } from '../store/auth-store';
import { ApiResponse } from '../types/api';

interface DashboardCounts {
  employees: number;
  sites: number;
  gates: number;
  shifts: number;
  routes: number;
  assignments: number;
  activePatrols: number;
}

interface SuperAdminDashboardData {
  totalClients: number;
  activeClients: number;
  trialClients: number;
  expiredClients: number;
  suspendedClients: number;
  recentClients: {
    id: string;
    clientCode: string;
    companyName: string;
    email: string;
    subscriptionStatus: string;
    isActive: boolean;
    createdAt: string;
  }[];
  latestLogs: {
    id: string;
    action: string;
    entity: string;
    createdAt: string;
    user: { email: string };
    client?: { companyName: string } | null;
  }[];
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const { data, isLoading, isError, refetch } = useQuery<
    ApiResponse<any>,
    Error
  >({
    queryKey: ['dashboardData', user?.id],
    queryFn: () => apiClient.get('/dashboard'),
  });

  const dashboardData = data?.data;

  // Render client admin / supervisor portal
  if (!isSuperAdmin) {
    const counts = dashboardData as DashboardCounts;
    const clientBranding = dashboardData?.clientBranding;

    const getUserDisplayName = () => {
      if (user?.companyName) return user.companyName;
      if (user?.client?.companyName) return user.client.companyName;
      if (user?.name) return user.name;
      if (user?.firstName) {
        return `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`;
      }
      if (user?.email) {
        return user.email.split('@')[0];
      }
      return 'Company';
    };

    return (
      <div>
        {/* Top Header Branding Bar */}
        {clientBranding?.clientLogoUrl && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              marginBottom: '16px',
              paddingRight: '4px',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={clientBranding.clientLogoUrl}
              alt={`${getUserDisplayName()} logo`}
              style={{
                maxHeight: '44px',
                maxWidth: '220px',
                objectFit: 'contain',
              }}
            />
          </div>
        )}

        {(() => {
          const imageUrl = clientBranding?.dashboardImageUrl;
          const orientation =
            clientBranding?.dashboardImageOrientation || 'LANDSCAPE';
          const rawFocal = clientBranding?.dashboardImageFocalPosition;
          const focalPosition =
            rawFocal && rawFocal !== 'center' ? rawFocal : 'center 35%';

          const cardStyle: React.CSSProperties = {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: '76px',
            padding: '14px 16px',
            background: 'var(--bg-secondary, #ffffff)',
            borderRadius: '12px',
            border: '1px solid var(--border-color, #e2e8f0)',
            boxShadow: '0 8px 22px rgba(15, 23, 42, 0.15)',
            textDecoration: 'none',
            cursor: 'pointer',
            opacity: 1,
            visibility: 'visible',
            transition: 'transform 180ms ease, box-shadow 180ms ease',
          };

          const labelStyle: React.CSSProperties = {
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--text-secondary, #475569)',
            margin: '0 0 2px 0',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          };

          const valueStyle: React.CSSProperties = {
            fontSize: '1.5rem',
            fontWeight: 800,
            color: 'var(--text-primary, #0f172a)',
            margin: 0,
            lineHeight: 1.1,
          };

          const renderKpiCards = () => (
            <div className="floating-kpi-overlay">
              <Link
                href="/dashboard/employees"
                style={cardStyle}
                className="stat-card-solid hover-effect"
                aria-label="View Active Guard Staff"
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                >
                  <div className="stat-icon-wrapper blue">
                    <Users size={20} />
                  </div>
                  <div className="stat-info">
                    <p style={labelStyle}>Active Staff</p>
                    <h3 style={valueStyle}>{counts?.employees ?? 0}</h3>
                  </div>
                </div>
                <ArrowRight size={16} className="card-arrow" />
              </Link>

              <Link
                href="/dashboard/patrol-sessions"
                style={cardStyle}
                className="stat-card-solid hover-effect"
                aria-label="View Active Patrols"
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                >
                  <div className="stat-icon-wrapper green">
                    <Activity size={20} />
                  </div>
                  <div className="stat-info">
                    <p style={labelStyle}>Active Patrols</p>
                    <h3 style={valueStyle}>{counts?.activePatrols ?? 0}</h3>
                  </div>
                </div>
                <ArrowRight size={16} className="card-arrow" />
              </Link>

              <Link
                href="/dashboard/assignments"
                style={cardStyle}
                className="stat-card-solid hover-effect"
                aria-label="View Guard Assignments"
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                >
                  <div className="stat-icon-wrapper purple">
                    <Shield size={20} />
                  </div>
                  <div className="stat-info">
                    <p style={labelStyle}>Assignments</p>
                    <h3 style={valueStyle}>{counts?.assignments ?? 0}</h3>
                  </div>
                </div>
                <ArrowRight size={16} className="card-arrow" />
              </Link>

              <Link
                href="/dashboard/sites"
                style={cardStyle}
                className="stat-card-solid hover-effect"
                aria-label="View Monitored Sites"
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                >
                  <div className="stat-icon-wrapper orange">
                    <MapPin size={20} />
                  </div>
                  <div className="stat-info">
                    <p style={labelStyle}>Monitored Sites</p>
                    <h3 style={valueStyle}>{counts?.sites ?? 0}</h3>
                  </div>
                </div>
                <ArrowRight size={16} className="card-arrow" />
              </Link>

              <Link
                href="/dashboard/patrol-routes"
                style={cardStyle}
                className="stat-card-solid hover-effect"
                aria-label="View Patrol Routes"
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                >
                  <div className="stat-icon-wrapper cyan">
                    <Route size={20} />
                  </div>
                  <div className="stat-info">
                    <p style={labelStyle}>Patrol Routes</p>
                    <h3 style={valueStyle}>{counts?.routes ?? 0}</h3>
                  </div>
                </div>
                <ArrowRight size={16} className="card-arrow" />
              </Link>

              <Link
                href="/dashboard/shifts"
                style={cardStyle}
                className="stat-card-solid hover-effect"
                aria-label="View Configured Shifts"
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                >
                  <div className="stat-icon-wrapper gold">
                    <Calendar size={20} />
                  </div>
                  <div className="stat-info">
                    <p style={labelStyle}>Configured Shifts</p>
                    <h3 style={valueStyle}>{counts?.shifts ?? 0}</h3>
                  </div>
                </div>
                <ArrowRight size={16} className="card-arrow" />
              </Link>
            </div>
          );

          if (!imageUrl) {
            return (
              <div
                className="welcome-banner hero-large-container"
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  minHeight: '480px',
                  background:
                    'linear-gradient(135deg, var(--primary) 0%, #06b6d4 100%)',
                  boxShadow: '0 12px 36px var(--primary-glow)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '40px 44px 110px 44px',
                  color: '#ffffff',
                  marginTop: '12px',
                }}
              >
                <div
                  style={{ position: 'relative', zIndex: 3, maxWidth: '650px' }}
                >
                  <h1
                    style={{
                      fontSize: '2.3rem',
                      fontWeight: 700,
                      margin: '0 0 8px 0',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {getUserDisplayName()}
                  </h1>
                  <p style={{ fontSize: '1.08rem', margin: 0, opacity: 0.92 }}>
                    System status is secure. Active guard monitoring is online.
                  </p>
                </div>

                {/* Subsurface Bottom Scrim behind KPI overlay */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(to bottom, transparent 45%, rgba(15, 23, 42, 0.12) 70%, rgba(15, 23, 42, 0.28) 100%)',
                    zIndex: 2,
                    pointerEvents: 'none',
                  }}
                />

                {renderKpiCards()}
              </div>
            );
          }

          if (orientation === 'LANDSCAPE') {
            return (
              <div
                className="welcome-banner hero-large-container"
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  minHeight: '480px',
                  background: `linear-gradient(90deg, rgba(14, 20, 55, 0.78) 0%, rgba(14, 20, 55, 0.42) 40%, rgba(14, 20, 55, 0.10) 75%, rgba(14, 20, 55, 0.04) 100%), url(${imageUrl}) ${focalPosition} / cover no-repeat`,
                  boxShadow: '0 12px 36px var(--primary-glow)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '40px 44px 110px 44px',
                  color: '#ffffff',
                  marginTop: '12px',
                }}
              >
                <div
                  style={{ position: 'relative', zIndex: 3, maxWidth: '650px' }}
                >
                  <h1
                    style={{
                      fontSize: '2.3rem',
                      fontWeight: 700,
                      margin: '0 0 8px 0',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {getUserDisplayName()}
                  </h1>
                  <p style={{ fontSize: '1.08rem', margin: 0, opacity: 0.92 }}>
                    System status is secure. Active guard monitoring is online.
                  </p>
                </div>

                {/* Subsurface Bottom Scrim behind KPI overlay */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(to bottom, transparent 45%, rgba(15, 23, 42, 0.12) 70%, rgba(15, 23, 42, 0.28) 100%)',
                    zIndex: 2,
                    pointerEvents: 'none',
                  }}
                />

                {renderKpiCards()}
              </div>
            );
          }

          // Portrait & Square Adaptive Banner with Floating KPI Overlay
          return (
            <div
              className="welcome-banner hero-large-container"
              style={{
                position: 'relative',
                overflow: 'hidden',
                minHeight: '480px',
                borderRadius: 'var(--radius-lg)',
                background: '#0f172a',
                boxShadow: '0 12px 36px var(--primary-glow)',
                color: '#ffffff',
                padding: '40px 44px 110px 44px',
                marginTop: '12px',
              }}
            >
              {/* Smart Blurred Background Layer */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: `url(${imageUrl})`,
                  backgroundPosition: focalPosition,
                  backgroundSize: 'cover',
                  filter: 'blur(36px) brightness(0.42)',
                  transform: 'scale(1.35)',
                  opacity: 0.55,
                  zIndex: 1,
                }}
              />

              {/* Subsurface Bottom Scrim behind KPI overlay */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(to bottom, transparent 45%, rgba(15, 23, 42, 0.12) 70%, rgba(15, 23, 42, 0.28) 100%)',
                  zIndex: 2,
                  pointerEvents: 'none',
                }}
              />

              {/* Upper Section Flex Layout */}
              <div
                style={{
                  position: 'relative',
                  zIndex: 3,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  width: '100%',
                }}
              >
                {/* Left Welcome Content */}
                <div style={{ maxWidth: '600px' }}>
                  <h1
                    style={{
                      margin: '0 0 8px 0',
                      fontSize: '2.3rem',
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {getUserDisplayName()}
                  </h1>
                  <p style={{ margin: 0, fontSize: '1.08rem', opacity: 0.92 }}>
                    System status is secure. Active guard monitoring is online.
                  </p>
                </div>

                {/* Right Building Contained Panel */}
                <div
                  style={{
                    maxHeight: '300px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingRight: '12px',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt={`${getUserDisplayName()} property`}
                    style={{
                      maxHeight: '290px',
                      maxWidth: '360px',
                      objectFit: 'contain',
                      objectPosition: focalPosition,
                      borderRadius: '14px',
                      boxShadow: '0 14px 40px rgba(0, 0, 0, 0.6)',
                      border: '1.5px solid rgba(255, 255, 255, 0.25)',
                    }}
                  />
                </div>
              </div>

              {/* Floating KPI Cards Overlay */}
              {renderKpiCards()}
            </div>
          );
        })()}

        {isLoading ? (
          <div style={{ marginTop: '24px' }} className="dashboard-grid">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="glass-card stat-card skeleton-loading"
              ></div>
            ))}
          </div>
        ) : isError ? (
          <div className="error-panel glass-card" style={{ marginTop: '24px' }}>
            <Lock size={48} className="error-icon" />
            <h3>Failed to load dashboard data</h3>
            <p>There was an error communicating with the security api.</p>
            <button
              onClick={() => refetch()}
              className="btn btn-primary"
              style={{ marginTop: '16px' }}
            >
              Retry Request
            </button>
          </div>
        ) : null}
        <style jsx>{`
          .floating-kpi-overlay {
            position: absolute;
            bottom: 24px;
            left: 24px;
            right: 24px;
            z-index: 10;
            display: grid;
            grid-template-columns: repeat(6, minmax(0, 1fr));
            gap: 14px;
          }
          .stat-card-solid {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            min-height: 76px !important;
            padding: 14px 16px !important;
            background: #ffffff !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            border-radius: 12px !important;
            border: 1px solid #e2e8f0 !important;
            box-shadow: 0 6px 18px rgba(15, 23, 42, 0.12) !important;
            text-decoration: none !important;
            opacity: 1 !important;
            mix-blend-mode: normal !important;
            filter: none !important;
            cursor: pointer !important;
            transition:
              transform 180ms ease,
              box-shadow 180ms ease,
              border-color 180ms ease !important;
          }
          .stat-card-solid .stat-label {
            color: #475569 !important;
            font-size: 0.76rem !important;
            font-weight: 600 !important;
            margin: 0 0 2px 0 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.03em !important;
            text-shadow: none !important;
            opacity: 1 !important;
          }
          .stat-card-solid .stat-value {
            color: #0f172a !important;
            font-size: 1.5rem !important;
            font-weight: 800 !important;
            margin: 0 !important;
            line-height: 1.1 !important;
            text-shadow: none !important;
            opacity: 1 !important;
          }
          .stat-card-solid:hover {
            transform: translateY(-2px) !important;
            background: #ffffff !important;
            border-color: #cbd5e1 !important;
            box-shadow: 0 10px 25px rgba(15, 23, 42, 0.18) !important;
          }
          .card-arrow {
            color: #94a3b8 !important;
            opacity: 1 !important;
            transition:
              transform 180ms ease,
              color 180ms ease !important;
            flex-shrink: 0 !important;
          }
          .stat-card-solid:hover .card-arrow {
            color: #334155 !important;
            transform: translateX(3px) !important;
          }
          :global(html.dark) .stat-card-solid,
          :global([data-theme='dark']) .stat-card-solid {
            background: #1e293b !important;
            border: 1px solid rgba(255, 255, 255, 0.12) !important;
            box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35) !important;
          }
          :global(html.dark) .stat-card-solid .stat-label,
          :global([data-theme='dark']) .stat-card-solid .stat-label {
            color: #94a3b8 !important;
          }
          :global(html.dark) .stat-card-solid .stat-value,
          :global([data-theme='dark']) .stat-card-solid .stat-value {
            color: #ffffff !important;
          }
          :global(html.dark) .stat-card-solid:hover,
          :global([data-theme='dark']) .stat-card-solid:hover {
            background: #334155 !important;
            border-color: rgba(255, 255, 255, 0.25) !important;
          }
          :global(html.dark) .stat-card-solid .card-arrow,
          :global([data-theme='dark']) .stat-card-solid .card-arrow {
            color: #64748b !important;
          }
          :global(html.dark) .stat-card-solid:hover .card-arrow,
          :global([data-theme='dark']) .stat-card-solid:hover .card-arrow {
            color: #cbd5e1 !important;
          }
          .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 24px;
            margin-top: 24px;
          }

          @media (max-width: 1279px) {
            .hero-large-container {
              min-height: 420px !important;
            }
          }
          @media (max-width: 1023px) {
            .hero-large-container {
              min-height: 360px !important;
            }
            .floating-kpi-overlay {
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 12px;
            }
          }
          @media (max-width: 767px) {
            .hero-large-container {
              min-height: auto !important;
              padding: 24px 20px 20px 20px !important;
            }
            .floating-kpi-overlay {
              position: relative !important;
              bottom: 0 !important;
              left: 0 !important;
              right: 0 !important;
              margin-top: 20px;
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }
          .welcome-banner {
            padding: 32px;
            background: linear-gradient(
              135deg,
              var(--primary) 0%,
              #06b6d4 100%
            );
            border-radius: var(--radius-lg);
            color: #ffffff;
            box-shadow: 0 10px 30px var(--primary-glow);
          }
          .welcome-banner h1 {
            font-size: 1.8rem;
            font-weight: 700;
            margin-bottom: 6px;
            letter-spacing: -0.02em;
          }
          .welcome-banner p {
            font-size: 0.95rem;
            opacity: 0.9;
          }
          .stat-card {
            display: flex;
            align-items: center;
            gap: 20px;
            padding: 24px;
          }
          .stat-icon-wrapper {
            width: 48px;
            height: 48px;
            border-radius: var(--radius-sm);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
          }
          .stat-icon-wrapper.blue {
            background: #3b82f6;
          }
          .stat-icon-wrapper.green {
            background: #10b981;
          }
          .stat-icon-wrapper.cyan {
            background: #06b6d4;
          }
          .stat-icon-wrapper.orange {
            background: #f59e0b;
          }
          .stat-icon-wrapper.red {
            background: #ef4444;
          }
          .stat-icon-wrapper.purple {
            background: #8b5cf6;
          }
          .stat-icon-wrapper.gold {
            background: #eab308;
          }

          .stat-info {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .stat-label {
            font-size: 0.85rem;
            color: var(--text-secondary);
            font-weight: 500;
          }
          .stat-value {
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--text-primary);
          }
        `}</style>
      </div>
    );
  }

  // Render Super Admin Portal
  const saData = dashboardData as SuperAdminDashboardData;

  return (
    <div>
      <div className="welcome-banner">
        <h1>Welcome Back, {user?.name || user?.firstName || 'Super Admin'}</h1>
        <p>Enterprise subscription status, audits, and clients are healthy.</p>
      </div>

      {isLoading ? (
        <div className="dashboard-grid">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="glass-card stat-card skeleton-loading"
            ></div>
          ))}
        </div>
      ) : isError ? (
        <div className="error-panel glass-card">
          <Lock size={48} className="error-icon" />
          <h3>Failed to load administrator statistics</h3>
          <p>There was an error communicating with the administration api.</p>
          <button
            onClick={() => refetch()}
            className="btn btn-primary"
            style={{ marginTop: '16px' }}
          >
            Retry Request
          </button>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="dashboard-grid">
            <div className="glass-card stat-card hover-effect">
              <div className="stat-icon-wrapper blue">
                <Shield size={22} />
              </div>
              <div className="stat-info">
                <p className="stat-label">Total Clients</p>
                <h3 className="stat-value">{saData?.totalClients ?? 0}</h3>
              </div>
            </div>

            <div className="glass-card stat-card hover-effect">
              <div className="stat-icon-wrapper green">
                <Activity size={22} />
              </div>
              <div className="stat-info">
                <p className="stat-label">Active Clients</p>
                <h3 className="stat-value">{saData?.activeClients ?? 0}</h3>
              </div>
            </div>

            <div className="glass-card stat-card hover-effect">
              <div className="stat-icon-wrapper cyan">
                <Clock size={22} />
              </div>
              <div className="stat-info">
                <p className="stat-label">Trial Clients</p>
                <h3 className="stat-value">{saData?.trialClients ?? 0}</h3>
              </div>
            </div>

            <div className="glass-card stat-card hover-effect">
              <div className="stat-icon-wrapper orange">
                <Calendar size={22} />
              </div>
              <div className="stat-info">
                <p className="stat-label">Suspended Clients</p>
                <h3 className="stat-value">{saData?.suspendedClients ?? 0}</h3>
              </div>
            </div>

            <div className="glass-card stat-card hover-effect">
              <div className="stat-icon-wrapper red">
                <Lock size={22} />
              </div>
              <div className="stat-info">
                <p className="stat-label">Expired Clients</p>
                <h3 className="stat-value">{saData?.expiredClients ?? 0}</h3>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ marginTop: '32px' }}>
            <h3
              style={{
                fontSize: '1.1rem',
                fontWeight: 600,
                marginBottom: '16px',
              }}
            >
              Quick Actions
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '20px',
              }}
            >
              <Link
                href="/dashboard/clients/new"
                className="glass-card hover-effect action-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '20px',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div
                  style={{
                    padding: '10px',
                    background: 'var(--primary-glow)',
                    color: 'var(--primary)',
                    borderRadius: '8px',
                  }}
                >
                  <Plus size={20} />
                </div>
                <div>
                  <h4 style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                    Create Client
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Provision new company
                  </p>
                </div>
              </Link>

              <Link
                href="/dashboard/users"
                className="glass-card hover-effect action-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '20px',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div
                  style={{
                    padding: '10px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: 'var(--success)',
                    borderRadius: '8px',
                  }}
                >
                  <Users size={20} />
                </div>
                <div>
                  <h4 style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                    Manage Users
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Manage logins & roles
                  </p>
                </div>
              </Link>

              <Link
                href="/dashboard/audit-logs"
                className="glass-card hover-effect action-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '20px',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div
                  style={{
                    padding: '10px',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: 'var(--warning)',
                    borderRadius: '8px',
                  }}
                >
                  <FileText size={20} />
                </div>
                <div>
                  <h4 style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                    Audit Logs
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    View system activities
                  </p>
                </div>
              </Link>
            </div>
          </div>

          {/* Recent Lists Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
              gap: '32px',
              marginTop: '32px',
            }}
          >
            {/* Recent Clients */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '20px',
                }}
              >
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>
                  Recent Clients
                </h3>
                <Link
                  href="/dashboard/clients"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                  }}
                >
                  <span>View All</span>
                  <ArrowRight size={14} />
                </Link>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                {saData?.recentClients?.length === 0 ? (
                  <p
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: '0.9rem',
                      textAlign: 'center',
                      padding: '20px 0',
                    }}
                  >
                    No recent clients found.
                  </p>
                ) : (
                  saData?.recentClients?.map((client) => (
                    <div
                      key={client.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingBottom: '12px',
                        borderBottom: '1px solid var(--border-color)',
                      }}
                    >
                      <div>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                          {client.companyName}
                        </h4>
                        <p
                          style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {client.email} • {client.clientCode}
                        </p>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                      >
                        <StatusChip status={client.subscriptionStatus} />
                        <StatusChip status={client.isActive} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Latest Activity Logs */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '20px',
                }}
              >
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>
                  Recent Audit Activity
                </h3>
                <Link
                  href="/dashboard/audit-logs"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                  }}
                >
                  <span>View All</span>
                  <ArrowRight size={14} />
                </Link>
              </div>

              <div
                className="timeline"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                {saData?.latestLogs?.length === 0 ? (
                  <p
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: '0.9rem',
                      textAlign: 'center',
                      padding: '20px 0',
                    }}
                  >
                    No activity logs available.
                  </p>
                ) : (
                  saData?.latestLogs?.map((log) => (
                    <div key={log.id} style={{ display: 'flex', gap: '12px' }}>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                        }}
                      >
                        <div
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: 'var(--primary)',
                            marginTop: '6px',
                          }}
                        ></div>
                        <div
                          style={{
                            width: '1px',
                            flex: 1,
                            background: 'var(--border-color)',
                            marginTop: '4px',
                          }}
                        ></div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p
                          style={{
                            fontSize: '0.9rem',
                            color: 'var(--text-primary)',
                            margin: 0,
                          }}
                        >
                          <strong>{log.user.email}</strong> performed{' '}
                          <strong>{log.action}</strong> on <em>{log.entity}</em>
                        </p>
                        <p
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            margin: '4px 0 0 0',
                          }}
                        >
                          {new Date(log.createdAt).toLocaleString()}{' '}
                          {log.client
                            ? `• Client: ${log.client.companyName}`
                            : ''}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 24px;
          margin-top: 32px;
        }
        .welcome-banner {
          padding: 32px;
          background: linear-gradient(135deg, var(--primary) 0%, #06b6d4 100%);
          border-radius: var(--radius-lg);
          color: #ffffff;
          box-shadow: 0 10px 30px var(--primary-glow);
        }
        .welcome-banner h1 {
          font-size: 1.8rem;
          font-weight: 700;
          margin-bottom: 6px;
          letter-spacing: -0.02em;
        }
        .welcome-banner p {
          font-size: 0.95rem;
          opacity: 0.9;
        }
        .stat-card {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 24px;
        }
        .stat-icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
        }
        .stat-icon-wrapper.blue {
          background: #3b82f6;
        }
        .stat-icon-wrapper.green {
          background: #10b981;
        }
        .stat-icon-wrapper.cyan {
          background: #06b6d4;
        }
        .stat-icon-wrapper.orange {
          background: #f59e0b;
        }
        .stat-icon-wrapper.red {
          background: #ef4444;
        }
        .stat-icon-wrapper.purple {
          background: #8b5cf6;
        }
        .stat-icon-wrapper.gold {
          background: #eab308;
        }

        .stat-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .stat-label {
          font-size: 0.85rem;
          color: var(--text-secondary);
          font-weight: 500;
        }
        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        .action-card:hover {
          border-color: var(--primary);
        }
      `}</style>
    </div>
  );
}
