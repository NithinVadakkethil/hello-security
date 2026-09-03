'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Pause,
  Play,
  Printer,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import toast from 'react-hot-toast';

import Modal from '../../../components/ui/Modal';
import StatusChip from '../../../components/ui/StatusChip';
import LoadingState from '../../../components/ui/LoadingState';
import { apiClient } from '../../../lib/axios';
import { ApiResponse } from '../../../types/api';
import TaskVerificationChecklist from '../components/TaskVerificationChecklist';
import PatrolSessionPrintTemplate from '../components/PatrolSessionPrintTemplate';

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

interface Incident {
  id: string;
  type: string;
  severity: string;
  description: string;
  images: string[];
  createdAt: string;
  gateId?: string | null;
}

interface CheckpointScan {
  id: string;
  gateId: string;
  latitude?: number | null;
  longitude?: number | null;
  remarks?: string | null;
  status?: string | null;
  images?: string[] | null;
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
    patrolRoute?: {
      name: string;
      description?: string | null;
      routeGates: RouteGate[];
    } | null;
    assignmentGates?: any[];
  };
  checkpoints: CheckpointScan[];
  incidents?: Incident[];
  verificationStatus?: 'PENDING' | 'VERIFIED' | 'NOT_VERIFIED' | null;
  verificationTime?: string | null;
  supervisorRemarks?: string | null;
  verifiedBy?: {
    id: string;
    email: string;
    employee?: {
      firstName: string;
      lastName: string;
    } | null;
  } | null;
}

