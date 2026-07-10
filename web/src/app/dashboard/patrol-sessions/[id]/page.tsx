'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Clock, Shield, CheckCircle2, Play, Pause, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

import { apiClient } from '../../../lib/axios';
import { ApiResponse } from '../../../types/api';
import StatusChip from '../../../components/ui/StatusChip';
import Modal from '../../../components/ui/Modal';

interface Gate {
  id: string;
  name: string;
  gateCode: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface RouteGate {
  id: string;
  sequence: number;
  expectedDuration?: number | null;
  gate: Gate;
}

interface CheckpointScan {
  id: string;
  gateId: string;
  latitude?: number | null;
  longitude?: number | null;
  remarks?: string | null;
  scannedAt: string;
  gate: Gate;
}

interface PatrolSession {
  id: string;
  patrolCode: string;
  status: 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  startedAt: string;
  endedAt?: string | null;
  totalDuration?: number | null;
  remarks?: string | null;
  createdAt: string;
  assignment: {
    employee: {
      firstName: string;
      lastName: string;
      employeeNumber: string;
    };
    site: {
      name: string;
      address?: string | null;
    };
    shift: {
      name: string;
      startTime: string;
      endTime: string;
    };
    patrolRoute: {
      name: string;
      description?: string | null;
      routeGates: RouteGate[];
    };
  };
  checkpoints: CheckpointScan[];
}

export default function PatrolSessionDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();

  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [completeRemarks, setCompleteRemarks] = useState('');

  // Fetch Patrol Session details
  const { data: sessionRes, isLoading, isError } = useQuery<ApiResponse<PatrolSession>>({
    queryKey: ['patrol-session', id],
    queryFn: () => apiClient.get(`/patrol-sessions/${id}`),
    refetchInterval: (query: any) => {
      const status = query?.state?.data?.data?.status;
      return status === 'IN_PROGRESS' ? 5000 : false; // Poll every 5s if active
    },
  });

  const session = sessionRes?.data;

  // Pause mutation
  const pauseMutation = useMutation({
    mutationFn: () => apiClient.post(`/patrol-sessions/${id}/pause`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patrol-session', id] });
      toast.success('Patrol session paused.');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to pause session.');
    },
  });

  // Resume mutation
  const resumeMutation = useMutation({
    mutationFn: () => apiClient.post(`/patrol-sessions/${id}/resume`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patrol-session', id] });
      toast.success('Patrol session resumed.');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to resume session.');
    },
  });

  // Complete mutation
  const completeMutation = useMutation({
    mutationFn: (remarks: string) => apiClient.post(`/patrol-sessions/${id}/complete`, { remarks }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patrol-session', id] });
      toast.success('Patrol session completed successfully.');
      setIsCompleteModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to complete session.');
    },
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
        <RefreshCw className="spin-animation" size={32} />
      </div>
    );
  }

  if (isError || !session) {
    return (
      <div className="error-panel glass-card" style={{ maxWidth: '600px', margin: '50px auto' }}>
        <h3>Patrol Session Log Not Found</h3>
        <p>The requested patrol log could not be loaded.</p>
        <Link href="/dashboard/patrol-sessions" className="btn btn-primary" style={{ marginTop: '16px', textDecoration: 'none' }}>
          Back to Sessions
        </Link>
      </div>
    );
  }

  const routeGates = session.assignment?.patrolRoute?.routeGates || [];
  const scans = session.checkpoints || [];

  // Map route gates to their scan status
  const checkpointsTimeline = routeGates
    .sort((a, b) => a.sequence - b.sequence)
    .map((rg) => {
      const scan = scans.find((s) => s.gateId === rg.gate.id);
      return {
        sequence: rg.sequence,
        expectedDuration: rg.expectedDuration,
        gate: rg.gate,
        scanned: !!scan,
        scannedAt: scan?.scannedAt,
        remarks: scan?.remarks,
        scanCoords: scan?.latitude && scan?.longitude ? `${scan.latitude.toFixed(5)}, ${scan.longitude.toFixed(5)}` : null,
      };
    });

