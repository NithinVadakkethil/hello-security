'use client';

import { Building2, ChevronRight, Users, AlertTriangle, Wrench, FileText } from 'lucide-react';
import React from 'react';

export interface OrganizationMetric {
  id: string;
  companyName: string;
  clientCode: string;
  clientLogoUrl?: string | null;
  dashboardImageUrl?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  metrics: {
    employeesCount: number;
    observations: { open: number; reviewed: number; total: number };
    snags: { open: number; inProgress: number; resolved: number; closed: number; total: number };
    reports: { completedPatrols: number; totalPatrols: number };
  };
}

interface CentralManagerOrganizationSelectorProps {
  moduleName: 'Employees' | 'Observation Reports' | 'Snag List' | 'Reports & Analytics';
  organizations: OrganizationMetric[];
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
  onSelectOrganization: (clientId: string) => void;
}

export function CentralManagerOrganizationSelector({
  moduleName,
  organizations,
  isLoading,
  error,
  onRetry,
  onSelectOrganization,
}: CentralManagerOrganizationSelectorProps) {
  const getInitials = (name: string) => {
    if (!name) return 'ORG';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const getModuleIcon = () => {
    switch (moduleName) {
      case 'Employees':
        return Users;
      case 'Observation Reports':
        return AlertTriangle;
      case 'Snag List':
        return Wrench;
      case 'Reports & Analytics':
        return FileText;
      default:
        return Building2;
    }
  };

  const ModuleIcon = getModuleIcon();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
            Select Organization
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Choose an assigned organization to view its {moduleName.toLowerCase()}.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="card"
              style={{
                height: '180px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-tertiary)',
                opacity: 0.6,
              }}
            >
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Loading organizations...</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="card"
        style={{
          padding: '48px 24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <AlertTriangle size={40} style={{ color: '#dc2626' }} />
        <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
          Unable to Load Assigned Organizations
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, maxWidth: '420px' }}>
          {error || 'Unable to load assigned organizations. Please try again.'}
        </p>
        {onRetry && (
          <button onClick={onRetry} className="btn btn-primary" style={{ marginTop: '8px', fontSize: '13px' }}>
            Retry Loading
          </button>
        )}
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div
        className="card"
        style={{
          padding: '48px 24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <Building2 size={40} style={{ color: 'var(--text-muted)' }} />
        <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
          No Organizations Assigned
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, maxWidth: '420px' }}>
          No active Client Admin organizations are currently assigned to your Centralized Manager account. Please contact Super Admin to assign clients.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ModuleIcon size={22} style={{ color: '#2563EB' }} />
          <span>Select Organization</span>
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
          Choose an organization to view its {moduleName.toLowerCase()}.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
        {organizations.map((org) => {
          return (
            <div
              key={org.id}
              onClick={() => onSelectOrganization(org.id)}
              className="card hover-effect"
              style={{
                padding: '20px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px',
                border: '1px solid var(--border-color)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    border: '1px solid rgba(37, 99, 235, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  {org.clientLogoUrl ? (
                    <img
                      src={org.clientLogoUrl}
                      alt={org.companyName}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }}
                    />
                  ) : (
                    <span style={{ fontSize: '16px', fontWeight: '800', color: '#2563EB' }}>
                      {getInitials(org.companyName)}
                    </span>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3
                    style={{
                      fontSize: '16px',
                      fontWeight: '800',
                      margin: 0,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {org.companyName}
                  </h3>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#2563EB',
                      backgroundColor: 'rgba(37, 99, 235, 0.1)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      display: 'inline-block',
                      marginTop: '4px',
                    }}
                  >
                    {org.clientCode}
                  </span>
                </div>
              </div>

              {/* Module-Specific Metrics */}
              <div
                style={{
                  padding: '14px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {moduleName === 'Employees' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span style={{ fontSize: '22px', fontWeight: '800', color: '#2563EB' }}>
                        {org.metrics.employeesCount}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        Employees
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Active personnel across organization
                    </span>
                  </div>
                )}

                {moduleName === 'Observation Reports' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '22px', fontWeight: '800', color: '#2563EB' }}>
                        {org.metrics.observations.total}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        Total Observations
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="badge badge-warning" style={{ fontSize: '11px' }}>
                        Open: {org.metrics.observations.open}
                      </span>
                      <span className="badge badge-info" style={{ fontSize: '11px' }}>
                        Reviewed: {org.metrics.observations.reviewed}
                      </span>
                    </div>
                  </div>
                )}

                {moduleName === 'Snag List' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '22px', fontWeight: '800', color: '#2563EB' }}>
                        {org.metrics.snags.total}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        Total Snags
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span className="badge badge-danger" style={{ fontSize: '10px' }}>
                        Open: {org.metrics.snags.open}
                      </span>
                      <span className="badge badge-warning" style={{ fontSize: '10px' }}>
                        WIP: {org.metrics.snags.inProgress}
                      </span>
                      <span className="badge badge-success" style={{ fontSize: '10px' }}>
                        Closed: {org.metrics.snags.closed}
                      </span>
                    </div>
                  </div>
                )}

                {moduleName === 'Reports & Analytics' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span style={{ fontSize: '22px', fontWeight: '800', color: '#2563EB' }}>
                        {org.metrics.reports.completedPatrols}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        Completed Patrols
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Total Inspections Logged: {org.metrics.reports.totalPatrols}
                    </span>
                  </div>
                )}
              </div>

              {/* Action */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '8px',
                  borderTop: '1px dashed var(--border-color)',
                  color: '#2563EB',
                  fontSize: '13px',
                  fontWeight: '700',
                }}
              >
                <span>View {moduleName}</span>
                <ChevronRight size={16} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CentralManagerOrganizationSelector;