export default function PatrolSessionDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const queryClient = useQueryClient();

  const queryStr = searchParams.toString();
  const backHref = queryStr
    ? `/dashboard/patrol-sessions?${queryStr}`
    : '/dashboard/patrol-sessions';

  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [completeRemarks, setCompleteRemarks] = useState('');

  // Fetch Patrol Session details
  const {
    data: sessionRes,
    isLoading,
    isError,
  } = useQuery<ApiResponse<PatrolSession>>({
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
    mutationFn: (remarks: string) =>
      apiClient.post(`/patrol-sessions/${id}/complete`, { remarks }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patrol-session', id] });
      toast.success('Patrol session completed successfully.');
      setIsCompleteModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to complete session.');
    },
  });

  const [webSupervisorRemarks, setWebSupervisorRemarks] = useState('');

  // Verify mutation
  const verifyMutation = useMutation({
    mutationFn: (data: {
      verificationStatus: 'VERIFIED' | 'NOT_VERIFIED';
      supervisorRemarks?: string;
    }) => apiClient.patch(`/patrol-sessions/${id}/verify`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patrol-session', id] });
      toast.success('Supervisor verification updated successfully.');
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.message || 'Failed to update verification status.',
      );
    },
  });

  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  if (isLoading) {
    return <LoadingState message="Loading patrol session log..." variant="page" size="md" />;
  }

  if (isError || !session) {
    return (
      <div
        className="error-panel glass-card"
        style={{ maxWidth: '600px', margin: '50px auto' }}
      >
        <h3>Patrol Session Log Not Found</h3>
        <p>The requested patrol log could not be loaded.</p>
        <Link
          href={backHref}
          className="btn btn-primary"
          style={{ marginTop: '16px', textDecoration: 'none' }}
        >
          Back to Sessions
        </Link>
      </div>
    );
  }

  const isDirectAssignment =
    (session.assignment as any)?.assignmentType === 'DIRECT_CHECKPOINTS' ||
    (!session.assignment?.patrolRoute &&
      session.assignment?.assignmentGates &&
      session.assignment.assignmentGates.length > 0);

  const routeGates = isDirectAssignment
    ? (session.assignment?.assignmentGates || []).map((ag: any, idx: number) => ({
        sequence: ag.sequence || idx + 1,
        expectedDuration: null,
        gate: ag.gate,
      }))
    : session.assignment?.patrolRoute?.routeGates || [];
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
        checkpointId: scan?.id,
        scannedAt: scan?.scannedAt,
        remarks: scan?.remarks,
        status: scan?.status,
        images: scan?.images || [],
        subTaskResponses: (scan as any)?.subTaskResponses || [],
        scanCoords:
          scan?.latitude && scan?.longitude
            ? `${scan.latitude.toFixed(5)}, ${scan.longitude.toFixed(5)}`
            : null,
      };
    });

  const completionPercentage = Math.round(
    (checkpointsTimeline.filter((c) => c.scanned).length /
      Math.max(1, checkpointsTimeline.length)) *
      100,
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Back button */}
      <div>
        <Link
          href={backHref}
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
          <span>Back to Monitoring Feed</span>
        </Link>
      </div>

      {/* Header Info */}
      <div
        className="glass-card"
        style={{
          padding: '28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '20px',
        }}
      >
        <div>
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              fontFamily: 'monospace',
            }}
          >
            PATROL LOG ID: {session.patrolCode}
          </span>
          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              margin: '4px 0 8px 0',
            }}
          >
            {session.assignment.employee.firstName}{' '}
            {session.assignment.employee.lastName}
          </h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <StatusChip status={session.status} />
            <span
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--primary)',
              }}
            >
              {completionPercentage}% Scanned
            </span>
          </div>
        </div>

        {/* Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--surface-color)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '8px 16px',
              borderRadius: '8px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
            }}
            title="Print Enterprise A4 Patrol Report or Save as PDF"
          >
            <Printer size={16} style={{ color: 'var(--primary)' }} />
            <span>Print Report (PDF)</span>
          </button>

          {/* Action Controls for Live Patrols */}
          {(session.status === 'IN_PROGRESS' || session.status === 'PAUSED') && (
            <>
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
                style={{
                  gap: '6px',
                  background: 'var(--success)',
                  border: 'none',
                }}
              >
                <CheckCircle2 size={14} />
                <span>Complete Session</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Grid Info */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}
      >
        {/* Left Side: Checkpoint timeline */}
        <div className="glass-card" style={{ padding: '28px' }}>
          <h3
            style={{
              fontSize: '1.15rem',
              fontWeight: 600,
              marginBottom: '24px',
            }}
          >
            Guard Checkpoint Timeline Scan Logs
          </h3>

          {checkpointsTimeline.length === 0 ? (
            <p
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.9rem',
                textAlign: 'center',
                padding: '20px 0',
              }}
            >
              No gates defined for this route.
            </p>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                position: 'relative',
                paddingLeft: '24px',
              }}
            >
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

              {checkpointsTimeline.map((item, index) => {
                const incident = session.incidents?.find(
                  (inc) => inc.gateId === item.gate.id,
                );
                return (
                  <div
                    key={item.gate.id}
                    style={{
                      display: 'flex',
                      gap: '16px',
                      position: 'relative',
                      zIndex: 1,
                    }}
                  >
                    {/* Dot */}
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        background: item.scanned
                          ? 'var(--success)'
                          : 'var(--border-color)',
                        border: '4px solid var(--bg-primary)',
                        boxShadow: item.scanned
                          ? '0 0 8px rgba(var(--success-rgb), 0.5)'
                          : 'none',
                        marginTop: '14px',
                        marginLeft: '-23px',
                      }}
                    ></div>

                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        background: item.scanned
                          ? 'var(--bg-primary)'
                          : 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-sm)',
                        border: `1px solid ${item.scanned ? 'var(--success)' : 'var(--border-color)'}30`,
                        opacity: item.scanned ? 1 : 0.7,
                      }}
                    >
                      <div style={{ flex: 1, marginRight: '16px' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: item.scanned
                              ? 'var(--success)'
                              : 'var(--text-muted)',
                          }}
                        >
                          Seq {item.sequence} -{' '}
                          {item.scanned ? 'SCANNED' : 'PENDING'}
                        </span>
                        <h4
                          style={{
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            margin: '2px 0',
                          }}
                        >
                          {item.gate.name}
                        </h4>
                        <p
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            margin: 0,
                            fontFamily: 'monospace',
                          }}
                        >
                          GATE CODE: {item.gate.gateCode}
                        </p>

                        {item.scanned && item.status && (
                          <p
                            style={{
                              fontSize: '0.8rem',
                              marginTop: '6px',
                              marginBottom: '0px',
                            }}
                          >
                            🔧 Gate Status:{' '}
                            <span
                              style={{
                                color:
                                  item.status === 'GOOD'
                                    ? 'var(--success)'
                                    : 'var(--danger)',
                                fontWeight: 700,
                              }}
                            >
                              {item.status === 'GOOD'
                                ? 'Good'
                                : 'Damaged / Issue'}
                            </span>
                          </p>
                        )}

                        {/* {item.scanned && (
                          <div
                            style={{
                              marginTop: '8px',
                              padding: '10px',
                              background: 'var(--bg-secondary)',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                            }}
                          >
                            {item.checkpointId &&
                            editingCpIdWeb === item.checkpointId ? (
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '8px',
                                  marginTop: '4px',
                                }}
                              >
                                <textarea
                                  value={editingRemarksWeb}
                                  onChange={(e) =>
                                    setEditingRemarksWeb(e.target.value)
                                  }
                                  className="form-input"
                                  style={{
                                    minHeight: '50px',
                                    fontSize: '0.85rem',
                                  }}
                                  placeholder="Enter sweep note..."
                                />
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    onClick={() =>
                                      updateCpRemarksMutation.mutate({
                                        checkpointId: item.checkpointId!,
                                        remarks: editingRemarksWeb,
                                      })
                                    }
                                    className="btn btn-primary"
                                    style={{
                                      padding: '4px 12px',
                                      fontSize: '0.75rem',
                                    }}
                                    disabled={updateCpRemarksMutation.isPending}
                                  >
                                    Save Note
                                  </button>
                                  <button
                                    onClick={() => setEditingCpIdWeb(null)}
                                    className="btn btn-secondary"
                                    style={{
                                      padding: '4px 12px',
                                      fontSize: '0.75rem',
                                    }}
                                    disabled={updateCpRemarksMutation.isPending}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p
                                style={{
                                  fontSize: '0.85rem',
                                  color: 'var(--text-primary)',
                                  margin: 0,
                                }}
                              >
                                {item.remarks ? (
                                  item.remarks
                                ) : (
                                  <span
                                    style={{
                                      fontStyle: 'italic',
                                      color: 'var(--text-muted)',
                                    }}
                                  >
                                    No sweep note provided yet.
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                        )} */}

                        {incident && (
                          <div
                            style={{
                              marginTop: '8px',
                              padding: '10px',
                              background: 'rgba(239, 68, 68, 0.08)',
                              borderLeft: '3px solid var(--danger)',
                              borderRadius: '4px',
                            }}
                          >
                            <h5
                              style={{
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                color: 'var(--danger)',
                                margin: '0 0 4px 0',
                              }}
                            >
                              🚨 Incident: {incident.type} ({incident.severity})
                            </h5>
                            <p
                              style={{
                                fontSize: '0.78rem',
                                color: 'var(--text-secondary)',
                                margin: 0,
                              }}
                            >
                              {incident.description}
                            </p>
                          </div>
                        )}

                        {/* Task Verification Checklist */}
                        <TaskVerificationChecklist
                          scanned={item.scanned}
                          configuredSubTasks={
                            (item.gate as any)?.subTasks || []
                          }
                          subTaskResponses={item.subTaskResponses || []}
                          checkpointImages={item.images || []}
                          employeeRole={
                            (session?.assignment?.employee as any)?.role ||
                            (session as any)?.employee?.role ||
                            'SECURITY'
                          }
                          employeeName={
                            session?.assignment?.employee
                              ? `${session.assignment.employee.firstName} ${session.assignment.employee.lastName}`
                              : undefined
                          }
                          scannedAt={item.scannedAt || undefined}
                        />
                      </div>

                      <div style={{ textAlign: 'right', minWidth: '80px' }}>
                        {item.scanned ? (
                          <>
                            <p
                              style={{
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                margin: 0,
                              }}
                            >
                              {new Date(item.scannedAt!).toLocaleTimeString()}
                            </p>
                            {item.scanCoords && (
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  color: 'var(--text-muted)',
                                  fontFamily: 'monospace',
                                  display: 'block',
                                  marginTop: '4px',
                                }}
                              >
                                GPS: {item.scanCoords}
                              </span>
                            )}
                          </>
                        ) : (
                          <em
                            style={{
                              fontSize: '0.8rem',
                              color: 'var(--text-muted)',
                            }}
                          >
                            Unscanned
                          </em>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Quick Stats summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3
              style={{
                fontSize: '1.05rem',
                fontWeight: 600,
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Clock size={18} style={{ color: 'var(--text-muted)' }} />
              <span>Patrol Timings</span>
            </h3>

            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div>
                <p
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    margin: '0 0 4px 0',
                  }}
                >
                  STARTED AT
                </p>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>
                  {new Date(session.startedAt).toLocaleString()}
                </p>
              </div>

              <div>
                <p
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    margin: '0 0 4px 0',
                  }}
                >
                  ENDED AT
                </p>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>
                  {session.endedAt
                    ? new Date(session.endedAt).toLocaleString()
                    : 'Active monitoring'}
                </p>
              </div>

              <div>
                <p
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    margin: '0 0 4px 0',
                  }}
                >
                  ELAPSED DURATION
                </p>
                <p
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: 'var(--primary)',
                    margin: 0,
                  }}
                >
                  {session.totalDuration
                    ? `${session.totalDuration} minutes`
                    : 'In progress'}
                </p>
              </div>

              {session.remarks && (
                <div
                  style={{
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: '16px',
                  }}
                >
                  <p
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      margin: '0 0 4px 0',
                    }}
                  >
                    PATROL NOTES / REMARKS
                  </p>
                  <p
                    style={{
                      fontSize: '0.85rem',
                      color: 'var(--text-secondary)',
                      margin: 0,
                      fontStyle: 'italic',
                      lineHeight: 1.5,
                    }}
                  >
                    "{session.remarks}"
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '24px' }}>
            <h3
              style={{
                fontSize: '1.05rem',
                fontWeight: 600,
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Shield size={18} style={{ color: 'var(--text-muted)' }} />
              <span>Assignment Context</span>
            </h3>

            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              <div>
                <p
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    margin: '0 0 4px 0',
                  }}
                >
                  MONITORED SITE
                </p>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>
                  {session.assignment.site.name}
                </p>
              </div>

              <div>
                <p
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    margin: '0 0 4px 0',
                  }}
                >
                  SHIFT RANGE
                </p>
                <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>
                  {session.assignment.shift.name}
                </p>
                <span
                  style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
                >
                  ({session.assignment.shift.startTime} -{' '}
                  {session.assignment.shift.endTime})
                </span>
              </div>
            </div>
          </div>

          {/* Supervisor Verification Card */}
          <div
            className="glass-card"
            style={{
              padding: '24px',
              borderLeft: `6px solid ${
                session.verificationStatus === 'VERIFIED'
                  ? 'var(--success)'
                  : session.verificationStatus === 'NOT_VERIFIED'
                    ? 'var(--danger)'
                    : 'var(--warning)'
              }`,
            }}
          >
            <h3
              style={{
                fontSize: '1.05rem',
                fontWeight: 600,
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle2 size={18} style={{ color: 'var(--primary)' }} />
              <span>Supervisor Verification Status</span>
            </h3>

            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <div>
                <p
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    margin: '0 0 4px 0',
                  }}
                >
                  STATUS
                </p>
                <span
                  className={`status-chip ${
                    session.verificationStatus === 'VERIFIED'
                      ? 'status-active'
                      : session.verificationStatus === 'NOT_VERIFIED'
                        ? 'status-expired'
                        : 'status-trial'
                  }`}
                  style={{
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    padding: '4px 10px',
                  }}
                >
                  {session.verificationStatus === 'VERIFIED'
                    ? '✓ VERIFIED'
                    : session.verificationStatus === 'NOT_VERIFIED'
                      ? '✕ NOT VERIFIED'
                      : '⏳ PENDING VERIFICATION'}
                </span>
              </div>

              {session.verifiedBy && (
                <div>
                  <p
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      margin: '0 0 4px 0',
                    }}
                  >
                    VERIFIED BY
                  </p>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>
                    {session.verifiedBy.employee
                      ? `${session.verifiedBy.employee.firstName} ${session.verifiedBy.employee.lastName}`
                      : session.verifiedBy.email}
                  </p>
                </div>
              )}

              {session.verificationTime && (
                <div>
                  <p
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      margin: '0 0 4px 0',
                    }}
                  >
                    VERIFIED AT
                  </p>
                  <p
                    style={{
                      fontSize: '0.85rem',
                      color: 'var(--text-secondary)',
                      margin: 0,
                    }}
                  >
                    {new Date(session.verificationTime).toLocaleString()}
                  </p>
                </div>
              )}

              {session.supervisorRemarks && (
                <div
                  style={{
                    background: 'var(--bg-secondary)',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <p
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      margin: '0 0 4px 0',
                    }}
                  >
                    SUPERVISOR REMARKS
                  </p>
                  <p
                    style={{
                      fontSize: '0.85rem',
                      color: 'var(--text-primary)',
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    "{session.supervisorRemarks}"
                  </p>
                </div>
              )}

              {(!session.verificationStatus ||
                session.verificationStatus === 'PENDING') && (
                <div
                  style={{
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <p
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      margin: 0,
                    }}
                  >
                    Supervisor Review & Action
                  </p>
                  <textarea
                    value={webSupervisorRemarks}
                    onChange={(e) => setWebSupervisorRemarks(e.target.value)}
                    className="form-input"
                    style={{
                      minHeight: '60px',
                      fontSize: '0.85rem',
                      resize: 'vertical',
                    }}
                    placeholder="Enter remarks for audit..."
                  />
                  <div
                    style={{ display: 'flex', gap: '8px', marginTop: '4px' }}
                  >
                    <button
                      onClick={() =>
                        verifyMutation.mutate({
                          verificationStatus: 'VERIFIED',
                          supervisorRemarks: webSupervisorRemarks || undefined,
                        })
                      }
                      className="btn btn-primary"
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        fontSize: '0.8rem',
                        background: 'var(--success)',
                        border: 'none',
                      }}
                      disabled={verifyMutation.isPending}
                    >
                      Verify Patrol
                    </button>
                    <button
                      onClick={() =>
                        verifyMutation.mutate({
                          verificationStatus: 'NOT_VERIFIED',
                          supervisorRemarks: webSupervisorRemarks || undefined,
                        })
                      }
                      className="btn btn-secondary"
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        fontSize: '0.8rem',
                        color: 'var(--danger)',
                        borderColor: 'var(--danger)',
                      }}
                      disabled={verifyMutation.isPending}
                    >
                      Mark Not Verified
                    </button>
                  </div>
                </div>
              )}
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
          <p
            style={{
              fontSize: '0.9rem',
              color: 'var(--text-secondary)',
              margin: 0,
            }}
          >
            Submit final remarks or notes to conclude this patrol session:
          </p>

          <textarea
            value={completeRemarks}
            onChange={(e) => setCompleteRemarks(e.target.value)}
            className="form-input"
            style={{ minHeight: '100px', resize: 'vertical' }}
            placeholder="Write final handover remarks, incident summary, etc."
          />

          <div
            style={{
              display: 'flex',
              justifySelf: 'flex-end',
              gap: '12px',
              marginTop: '8px',
            }}
          >
            <button
              onClick={() => setIsCompleteModalOpen(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={() => completeMutation.mutate(completeRemarks)}
              className="btn btn-primary"
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending
                ? 'Completing patrol...'
                : 'Complete Patrol'}
            </button>
          </div>
        </div>
      </Modal>

      {/* INSPECTION PHOTO PREVIEW LIGHTBOX */}
      <Modal
        isOpen={!!previewImageUrl}
        onClose={() => setPreviewImageUrl(null)}
        title="Inspection Photo Viewer"
      >
        {previewImageUrl && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <img
              src={previewImageUrl}
              alt="Inspection Photo Full View"
              style={{
                maxWidth: '100%',
                maxHeight: '70vh',
                borderRadius: '8px',
                objectFit: 'contain',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                border: '1px solid var(--border-color)',
              }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <a
                href={previewImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                Open Full View
              </a>
              <button
                onClick={() => setPreviewImageUrl(null)}
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Printable Enterprise A4 Patrol Completion Report Component */}
      <PatrolSessionPrintTemplate session={session} />
    </div>
  );
}