  const completionPercentage = Math.round(
    (checkpointsTimeline.filter((c) => c.scanned).length / Math.max(1, checkpointsTimeline.length)) * 100
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Back button */}
      <div>
        <Link
          href="/dashboard/patrol-sessions"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: 'var(--text-secondary)', fontWeight: 500 }}
        >
          <ArrowLeft size={16} />
          <span>Back to Monitoring Feed</span>
        </Link>
      </div>

      {/* Header Info */}
      <div className="glass-card" style={{ padding: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            PATROL LOG ID: {session.patrolCode}
          </span>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '4px 0 8px 0' }}>
            {session.assignment.employee.firstName} {session.assignment.employee.lastName}
          </h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <StatusChip status={session.status} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)' }}>
              {completionPercentage}% Scanned
            </span>
          </div>
        </div>

        {/* Action Controls for Live Patrols */}
        {(session.status === 'IN_PROGRESS' || session.status === 'PAUSED') && (
          <div style={{ display: 'flex', gap: '12px' }}>
            {session.status === 'IN_PROGRESS' ? (
              <button
                onClick={() => pauseMutation.mutate()}
                className="btn btn-secondary"
                style={{ gap: '6px' }}
                disabled={pauseMutation.isPending}
              >
                <Pause size={14} />
                <span>Pause Patrol</span>
              </button>
            ) : (
              <button
                onClick={() => resumeMutation.mutate()}
                className="btn btn-primary"
                style={{ gap: '6px' }}
                disabled={resumeMutation.isPending}
              >
                <Play size={14} />
                <span>Resume Patrol</span>
              </button>
            )}

            <button
              onClick={() => setIsCompleteModalOpen(true)}
              className="btn btn-primary"
              style={{ gap: '6px', background: 'var(--success)', border: 'none' }}
            >
              <CheckCircle2 size={14} />
              <span>Complete Session</span>
            </button>
          </div>
        )}
      </div>

      {/* Grid Info */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
        {/* Left Side: Checkpoint timeline */}
        <div className="glass-card" style={{ padding: '28px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '24px' }}>Guard Checkpoint Timeline Scan Logs</h3>

          {checkpointsTimeline.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '20px 0' }}>
              No gates defined for this route.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', paddingLeft: '24px' }}>
              {/* Vertical Line */}
              <div
                style={{
                  position: 'absolute',
                  left: '7px',
                  top: '12px',
                  bottom: '12px',
                  width: '2px',
                  background: 'var(--border-color)',
                  zIndex: 0,
                }}
              ></div>

              {checkpointsTimeline.map((item, index) => (
                <div key={item.gate.id} style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 1 }}>
                  {/* Dot */}
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      background: item.scanned ? 'var(--success)' : 'var(--border-color)',
                      border: '4px solid var(--bg-primary)',
                      boxShadow: item.scanned ? '0 0 8px rgba(var(--success-rgb), 0.5)' : 'none',
                      marginTop: '14px',
                      marginLeft: '-23px',
                    }}
                  ></div>

                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: item.scanned ? 'var(--bg-primary)' : 'var(--bg-tertiary)',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${item.scanned ? 'var(--success)' : 'var(--border-color)'}30`,
                      opacity: item.scanned ? 1 : 0.7,
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: item.scanned ? 'var(--success)' : 'var(--text-muted)' }}>
                        Seq {item.sequence} - {item.scanned ? 'SCANNED' : 'PENDING'}
                      </span>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '2px 0' }}>{item.gate.name}</h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, fontFamily: 'monospace' }}>
                        GATE CODE: {item.gate.gateCode}
                      </p>
                      {item.remarks && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: '4px', margin: '4px 0 0 0' }}>
                          📝 Remarks: {item.remarks}
                        </p>
                      )}
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      {item.scanned ? (
                        <>
                          <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>
                            {new Date(item.scannedAt!).toLocaleTimeString()}
                          </p>
                          {item.scanCoords && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              GPS: {item.scanCoords}
                            </span>
                          )}
                        </>
                      ) : (
                        <em style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Unscanned</em>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Quick Stats summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} style={{ color: 'var(--text-muted)' }} />
              <span>Patrol Timings</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>STARTED AT</p>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>
                  {new Date(session.startedAt).toLocaleString()}
                </p>
              </div>

              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>ENDED AT</p>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>
                  {session.endedAt ? new Date(session.endedAt).toLocaleString() : 'Active monitoring'}
                </p>
              </div>

              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>ELAPSED DURATION</p>
                <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                  {session.totalDuration ? `${session.totalDuration} minutes` : 'In progress'}
                </p>
              </div>

              {session.remarks && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>PATROL NOTES / REMARKS</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic', lineHeight: 1.5 }}>
                    "{session.remarks}"
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={18} style={{ color: 'var(--text-muted)' }} />
              <span>Assignment Context</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>MONITORED SITE</p>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>{session.assignment.site.name}</p>
              </div>

              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>SHIFT RANGE</p>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>{session.assignment.shift.name}</p>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  ({session.assignment.shift.startTime} - {session.assignment.shift.endTime})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* COMPLETE PATROL MODAL */}
      <Modal
        isOpen={isCompleteModalOpen}
        onClose={() => setIsCompleteModalOpen(false)}
        title="Complete Guard Patrol Session"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
            Submit final remarks or notes to conclude this patrol session:
          </p>

          <textarea
            value={completeRemarks}
            onChange={(e) => setCompleteRemarks(e.target.value)}
            className="form-input"
            style={{ minHeight: '100px', resize: 'vertical' }}
            placeholder="Write final handover remarks, incident summary, etc."
          />

          <div style={{ display: 'flex', justifySelf: 'flex-end', gap: '12px', marginTop: '8px' }}>
            <button onClick={() => setIsCompleteModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button
              onClick={() => completeMutation.mutate(completeRemarks)}
              className="btn btn-primary"
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending ? 'Completing patrol...' : 'Complete Patrol'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
