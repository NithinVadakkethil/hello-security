'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Shield, ArrowLeft, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

import { apiClient } from '../../../../lib/axios';
import { ApiResponse } from '../../../../types/api';
import { Switch } from '../../../../components/ui/FormControls';

interface Gate {
  id: string;
  name: string;
  gateCode: string;
}

interface RouteGate {
  id: string;
  sequence: number;
  expectedDuration?: number | null;
  gate: Gate;
}

interface PatrolRoute {
  id: string;
  routeCode: string;
  name: string;
  description?: string | null;
  siteId: string;
  isActive: boolean;
  site: { name: string };
  routeGates: RouteGate[];
}

export default function EditPatrolRoutePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Fetch current route details
  const { data: routeRes, isLoading } = useQuery<ApiResponse<PatrolRoute>>({
    queryKey: ['patrol-route', id],
    queryFn: () => apiClient.get(`/patrol-routes/${id}`),
  });

  const route = routeRes?.data;

  useEffect(() => {
    if (route) {
      setName(route.name);
      setDescription(route.description || '');
      setIsActive(route.isActive);
    }
  }, [route]);

  const updateRouteMutation = useMutation({
    mutationFn: (payload: any) => apiClient.patch(`/patrol-routes/${id}`, payload),
    onSuccess: () => {
      toast.success('Patrol route configurations saved!');
      router.push('/dashboard/patrol-routes');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to save route configurations.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Route name is required.');
      return;
    }
    updateRouteMutation.mutate({
      name,
      description: description || null,
      isActive,
    });
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
        <RefreshCw className="spin-animation" size={32} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link
          href={`/dashboard/patrol-routes/${id}`}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: 'var(--text-secondary)', fontWeight: 500 }}
        >
          <ArrowLeft size={16} />
          <span>Back to Route Details</span>
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div className="glass-card" style={{ padding: '32px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={20} className="text-primary" />
            <span>Modify Patrol Route Specifications</span>
          </h3>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <label className="form-label">Route Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="form-label">Assigned Site Location</label>
                <input
                  type="text"
                  value={route?.site?.name || ''}
                  className="form-input"
                  disabled
                  style={{ opacity: 0.7 }}
                />
              </div>
            </div>

            <div>
              <label className="form-label">Route Description / Guard Checklist</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="form-input"
                style={{ minHeight: '80px', resize: 'vertical' }}
              />
            </div>

            <div style={{ margin: '8px 0' }}>
              <Switch
                label="Patrol Route Active State"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '8px' }}
              disabled={updateRouteMutation.isPending}
            >
              {updateRouteMutation.isPending ? 'Saving configurations...' : 'Save Settings'}
            </button>
          </form>
        </div>

        {/* Checkpoint read-only timeline view */}
        <div className="glass-card" style={{ padding: '28px' }}>
          <h4 style={{ fontWeight: 600, margin: '0 0 16px 0', fontSize: '1rem' }}>Configured Gates Sequence (Read-only)</h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            ⚠️ Modification of gate sequence ordering requires creating a new patrol route layout.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {route?.routeGates?.map((rg) => (
              <div
                key={rg.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '12px 16px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  opacity: 0.85,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--primary)' }}>
                  Seq {rg.sequence}
                </span>

                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: '0.85rem', margin: 0 }}>{rg.gate?.name}</p>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {rg.gate?.gateCode}
                  </span>
                </div>

                {rg.expectedDuration && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Interval: {rg.expectedDuration} mins
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
