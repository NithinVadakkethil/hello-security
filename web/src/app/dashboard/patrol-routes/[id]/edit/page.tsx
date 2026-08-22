'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  ArrowLeft,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Search,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

import { apiClient } from '../../../../lib/axios';
import { ApiResponse } from '../../../../types/api';
import { Switch } from '../../../../components/ui/FormControls';
import LoadingState from '../../../../components/ui/LoadingState';
import Modal from '../../../../components/ui/Modal';
import ConfirmationDialog from '../../../../components/ui/ConfirmationDialog';

interface Gate {
  id: string;
  name: string;
  gateCode: string;
  isActive: boolean;
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

interface ConfiguredCheckpoint {
  gateId: string;
  gateName: string;
  gateCode: string;
  expectedDuration: number;
}

export default function EditPatrolRoutePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [checkpoints, setCheckpoints] = useState<ConfiguredCheckpoint[]>([]);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedGateToAdd, setSelectedGateToAdd] = useState<Gate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    gateId: string;
    gateName: string;
    gateCode: string;
  }>({
    isOpen: false,
    gateId: '',
    gateName: '',
    gateCode: '',
  });

  // Fetch current route details
  const { data: routeRes, isLoading: isRouteLoading } = useQuery<ApiResponse<PatrolRoute>>({
    queryKey: ['patrol-route', id],
    queryFn: () => apiClient.get(`/patrol-routes/${id}`),
  });

  const route = routeRes?.data;

  // Fetch all available gates for this site
  const { data: gatesRes, isLoading: isGatesLoading } = useQuery<ApiResponse<Gate[]>>({
    queryKey: ['gates', route?.siteId],
    queryFn: () => apiClient.get('/gates', { params: { siteId: route?.siteId } }),
    enabled: !!route?.siteId,
  });

  const siteGates = gatesRes?.data || [];

  useEffect(() => {
    if (route) {
      setName(route.name);
      setDescription(route.description || '');
      setIsActive(route.isActive);
      if (route.routeGates) {
        const sorted = [...route.routeGates].sort((a, b) => a.sequence - b.sequence);
        setCheckpoints(
          sorted.map((rg) => ({
            gateId: rg.gate.id,
            gateName: rg.gate.name,
            gateCode: rg.gate.gateCode,
            expectedDuration: rg.expectedDuration || 5,
          }))
        );
      }
    }
  }, [route]);

  const updateRouteMutation = useMutation({
    mutationFn: (payload: any) => apiClient.patch(`/patrol-routes/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patrol-route', id] });
      queryClient.invalidateQueries({ queryKey: ['patrol-routes'] });
      toast.success('Patrol route updated successfully.');
      router.push(`/dashboard/patrol-routes/${id}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Unable to update patrol route. Please try again.');
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
      checkpoints: checkpoints.map((cp, idx) => ({
        gateId: cp.gateId,
        sequence: idx + 1,
        expectedDuration: cp.expectedDuration,
      })),
    });
  };

  // Reordering helpers
  const moveUp = (index: number) => {
    if (index <= 0) return;
    const updated = [...checkpoints];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    setCheckpoints(updated);
  };

  const moveDown = (index: number) => {
    if (index >= checkpoints.length - 1) return;
    const updated = [...checkpoints];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    setCheckpoints(updated);
  };

  // Add Checkpoint handlers
  const handleOpenAddModal = () => {
    setSelectedGateToAdd(null);
    setSearchQuery('');
    setIsAddModalOpen(true);
  };

  const handleConfirmAddGate = () => {
    if (!selectedGateToAdd) {
      toast.error('Please select a checkpoint to add.');
      return;
    }
    setCheckpoints((prev) => [
      ...prev,
      {
        gateId: selectedGateToAdd.id,
        gateName: selectedGateToAdd.name,
        gateCode: selectedGateToAdd.gateCode,
        expectedDuration: 5,
      },
    ]);
    setIsAddModalOpen(false);
    setSelectedGateToAdd(null);
    toast.success(`Added "${selectedGateToAdd.name}" to route.`);
  };

  // Remove Checkpoint handler
  const handleConfirmRemoveGate = () => {
    setCheckpoints((prev) => prev.filter((cp) => cp.gateId !== confirmDelete.gateId));
    toast.success(`Removed "${confirmDelete.gateName}" from route.`);
    setConfirmDelete((prev) => ({ ...prev, isOpen: false }));
  };

  // Available gates filter (must belong to site and not already added to route)
  const availableGates = siteGates.filter(
    (g) => g.isActive && !checkpoints.some((cp) => cp.gateId === g.id)
  );

  const filteredAvailableGates = availableGates.filter(
    (g) =>
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.gateCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isRouteLoading) {
    return <LoadingState message="Loading route configuration..." variant="page" />;
  }

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', paddingBottom: '60px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link
          href={`/dashboard/patrol-routes/${id}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
            color: 'var(--text-secondary)',
            fontWeight: 500,
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Route Details</span>
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Main Specifications Form */}
        <div className="glass-card" style={{ padding: '32px' }}>
          <h3
            style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Shield size={20} className="text-primary" />
            <span>Modify Patrol Route Specifications</span>
          </h3>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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

            <div style={{ margin: '4px 0' }}>
              <Switch
                label="Patrol Route Active State"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
            </div>

            {/* Configured Checkpoints / Gates Sequence Section */}
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h4 style={{ fontWeight: 600, margin: 0, fontSize: '1.05rem' }}>
                    Configured Checkpoints / Gates Sequence
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                    Add, remove, or reorder checkpoints for this route. Sequence is saved atomically.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="btn btn-secondary"
                  style={{ gap: '6px', fontSize: '0.85rem' }}
                >
                  <Plus size={16} />
                  <span>Add Checkpoint</span>
                </button>
              </div>

              {checkpoints.length === 0 ? (
                <div
                  style={{
                    padding: '32px',
                    textAlign: 'center',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px dashed var(--border-color)',
                    color: 'var(--text-muted)',
                  }}
                >
                  No checkpoints configured for this route. Click "+ Add Checkpoint" to add one.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {checkpoints.map((cp, idx) => (
                    <div
                      key={cp.gateId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        padding: '12px 16px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      {/* Sequence Badge */}
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          color: 'var(--primary)',
                          background: 'rgba(59, 130, 246, 0.12)',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          minWidth: '54px',
                          textAlign: 'center',
                        }}
                      >
                        Seq {idx + 1}
                      </span>

                      {/* Checkpoint Details */}
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 600, fontSize: '0.88rem', margin: 0 }}>
                          {cp.gateName}
                        </p>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {cp.gateCode}
                        </span>
                      </div>

                      {/* Expected Interval */}
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Interval: {cp.expectedDuration} mins
                      </span>

                      {/* Reorder Buttons */}
                      <div style={{ display: 'flex', gap: '2px' }}>
                        <button
                          type="button"
                          onClick={() => moveUp(idx)}
                          disabled={idx === 0}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: idx === 0 ? 'not-allowed' : 'pointer',
                            opacity: idx === 0 ? 0.3 : 0.8,
                            padding: '4px',
                            color: 'var(--text-primary)',
                          }}
                          title="Move Up"
                        >
                          <ChevronUp size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveDown(idx)}
                          disabled={idx === checkpoints.length - 1}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: idx === checkpoints.length - 1 ? 'not-allowed' : 'pointer',
                            opacity: idx === checkpoints.length - 1 ? 0.3 : 0.8,
                            padding: '4px',
                            color: 'var(--text-primary)',
                          }}
                          title="Move Down"
                        >
                          <ChevronDown size={18} />
                        </button>
                      </div>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDelete({
                            isOpen: true,
                            gateId: cp.gateId,
                            gateName: cp.gateName,
                            gateCode: cp.gateCode,
                          })
                        }
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--danger)',
                          padding: '6px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Remove Checkpoint"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Save Settings Button */}
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '16px', padding: '12px' }}
              disabled={updateRouteMutation.isPending}
            >
              {updateRouteMutation.isPending ? 'Saving configurations...' : 'Save Settings'}
            </button>
          </form>
        </div>
      </div>

      {/* Add Checkpoint Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Checkpoint to Route"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Select an active checkpoint registered under <strong>{route?.site?.name}</strong> to include in this route.
          </p>

          {/* Search Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
            }}
          >
            <Search size={16} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search checkpoint..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                width: '100%',
                fontSize: '0.85rem',
              }}
            />
          </div>

          {/* Gates List */}
          <div
            style={{
              maxHeight: '220px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              paddingRight: '4px',
            }}
          >
            {isGatesLoading ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                Loading checkpoints...
              </div>
            ) : filteredAvailableGates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {availableGates.length === 0
                  ? 'No available checkpoints for this site.'
                  : 'No checkpoints match your search.'}
              </div>
            ) : (
              filteredAvailableGates.map((gate) => {
                const isSelected = selectedGateToAdd?.id === gate.id;
                return (
                  <div
                    key={gate.id}
                    onClick={() => setSelectedGateToAdd(gate)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      border: isSelected
                        ? '1px solid var(--primary)'
                        : '1px solid var(--border-color)',
                      background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-tertiary)',
                      cursor: 'pointer',
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.88rem' }}>{gate.name}</p>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {gate.gateCode}
                      </span>
                    </div>
                    {isSelected && <CheckCircle2 size={18} style={{ color: 'var(--primary)' }} />}
                  </div>
                );
              })
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmAddGate}
              disabled={!selectedGateToAdd}
            >
              Add Checkpoint
            </button>
          </div>
        </div>
      </Modal>

      {/* Remove Checkpoint Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmRemoveGate}
        title="Remove Checkpoint?"
        description={`Are you sure you want to remove "${confirmDelete.gateName}" (${confirmDelete.gateCode}) from this patrol route?\n\nThis will update the route configuration for users assigned to this route.`}
        confirmText="Remove Checkpoint"
        isDanger={true}
      />
    </div>
  );
}
