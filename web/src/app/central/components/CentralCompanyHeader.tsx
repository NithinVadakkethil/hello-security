'use client';

import { ArrowLeft, Building2, ChevronDown } from 'lucide-react';
import React, { useState } from 'react';
import { OrganizationMetric } from './CentralManagerOrganizationSelector';

interface CentralCompanyHeaderProps {
  selectedClientId: string;
  organizations: OrganizationMetric[];
  moduleName: string;
  onBackToOrganizations: () => void;
  onSelectOrganization: (clientId: string) => void;
}

export function CentralCompanyHeader({
  selectedClientId,
  organizations,
  moduleName,
  onBackToOrganizations,
  onSelectOrganization,
}: CentralCompanyHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const currentOrg = organizations.find((o) => o.id === selectedClientId);

  const getInitials = (name?: string) => {
    if (!name) return 'ORG';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        marginBottom: '20px',
        padding: '14px 20px',
        borderRadius: '10px',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={onBackToOrganizations}
          className="btn btn-secondary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            padding: '8px 14px',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={16} />
          <span>All Organizations</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <span>{moduleName}</span>
          <span>/</span>
          <strong style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
            {currentOrg?.companyName || 'Selected Organization'}
          </strong>
        </div>
      </div>

      {/* Compact Organization Switcher */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="btn btn-secondary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '6px 14px',
            fontSize: '13px',
            cursor: 'pointer',
            border: '1px solid #2563EB',
            backgroundColor: 'rgba(37, 99, 235, 0.05)',
          }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '4px',
              backgroundColor: 'rgba(37, 99, 235, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: '800',
              color: '#2563EB',
              overflow: 'hidden',
            }}
          >
            {currentOrg?.clientLogoUrl ? (
              <img src={currentOrg.clientLogoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              getInitials(currentOrg?.companyName)
            )}
          </div>
          <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
            {currentOrg?.companyName || 'Switch Organization'}
          </span>
          <ChevronDown size={14} style={{ color: '#2563EB' }} />
        </button>

        {isOpen && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 6px)',
              zIndex: 100,
              minWidth: '240px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
              padding: '6px 0',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '8px 14px', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Switch Assigned Organization
            </div>
            {organizations.map((org) => {
              const isSelected = org.id === selectedClientId;
              return (
                <div
                  key={org.id}
                  onClick={() => {
                    onSelectOrganization(org.id);
                    setIsOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    fontWeight: isSelected ? '700' : '500',
                    backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                    color: isSelected ? '#2563EB' : 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <Building2 size={16} style={{ color: isSelected ? '#2563EB' : 'var(--text-muted)' }} />
                  <span style={{ flex: 1 }}>{org.companyName}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{org.clientCode}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default CentralCompanyHeader;
