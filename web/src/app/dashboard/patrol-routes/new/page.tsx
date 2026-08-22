'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Shield, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

import { apiClient } from '../../../lib/axios';
import { ApiResponse } from '../../../types/api';

interface Gate {
  id: string;
  gateCode: string;
  name: string;
  sequence: number;
}

interface SelectedCheckpoint {
  gateId: string;
  name: string;
  gateCode: string;
  expectedDuration: number;
}

export default function NewPatrolRoutePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  
  // Selected checkpoints timeline
  const [checkpoints, setCheckpoints] = useState<SelectedCheckpoint[]>([]);

  // Query active Sites list for dropdown
  const { data: sitesRes } = useQuery<ApiResponse<{ id: string; name: string }[]>>({
    queryKey: ['sites-dropdown'],
    queryFn: () => apiClient.get('/sites'),
  });

  const sitesList = (sitesRes?.data || []).filter((s) => s.id);

  // Query Gates for selected site
  const { data: gatesRes, isLoading: isGatesLoading } = useQuery<ApiResponse<Gate[]>>({
    queryKey: ['gates', selectedSiteId],
    queryFn: () => apiClient.get('/gates', { params: { siteId: selectedSiteId } }),
    enabled: !!selectedSiteId,
  });

  const siteGates = gatesRes?.data || [];

  // Reset checkpoints when site changes
  useEffect(() => {
    setCheckpoints([]);
  }, [selectedSiteId]);

  const handleAddGate = (gate: Gate) => {
    // Check if gate is already added
    if (checkpoints.some((c) => c.gateId === gate.id)) {
      toast.error('Gate checkpoint is already in the sequence.');
      return;
    }

    setCheckpoints((prev) => [
      ...prev,
      {
        gateId: gate.id,
        name: gate.name,
        gateCode: gate.gateCode,
        expectedDuration: 5, // default 5 mins
      },
    ]);
  };

  const handleRemoveGate = (index: number) => {
    setCheckpoints((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === checkpoints.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newCheckpoints = [...checkpoints];
    const temp = newCheckpoints[index];
    newCheckpoints[index] = newCheckpoints[targetIndex];
    newCheckpoints[targetIndex] = temp;
    setCheckpoints(newCheckpoints);
  };

  const handleDurationChange = (index: number, val: string) => {
    const num = Math.max(1, parseInt(val) || 0);
    const newCheckpoints = [...checkpoints];
    newCheckpoints[index].expectedDuration = num;
    setCheckpoints(newCheckpoints);
  };

  // Create Route Mutation
  const createRouteMutation = useMutation({
    mutationFn: (payload: any) => apiClient.post('/patrol-routes', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patrol-routes'] });
      toast.success('Patrol route successfully configured!');
      router.push('/dashboard/patrol-routes');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create patrol route.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Route name is required.');
      return;
    }
    if (!selectedSiteId) {
      toast.error('Please select a monitored site.');
      return;
    }
    if (checkpoints.length === 0) {
      toast.error('Please add at least one checkpoint gate to the route.');
      return;
    }

    // Map to API shape: checkpoints is array of { gateId, sequence, expectedDuration }
    const mappedCheckpoints = checkpoints.map((c, index) => ({
      gateId: c.gateId,
      sequence: index + 1,
      expectedDuration: c.expectedDuration,
    }));

    createRouteMutation.mutate({
      siteId: selectedSiteId,
      name,
      description: description || undefined,
      checkpoints: mappedCheckpoints,
    });
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link
          href="/dashboard/patrol-routes"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: 'var(--text-secondary)', fontWeight: 500 }}
        >
          <ArrowLeft size={16} />
          <span>Back to Routes</span>
        </Link>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Step 1: General Info */}
        <div className="glass-card" style={{ padding: '28px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={20} className="text-primary" />
            <span>Configure Patrol Route</span>
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px' }}>
            <div>
              <label className="form-label">Route Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Warehouse A Night Scan"
                className="form-input"
                required
              />
            </div>

            <div>
              <label className="form-label">Assigned Site Location</label>
              <select
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                className="form-input"
                required
              >
                <option value="">-- Select Monitored Site --</option>
                {sitesList.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Route Description / Guard Checklist</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Ensure all warehouse entry gates are scanned. Watch for fire hazards."
              className="form-input"
              style={{ minHeight: '80px', resize: 'vertical' }}
            />
          </div>
        </div>

        {/* Step 2: Gate Checkpoint Builder */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '32px' }}>
          {/* Left panel: Site gates list */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h4 style={{ fontWeight: 600, margin: '0 0 16px 0', fontSize: '1rem' }}>1. Available Checkpoints</h4>

            {!selectedSiteId ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '40px 0' }}>
                Select a site first to load gate checkpoints.
              </p>
            ) : isGatesLoading ? (
              <p style={{ fontSize: '0.85rem', textAlign: 'center', padding: '40px 0' }}>Loading site gates...</p>
            ) : siteGates.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '40px 0' }}>
                No gates found in this site. Add gates in the Sites module first.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                {siteGates.map((gate) => {
                  const added = checkpoints.some((c) => c.gateId === gate.id);
                  return (
                    <div
                      key={gate.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-color)',
                        opacity: added ? 0.6 : 1,
                      }}
                    >
                      <div>
                        <p style={{ fontWeight: 600, fontSize: '0.85rem', margin: 0 }}>{gate.name}</p>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {gate.gateCode}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddGate(gate)}
                        disabled={added}
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.75rem', height: '28px' }}
                      >
                        Add
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right panel: Active Route Checkpoints sequence */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h4 style={{ fontWeight: 600, margin: '0 0 16px 0', fontSize: '1rem' }}>2. Checkpoint Scan Sequence</h4>

            {checkpoints.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                <Plus size={36} style={{ marginBottom: '8px' }} />
                <p style={{ fontSize: '0.85rem', margin: 0 }}>Click "Add" on available checkpoints to build your scan path.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {checkpoints.map((checkpoint, index) => (
                  <div
                    key={checkpoint.gateId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '12px 16px',
                      background: 'var(--bg-tertiary)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--primary)' }}>
                        Seq {index + 1}
                      </span>
                    </div>

                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, fontSize: '0.85rem', margin: 0 }}>{checkpoint.name}</p>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {checkpoint.gateCode}
                      </span>
                    </div>

                    <div style={{ width: '120px' }}>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                        Interval (mins)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={checkpoint.expectedDuration}
                        onChange={(e) => handleDurationChange(index, e.target.value)}
                        className="form-input"
                        style={{ height: '32px', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => handleMove(index, 'up')}
                        disabled={index === 0}
                        className="btn btn-secondary"
                        style={{ padding: '6px', height: '32px' }}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(index, 'down')}
                        disabled={index === checkpoints.length - 1}
                        className="btn btn-secondary"
                        style={{ padding: '6px', height: '32px' }}
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveGate(index)}
                        className="btn btn-secondary"
                        style={{ padding: '6px', height: '32px', color: 'var(--danger)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 600 }}
          disabled={createRouteMutation.isPending}
        >
          {createRouteMutation.isPending ? 'Saving Patrol Route Configurations...' : 'Register Patrol Route'}
        </button>
      </form>
    </div>
  );
}
