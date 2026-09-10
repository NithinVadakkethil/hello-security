'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiClient } from '../../../lib/axios';

export default function CentralClientDetailPage() {
  const params = useParams();
  const clientId = params.id as string;

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchClientDetail() {
      setIsLoading(true);
      try {
        const res = await apiClient.get(`/central-manager/clients/${clientId}/dashboard`);
        setData(res.data?.data || null);
      } catch (err: any) {
        toast.error(err?.response?.data?.error?.message || 'Access denied or property not found.');
      } finally {
        setIsLoading(false);
      }
    }
    if (clientId) fetchClientDetail();
  }, [clientId]);

  const client = data?.client || {};
  const metrics = data?.metrics || {};
  const recentPatrols = data?.recentPatrols || [];
  const recentSnags = data?.recentSnags || [];

  if (isLoading) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
        <p>Loading client dashboard...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Link href="/central/clients" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: '#2563EB', textDecoration: 'none' }}>
        <ArrowLeft size={16} />
        <span>Back to Assigned Properties</span>
      </Link>

      {/* HEADER BANNER */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ height: '140px', position: 'relative', backgroundColor: '#1e293b' }}>
          {client.dashboardImageUrl ? (
            <img src={client.dashboardImageUrl} alt={client.companyName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }} />
          )}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 20px', background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#ffffff', margin: 0 }}>{client.companyName}</h1>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>Code: {client.clientCode} • 📍 {client.address || 'Operations Hub'}</span>
          </div>
        </div>
      </div>

      {/* KPIS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #2563EB' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>SITES</span>
          <p style={{ fontSize: '22px', fontWeight: '800', margin: '4px 0 0 0' }}>{metrics.sitesCount || 0}</p>
        </div>
        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #8b5cf6' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>STAFF</span>
          <p style={{ fontSize: '22px', fontWeight: '800', margin: '4px 0 0 0' }}>{metrics.employeesCount || 0}</p>
        </div>
        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #10b981' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>ACTIVE PATROLS</span>
          <p style={{ fontSize: '22px', fontWeight: '800', margin: '4px 0 0 0', color: '#10b981' }}>{metrics.activePatrolsCount || 0}</p>
        </div>
        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #3b82f6' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>COMPLETED PATROLS</span>
          <p style={{ fontSize: '22px', fontWeight: '800', margin: '4px 0 0 0' }}>{metrics.completedPatrolsCount || 0}</p>
        </div>
        <div className="card" style={{ padding: '16px', borderLeft: '4px solid #ef4444' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>OPEN SNAGS</span>
          <p style={{ fontSize: '22px', fontWeight: '800', margin: '4px 0 0 0', color: '#ef4444' }}>{metrics.openSnagsCount || 0}</p>
        </div>
      </div>

      {/* RECENT ACTIVITY TABLES */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '12px' }}>Recent Patrol Sweeps</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentPatrols.map((p: any) => (
              <div key={p.id} style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                <div>
                  <span style={{ fontWeight: '700' }}>{p.patrolCode}</span>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                    {p.assignment?.employee ? `${p.assignment.employee.firstName} ${p.assignment.employee.lastName || ''}` : p.managerUser?.email || 'Manager'}
                  </p>
                </div>
                <span style={{ fontWeight: '700', color: p.status === 'COMPLETED' ? '#10b981' : '#f59e0b' }}>{p.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '12px' }}>Recent Snags Logged</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentSnags.map((s: any) => (
              <div key={s.id} style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                <div>
                  <span style={{ fontWeight: '700' }}>{s.category}</span>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>{s.site?.name || 'Site'}</p>
                </div>
                <span style={{ fontWeight: '700', color: s.status === 'OPEN' ? '#ef4444' : '#10b981' }}>{s.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
