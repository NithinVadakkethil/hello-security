'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Shield, ArrowLeft, Edit, Users, Calendar, MapPin, Route, Mail, Phone, MapPinIcon, Clock, UserCheck } from 'lucide-react';

import { apiClient } from '../../../lib/axios';
import { ApiResponse } from '../../../types/api';
import StatusChip from '../../../components/ui/StatusChip';
import { formatPatrolDate, formatPatrolDateTime } from '../../../../lib/date-formatter';

interface ClientDetail {
  id: string;
  clientCode: string;
  companyName: string;
  email: string;
  authorizedPerson?: string | null;
  phone?: string;
  address?: string;
  subscriptionStatus: string;
  identificationMethod: string;
  maxEmployees: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  users: {
    id: string;
    email: string;
    role: string;
    isActive: boolean;
    lastLogin?: string | null;
    rawPassword?: string | null;
  }[];
  _count: {
    employees: number;
    sites: number;
    shifts: number;
    patrolRoutes: number;
  };
  auditLogs: {
    id: string;
    action: string;
    entity: string;
    createdAt: string;
    user: {
      email: string;
    };
  }[];
}

export default function ClientDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data, isLoading, isError, refetch } = useQuery<ApiResponse<ClientDetail>>({
    queryKey: ['client-details', id],
    queryFn: () => apiClient.get(`/clients/${id}`),
  });

  const client = data?.data;

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="glass-card skeleton-loading" style={{ height: '120px' }}></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card skeleton-loading" style={{ height: '90px' }}></div>
          ))}
        </div>
        <div className="glass-card skeleton-loading" style={{ height: '300px' }}></div>
      </div>
    );
  }

  if (isError || !client) {
    return (
      <div className="error-panel glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h3>Failed to load client details</h3>
        <p>There was an error communicating with the administration api.</p>
        <button onClick={() => refetch()} className="btn btn-primary" style={{ marginTop: '16px' }}>
          Retry Request
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}
      >
        <button
          onClick={() => router.push('/dashboard/clients')}
          className="btn btn-secondary"
          style={{ gap: '8px', display: 'flex', alignItems: 'center' }}
        >
          <ArrowLeft size={16} />
          <span>Back to List</span>
        </button>

        <Link href={`/dashboard/clients/${client.id}/edit`} className="btn btn-primary" style={{ gap: '8px' }}>
          <Edit size={16} />
          <span>Edit Client</span>
        </Link>
      </div>

      {/* Main Header Card */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{client.companyName}</h1>
              <StatusChip status={client.subscriptionStatus} />
              <StatusChip status={client.isActive} />
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0 }}>
              Client Code: <strong>{client.clientCode}</strong> • Provisioned on {formatPatrolDate(client.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Counters */}
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div className="glass-card stat-card">
          <div className="stat-icon-wrapper blue"><Users size={20} /></div>
          <div className="stat-info">
            <p className="stat-label">Employees</p>
            <h3 className="stat-value">{client._count?.employees ?? 0} / {client.maxEmployees}</h3>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon-wrapper orange"><MapPin size={20} /></div>
          <div className="stat-info">
            <p className="stat-label">Monitored Sites</p>
            <h3 className="stat-value">{client._count?.sites ?? 0}</h3>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon-wrapper cyan"><Route size={20} /></div>
          <div className="stat-info">
            <p className="stat-label">Patrol Routes</p>
            <h3 className="stat-value">{client._count?.patrolRoutes ?? 0}</h3>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon-wrapper gold"><Calendar size={20} /></div>
          <div className="stat-info">
            <p className="stat-label">Configured Shifts</p>
            <h3 className="stat-value">{client._count?.shifts ?? 0}</h3>
          </div>
        </div>
      </div>

      {/* Two Column details layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* Left Column - Details & Admins */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Company details */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px' }}>Company Information</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Mail size={16} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Primary Email</p>
                  <p style={{ fontSize: '0.9rem', fontWeight: 500, margin: 0 }}>{client.email}</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <UserCheck size={16} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Authorised Person</p>
                  <p style={{ fontSize: '0.9rem', fontWeight: 500, margin: 0 }}>{client.authorizedPerson || 'N/A'}</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Phone size={16} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Phone Number</p>
                  <p style={{ fontSize: '0.9rem', fontWeight: 500, margin: 0 }}>{client.phone || 'N/A'}</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <MapPinIcon size={16} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Billing Address</p>
                  <p style={{ fontSize: '0.9rem', fontWeight: 500, margin: 0 }}>{client.address || 'N/A'}</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Shield size={16} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Identification Type</p>
                  <p style={{ fontSize: '0.9rem', fontWeight: 500, margin: 0 }}>{client.identificationMethod}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Client Admins */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px' }}>Client Administrators</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {client.users?.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No admin accounts provisioned.</p>
              ) : (
                client.users?.map((usr) => (
                  <div key={usr.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>{usr.email}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                          Last login: {usr.lastLogin ? formatPatrolDateTime(usr.lastLogin, undefined, false) : 'Never'}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', padding: '2px 6px', background: 'var(--border-color)', borderRadius: '4px', fontWeight: 500 }}>
                          {usr.role.replace('_', ' ')}
                        </span>
                        <StatusChip status={usr.isActive} />
                      </div>
                    </div>
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Password:</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text)', background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                        {usr.rawPassword || 'Hidden/Encrypted'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Recent Activity */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} style={{ color: 'var(--text-muted)' }} />
            <span>Recent Activity Log</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {client.auditLogs?.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '40px 0' }}>No recent activity logs recorded.</p>
            ) : (
              client.auditLogs?.map((log) => (
                <div key={log.id} style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', marginTop: '6px' }}></div>
                    <div style={{ width: '1px', flex: 1, background: 'var(--border-color)', marginTop: '4px' }}></div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0 }}>
                      <strong>{log.user.email}</strong> performed <strong>{log.action}</strong> on <em>{log.entity}</em>
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                      {formatPatrolDateTime(log.createdAt, undefined, false)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
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
        .stat-icon-wrapper.blue { background: #3b82f6; }
        .stat-icon-wrapper.orange { background: #f59e0b; }
        .stat-icon-wrapper.cyan { background: #06b6d4; }
        .stat-icon-wrapper.gold { background: #eab308; }
        
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
          font-size: 1.35rem;
          font-weight: 700;
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}
