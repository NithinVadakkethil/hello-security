'use client';

import Modal from '@/app/components/ui/Modal';
import { apiClient } from '@/app/lib/axios';
import { AlertCircle, CheckCircle, MapPin, User } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export interface MissedSubTask {
  id: string;
  taskName: string;
  description?: string | null;
  role?: string;
  isRequired?: boolean;
  status: string;
}

export interface MissedGate {
  sequence: number;
  gateId: string;
  name: string;
  gateCode: string;
  routeName: string;
  status: string;
  tasks: MissedSubTask[];
}

export interface MissedCheckpointsData {
  patrolId: string;
  patrolCode: string;
  status: string;
  employeeName: string;
  employeeCode: string;
  employeeRole: string;
  emiratesId?: string | null;
  siteName: string;
  routeName: string;
  shiftName: string;
  totalCheckpoints: number;
  scannedCheckpoints: number;
  missedCheckpoints: number;
  missedGates: MissedGate[];
}

export interface MissedCheckpointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  patrolId: string | null;
  patrolCode?: string | null;
  clientId: string | null;
}

export default function MissedCheckpointsModal({
  isOpen,
  onClose,
  patrolId,
  patrolCode,
  clientId,
}: MissedCheckpointsModalProps) {
  const [data, setData] = useState<MissedCheckpointsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMissedDetails = useCallback(async () => {
    if (!patrolId || !clientId) return;
    setIsLoading(true);
    setError(null);

    try {
      const res: any = await apiClient.get(
        `/central-manager/reports/${patrolId}/missed-checkpoints?clientId=${clientId}`,
      );
      const resData = res?.data || res;
      setData(resData);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error?.message ||
        'Failed to load missed checkpoint details.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [patrolId, clientId]);

  useEffect(() => {
    if (isOpen && patrolId) {
      fetchMissedDetails();
    } else {
      setData(null);
      setError(null);
    }
  }, [isOpen, patrolId, fetchMissedDetails]);

  if (!isOpen) return null;

  const titleCode = data?.patrolCode || patrolCode || patrolId || '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Missed Checkpoints — ${titleCode}`}
      maxWidth="750px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Loading State */}
        {isLoading && (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: 'var(--text-secondary)',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                border: '3px solid rgba(220, 38, 38, 0.2)',
                borderTopColor: '#dc2626',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 12px auto',
              }}
            />
            <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>
              Loading missed checkpoint details...
            </p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div
            style={{
              padding: '16px 20px',
              borderRadius: '8px',
              backgroundColor: 'rgba(220, 38, 38, 0.08)',
              border: '1px solid rgba(220, 38, 38, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertCircle size={20} color="#dc2626" />
              <span
                style={{
                  fontSize: '0.88rem',
                  color: '#dc2626',
                  fontWeight: 500,
                }}
              >
                {error}
              </span>
            </div>
            <button
              type="button"
              onClick={fetchMissedDetails}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '4px 10px' }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Data Content */}
        {!isLoading && !error && data && (
          <>
            {/* Patrol & Employee Overview Header Card */}
            <div
              className="glass-card"
              style={{
                padding: '16px 18px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <User size={16} color="var(--primary)" />
                    <span
                      style={{
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {data.employeeName}
                    </span>
                    {data.employeeCode && data.employeeCode !== '—' && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontFamily: 'monospace',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--bg-muted, rgba(0,0,0,0.05))',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {data.employeeCode}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary)',
                      marginTop: '4px',
                      display: 'flex',
                      gap: '10px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>
                      Role: <strong>{data.employeeRole}</strong>
                    </span>
                    {data.emiratesId && data.emiratesId !== 'Not provided' && (
                      <span>
                        EID:{' '}
                        <strong style={{ fontFamily: 'monospace' }}>
                          {data.emiratesId}
                        </strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Location / Route Details */}
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <MapPin size={14} color="var(--text-muted)" />
                    <span
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {data.siteName}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                      marginTop: '2px',
                    }}
                  >
                    Route: <strong>{data.routeName}</strong> • Shift:{' '}
                    <strong>{data.shiftName}</strong>
                  </div>
                </div>
              </div>

              {/* Three Metric Overview Badges */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '10px',
                  paddingTop: '10px',
                  borderTop: '1px solid var(--border-color)',
                }}
              >
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(37, 99, 235, 0.08)',
                    border: '1px solid rgba(37, 99, 235, 0.2)',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.72rem',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      color: '#2563eb',
                    }}
                  >
                    Total Checkpoints
                  </div>
                  <div
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      color: '#2563eb',
                      marginTop: '2px',
                    }}
                  >
                    {data.totalCheckpoints}
                  </div>
                </div>

                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(22, 163, 74, 0.08)',
                    border: '1px solid rgba(22, 163, 74, 0.2)',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.72rem',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      color: '#16a34a',
                    }}
                  >
                    Scanned
                  </div>
                  <div
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      color: '#16a34a',
                      marginTop: '2px',
                    }}
                  >
                    {data.scannedCheckpoints}
                  </div>
                </div>

                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(220, 38, 38, 0.08)',
                    border: '1px solid rgba(220, 38, 38, 0.2)',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.72rem',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      color: '#dc2626',
                    }}
                  >
                    Missed
                  </div>
                  <div
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      color: '#dc2626',
                      marginTop: '2px',
                    }}
                  >
                    {data.missedCheckpoints}
                  </div>
                </div>
              </div>
            </div>

            {/* Missed Checkpoints List */}
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <h4
                  style={{
                    margin: 0,
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  Unscanned Checkpoints ({data.missedGates.length})
                </h4>
                <span
                  style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}
                >
                  Eligible checkpoints not verified during this patrol session
                </span>
              </div>

              {data.missedGates.length === 0 ? (
                <div
                  style={{
                    padding: '30px 20px',
                    textAlign: 'center',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(22, 163, 74, 0.05)',
                    border: '1px solid rgba(22, 163, 74, 0.2)',
                    color: '#16a34a',
                  }}
                >
                  <CheckCircle
                    size={28}
                    style={{ margin: '0 auto 8px auto' }}
                  />
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>
                    All eligible checkpoints were scanned! No missed checkpoints
                    for this patrol.
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    maxHeight: '52vh',
                    overflowY: 'auto',
                    paddingRight: '4px',
                  }}
                >
                  {data.missedGates.map((gate) => (
                    <div
                      key={`${gate.gateId}-${gate.sequence}`}
                      style={{
                        padding: '14px 16px',
                        borderRadius: '8px',
                        borderLeft: '4px solid #dc2626',
                        backgroundColor: 'var(--bg-card)',
                        borderTop: '1px solid var(--border-color)',
                        borderRight: '1px solid var(--border-color)',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      {/* Checkpoint Header Row */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '10px',
                        }}
                      >
                        <div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              flexWrap: 'wrap',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                color: '#dc2626',
                                backgroundColor: 'rgba(220, 38, 38, 0.1)',
                                padding: '1px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              Seq #{gate.sequence}
                            </span>
                            <span
                              style={{
                                fontSize: '0.92rem',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                              }}
                            >
                              {gate.name}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: '0.78rem',
                              color: 'var(--text-secondary)',
                              marginTop: '3px',
                              display: 'flex',
                              gap: '8px',
                            }}
                          >
                            <span>
                              Code:{' '}
                              <strong style={{ fontFamily: 'monospace' }}>
                                {gate.gateCode}
                              </strong>
                            </span>
                            <span>•</span>
                            <span>Route: {gate.routeName}</span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(220, 38, 38, 0.1)',
                            color: '#dc2626',
                            letterSpacing: '0.03em',
                            textTransform: 'uppercase',
                          }}
                        >
                          {gate.status || 'MISSED'}
                        </span>
                      </div>

                      {/* Subtask Verification Checklist */}
                      <div
                        style={{
                          marginTop: '4px',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-muted, rgba(0,0,0,0.02))',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            color: 'var(--text-secondary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em',
                            marginBottom: '6px',
                          }}
                        >
                          Task Verification Checklist ({gate.tasks.length}):
                        </div>

                        {gate.tasks.length === 0 ? (
                          <div
                            style={{
                              fontSize: '0.8rem',
                              fontStyle: 'italic',
                              color: 'var(--text-muted)',
                            }}
                          >
                            No inspection tasks configured
                          </div>
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '5px',
                            }}
                          >
                            {gate.tasks.map((task, taskIdx) => (
                              <div
                                key={task.id || taskIdx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '10px',
                                  fontSize: '0.82rem',
                                  padding: '4px 0',
                                  borderBottom:
                                    taskIdx < gate.tasks.length - 1
                                      ? '1px dashed var(--border-color)'
                                      : 'none',
                                }}
                              >
                                <span
                                  style={{
                                    color: 'var(--text-primary)',
                                    fontWeight: 500,
                                  }}
                                >
                                  {taskIdx + 1}. {task.taskName}
                                  {task.isRequired && (
                                    <span
                                      style={{
                                        marginLeft: '6px',
                                        fontSize: '0.7rem',
                                        color: '#ef4444',
                                        fontWeight: 600,
                                      }}
                                    >
                                      *
                                    </span>
                                  )}
                                </span>
                                <span
                                  style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                    color: '#d97706',
                                    letterSpacing: '0.02em',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {task.status || 'NOT ANSWERED'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Modal Footer Controls */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            paddingTop: '12px',
            borderTop: '1px solid var(--border-color)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
