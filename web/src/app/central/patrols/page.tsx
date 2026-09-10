'use client';

import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiClient } from '../../lib/axios';

export default function CentralPatrolsPage() {
  const [tab, setTab] = useState<'ACTIVE' | 'COMPLETED'>('ACTIVE');
  const [data, setData] = useState<any[]>([]);
  const [, setIsLoading] = useState(true);

  const fetchPatrols = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get(`/central-manager/patrols?type=${tab}`);
      setData(res.data?.data || []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to fetch patrols.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPatrols();
  }, [tab]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
            Central Patrol Monitoring ({data.length})
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Real-time active patrol monitoring & completed historical sweeps across your assigned organizations.
          </p>
        </div>

        {/* TABS */}
        <div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--bg-tertiary)', padding: '4px', borderRadius: '8px' }}>
          <button
            onClick={() => setTab('ACTIVE')}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '700',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: tab === 'ACTIVE' ? '#2563EB' : 'transparent',
              color: tab === 'ACTIVE' ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Active Patrols
          </button>
          <button
            onClick={() => setTab('COMPLETED')}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '700',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: tab === 'COMPLETED' ? '#2563EB' : 'transparent',
              color: tab === 'COMPLETED' ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Completed Patrols
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table" style={{ width: '100%', fontSize: '13px' }}>
          <thead>
            <tr>
              <th>Patrol Code</th>
              <th>Organization</th>
              <th>Officer / Inspector</th>
              <th>Role</th>
              <th>Site Location</th>
              <th>Route / Target</th>
              <th>Scanned Checkpoints</th>
              <th>Started</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                  No {tab.toLowerCase()} patrols found in assigned organizations.
                </td>
              </tr>
            ) : (
              data.map((p: any) => {
                const empName = p.assignment?.employee
                  ? `${p.assignment.employee.firstName} ${p.assignment.employee.lastName || ''}`
                  : p.managerUser?.email || 'Manager Direct';

                const role = p.assignment?.employee?.role || (p.managerUser ? 'MANAGER' : 'SECURITY');
                const routeName = p.assignment?.patrolRoute?.name || (role === 'MANAGER' ? 'Manager Inspection' : 'Direct Checkpoints');

                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: '800', color: '#2563EB' }}>{p.patrolCode}</td>
                    <td style={{ fontWeight: '600' }}>{p.client?.companyName || 'N/A'}</td>
                    <td style={{ fontWeight: '700' }}>{empName}</td>
                    <td>
                      <span className="badge badge-info" style={{ fontSize: '11px' }}>{role}</span>
                    </td>
                    <td>{p.assignment?.site?.name || 'Assigned Site'}</td>
                    <td>{routeName}</td>
                    <td style={{ textAlign: 'center', fontWeight: '700' }}>{p.checkpoints?.length || 0}</td>
                    <td>{new Date(p.startedAt).toLocaleString()}</td>
                    <td>
                      <span className={`badge ${p.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
