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

    return (
      <div>
        <div className="welcome-banner">
          <h1>
            Welcome Back, {user?.companyName || user?.name || 'Administrator'}
          </h1>
          <p>System status is secure. Active guard monitoring is online.</p>
        </div>

        {isLoading ? (
          <div className="dashboard-grid">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="glass-card stat-card skeleton-loading"
              ></div>
            ))}
          </div>
        ) : isError ? (
          <div className="error-panel glass-card">
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
        ) : (
          <div className="dashboard-grid">
            <div className="glass-card stat-card hover-effect">
              <div className="stat-icon-wrapper blue">
                <Users size={22} />
              </div>
              <div className="stat-info">
                <p className="stat-label">Active Guard Staff</p>
                <h3 className="stat-value">{counts?.employees ?? 0}</h3>
              </div>
            </div>

            <div className="glass-card stat-card hover-effect">
              <div className="stat-icon-wrapper green">
                <Activity size={22} />
              </div>
              <div className="stat-info">
                <p className="stat-label">Active Patrols</p>
                <h3 className="stat-value">{counts?.activePatrols ?? 0}</h3>
              </div>
            </div>

            <div className="glass-card stat-card hover-effect">
              <div className="stat-icon-wrapper purple">
                <Shield size={22} />
              </div>
              <div className="stat-info">
                <p className="stat-label">Guard Assignments</p>
                <h3 className="stat-value">{counts?.assignments ?? 0}</h3>
              </div>
            </div>

            <div className="glass-card stat-card hover-effect">
              <div className="stat-icon-wrapper orange">
                <MapPin size={22} />
              </div>
              <div className="stat-info">
                <p className="stat-label">Monitored Sites</p>
                <h3 className="stat-value">{counts?.sites ?? 0}</h3>
              </div>
            </div>

            <div className="glass-card stat-card hover-effect">
              <div className="stat-icon-wrapper cyan">
                <Route size={22} />
              </div>
              <div className="stat-info">
                <p className="stat-label">Patrol Routes</p>
                <h3 className="stat-value">{counts?.routes ?? 0}</h3>
              </div>
            </div>

            <div className="glass-card stat-card hover-effect">
              <div className="stat-icon-wrapper gold">
                <Calendar size={22} />
              </div>
              <div className="stat-info">
                <p className="stat-label">Configured Shifts</p>
                <h3 className="stat-value">{counts?.shifts ?? 0}</h3>
              </div>
            </div>
          </div>
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
        <h1>Welcome Back, Super Admin</h1>
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
