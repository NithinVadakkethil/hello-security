'use client';

import { Building2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/auth-store';
import { apiClient } from '../../lib/axios';

export default function CentralProfilePage() {
  const { user } = useAuthStore();
  const [assignedClients, setAssignedClients] = useState<any[]>([]);

  useEffect(() => {
    async function fetchAssigned() {
      try {
        const res: any = await apiClient.get('/central-manager/organizations');
        const list = res?.data || (Array.isArray(res) ? res : []);
        setAssignedClients(list);
      } catch (e) {
        // silent fallback
      }
    }
    fetchAssigned();
  }, []);

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
          Central Manager Profile
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
          Global login identity & multi-organization assignments.
        </p>
      </div>

      <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#2563EB',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: '800',
            }}
          >
            {user?.email?.substring(0, 2).toUpperCase() || 'CM'}
          </div>

          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
              {user?.email}
            </h2>
            <span className="badge badge-info" style={{ marginTop: '4px', fontSize: '11px', fontWeight: '800' }}>
              CENTRALIZED MANAGER (READ-ONLY)
            </span>
          </div>
        </div>

        <hr style={{ borderColor: 'var(--border-color)', margin: 0 }} />

        <div>
          <h3 style={{ fontSize: '14px', fontWeight: '800', marginBottom: '10px' }}>
            Assigned Client Admin Organizations ({assignedClients.length})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {assignedClients.map((c: any) => (
              <div
                key={c.id}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <Building2 size={16} color="#2563EB" />
                <span style={{ fontSize: '13px', fontWeight: '700' }}>{c.companyName}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                  Code: {c.clientCode}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
