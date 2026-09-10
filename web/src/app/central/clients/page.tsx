'use client';

import { ChevronRight, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiClient } from '../../lib/axios';

export default function CentralClientsPage() {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchClients = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/central-manager/dashboard');
      setData(res.data?.data?.propertyCards || []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to load assigned properties.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
            Assigned Properties Directory ({data.length})
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Multi-organization properties overseen by your Central Manager account.
          </p>
        </div>
        <button onClick={fetchClients} disabled={isLoading} className="btn btn-secondary" style={{ gap: '6px' }}>
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '18px' }}>
        {data.map((card: any) => (
          <div key={card.clientId} className="card hover-effect" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {card.clientLogoUrl ? (
                <img src={card.clientLogoUrl} alt="Logo" style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'contain', border: '1px solid var(--border-color)' }} />
              ) : (
                <div style={{ width: '44px', height: '44px', borderRadius: '8px', backgroundColor: '#2563EB', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800' }}>
                  {card.companyName.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                  {card.companyName}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                  Code: {card.clientCode} • 📍 {card.address}
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', backgroundColor: 'var(--bg-tertiary)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Sites</span>
                <p style={{ fontSize: '14px', fontWeight: '800', margin: '2px 0 0 0' }}>{card.sitesCount}</p>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Staff</span>
                <p style={{ fontSize: '14px', fontWeight: '800', margin: '2px 0 0 0' }}>{card.employeesCount}</p>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Compliance</span>
                <p style={{ fontSize: '14px', fontWeight: '800', margin: '2px 0 0 0', color: '#10b981' }}>{card.complianceRate}%</p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#ef4444' }}>
                {card.openSnagsCount} Open Snags
              </span>
              <Link href={`/central/clients/${card.clientId}`} style={{ textDecoration: 'none' }}>
                <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px', gap: '4px' }}>
                  <span>View Details</span>
                  <ChevronRight size={14} />
                </button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
