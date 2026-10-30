'use client';

import {
  buildCheckpointTimeline,
  getReportOfficerInfo,
} from '@/lib/checkpoint-timeline';
import {
  formatPatrolDateTime,
  formatPatrolDuration,
  resolveCheckpointTiming,
} from '@/lib/date-formatter';
import { formatEmiratesId } from '@/lib/emirates-id';
import { Printer, Shield } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { filterEligibleCheckpointsForSession } from '../../../../lib/checkpoint-eligibility';
import { resolveImageUrl } from '../../../../lib/image';
import Modal from '../../../components/ui/Modal';
import StatusChip from '../../../components/ui/StatusChip';
import TaskVerificationChecklist from '../../patrol-sessions/components/TaskVerificationChecklist';
import SingleReportPrintTemplate from './SingleReportPrintTemplate';

interface DetailedReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: any;
}

export default function DetailedReportModal({
  isOpen,
  onClose,
  report,
}: DetailedReportModalProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [highlightedCheckpointSeq, setHighlightedCheckpointSeq] = useState<
    number | null
  >(null);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const checkpointCardRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { guardName, officerRole } = useMemo(
    () => getReportOfficerInfo(report),
    [report],
  );

  const incidents = report?.incidents || [];
  const snags = report?.snags || [];

  const rawTimeline = useMemo(() => {
    if (!report) return [];
    return buildCheckpointTimeline(report, guardName, officerRole);
  }, [report, guardName, officerRole]);

  // Authoritatively filter to eligible checkpoints:
  // - Checkpoints scanned in this session are always preserved (historical evidence)
  // - Checkpoints active during this patrol session are included
  // - Checkpoints deactivated prior to the session (and not scanned) are excluded
  const checkpointsTimeline = useMemo(() => {
    if (!report) return [];
    return filterEligibleCheckpointsForSession(rawTimeline, report);
  }, [rawTimeline, report]);

  const totalGates = checkpointsTimeline.length;
  const completedCount = checkpointsTimeline.filter(
    (item: any) => item.scanned,
  ).length;
  const unscannedCount = Math.max(0, totalGates - completedCount);
  const compliancePct =
    totalGates > 0 ? Math.round((completedCount / totalGates) * 100) : 0;
  const patrolDurationFormatted = report ? formatPatrolDuration(report) : '—';

  const handleScrollToFirstUnscanned = useCallback(() => {
    if (!report || unscannedCount === 0) return;

    // Authoritative unscanned checkpoint check using existing timeline sequence
    const firstUnscanned = checkpointsTimeline.find(
      (item: any) => !item.scanned,
    );
    if (!firstUnscanned) return;

    const targetEl = checkpointCardRefs.current.get(firstUnscanned.sequence);
    if (!targetEl) return;

    // Locate the scrollable modal container (.modal-content-body)
    const scrollContainer = modalContentRef.current?.closest(
      '.modal-content-body',
    ) as HTMLElement | null;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (scrollContainer) {
      // Calculate target element's top position relative to the scroll container's current visible viewport
      const containerRect = scrollContainer.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const offsetFromContainerTop = targetRect.top - containerRect.top;
      // Position checkpoint comfortably near the top with 16px offset
      const targetScrollTop =
        scrollContainer.scrollTop + offsetFromContainerTop - 16;

      scrollContainer.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    } else {
      targetEl.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    }

    try {
      targetEl.focus({ preventScroll: true });
    } catch {
      // ignore
    }

    // Set brief visual highlight for 2.5 seconds
    setHighlightedCheckpointSeq(firstUnscanned.sequence);
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedCheckpointSeq(null);
      highlightTimerRef.current = null;
    }, 2500);
  }, [report, unscannedCount, checkpointsTimeline]);

  // Clean up highlight timer on modal close or report change
  useEffect(() => {
    if (!isOpen || !report) {
      setHighlightedCheckpointSeq(null);
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
    }
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
    };
  }, [isOpen, report?.id]);

  const handlePrintSingle = useCallback(() => {
    window.print();
  }, []);

  // Conditional rendering must occur strictly after all hooks have executed
  if (!isOpen || !report) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Patrol Report: ${report.patrolCode}`}
      className="rpt-wide-modal"
      headerContent={
        <button
          type="button"
          onClick={handlePrintSingle}
          className="btn btn-primary"
          style={{
            fontSize: '0.85rem',
            padding: '6px 14px',
            gap: '6px',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          <Printer size={15} />
          <span>Print Audit Report</span>
        </button>
      }
    >
      <div
        ref={modalContentRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          padding: '10px 0',
        }}
      >
        {/* Company & Executive Header */}
        {(() => {
          const rawLogo =
            report.client?.clientLogoUrl ||
            report.assignment?.client?.clientLogoUrl ||
            report.assignment?.site?.client?.clientLogoUrl ||
            report.clientLogoUrl;
          const resolvedLogo = rawLogo ? resolveImageUrl(rawLogo) : null;
          const clientName =
            report.client?.companyName ||
            report.assignment?.client?.companyName ||
            report.assignment?.site?.client?.companyName ||
            report.assignment?.site?.companyName ||
            report.clientCompanyName;

          return (
            <div
              style={{
                padding: '16px 20px',
                borderRadius: '12px',
                backgroundColor: 'var(--surface-color)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '14px' }}
              >
                {resolvedLogo ? (
                  <div
                    style={{
                      maxHeight: '44px',
                      maxWidth: '130px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <img
                      src={resolvedLogo}
                      alt="Client Logo"
                      style={{
                        maxHeight: '44px',
                        maxWidth: '130px',
                        objectFit: 'contain',
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--primary)',
                    }}
                  >
                    <Shield size={24} />
                  </div>
                )}
                <div>
                  <h3
                    style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}
                  >
                    {clientName || 'Hello Orbit'}
                  </h3>
                  <p
                    style={{
                      margin: '2px 0 0 0',
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Official Security Patrol Audit Report
                  </p>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Report ID
                </div>
                <div
                  style={{
                    fontSize: '1.1rem',
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    color: 'var(--primary)',
                  }}
                >
                  {report.patrolCode}
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    marginTop: '4px',
                  }}
                >
                  Generated: {formatPatrolDateTime(new Date())}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Inspection Meta Information - 2 Column Grid on Desktop */}
        {(() => {
          const emp = report.assignment?.employee || report.employee;
          const mgrEmp = report.managerUser?.employee;
          const officerName = emp
            ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() ||
              emp.name ||
              emp.email ||
              '—'
            : mgrEmp
              ? `${mgrEmp.firstName || ''} ${mgrEmp.lastName || ''}`.trim() ||
                '—'
              : report.managerUser?.email ||
                (report.user
                  ? `${report.user.firstName || ''} ${report.user.lastName || ''}`.trim() ||
                    report.user.name
                  : '') ||
                (report.officerName && report.officerName !== 'Inspector'
                  ? report.officerName
                  : '—');
          const officerCode =
            emp?.employeeNumber ||
            emp?.employeeCode ||
            mgrEmp?.employeeNumber ||
            report.employeeCode ||
            null;
          const officerRole =
            emp?.role ||
            mgrEmp?.role ||
            report.employeeRole ||
            (report.managerUserId ? 'MANAGER' : null);

          const shift = report.assignment?.shift || report.shift;
          const shiftDisplay = shift?.name
            ? `Shift: ${shift.name}${shift.startTime && shift.endTime ? ` (${shift.startTime} - ${shift.endTime})` : ''}`
            : shift?.startTime && shift?.endTime
              ? `Shift: ${shift.startTime} - ${shift.endTime}`
              : 'Shift: —';

          const startedFormatted = report.startedAt
            ? formatPatrolDateTime(report.startedAt)
            : null;
          const completedFormatted = report.endedAt
            ? formatPatrolDateTime(report.endedAt)
            : null;

          return (
            <div className="rpt-meta-grid">
              <div className="rpt-meta-card">
                <div className="rpt-meta-label">Employee / Inspector</div>
                <div className="rpt-meta-val">{officerName}</div>
                {(officerCode || officerRole) && (
                  <div
                    className="rpt-meta-sub"
                    style={{ fontFamily: 'monospace' }}
                  >
                    {officerCode ? `ID: ${officerCode}` : ''}
                    {officerCode && officerRole ? ' • ' : ''}
                    {officerRole
                      ? officerRole === 'CLEANER'
                        ? 'House Keeping'
                        : officerRole.replace('_', ' ')
                      : ''}
                  </div>
                )}
                <div
                  className="rpt-meta-sub"
                  style={{ fontSize: '0.72rem', marginTop: '3px' }}
                >
                  Emirates ID:{' '}
                  {formatEmiratesId(
                    emp?.emiratesId || mgrEmp?.emiratesId || report.emiratesId,
                  )}
                </div>
              </div>

              <div className="rpt-meta-card">
                <div className="rpt-meta-label">Monitored Site</div>
                <div className="rpt-meta-val">
                  {report.assignment?.site?.name || report.site?.name || 'N/A'}
                </div>
                <div className="rpt-meta-sub">
                  {report.assignment?.site?.address ||
                    report.site?.address ||
                    'Standard Location'}
                </div>
              </div>

              <div className="rpt-meta-card">
                <div className="rpt-meta-label">Route / Target</div>
                <div className="rpt-meta-val">
                  {report.assignment?.patrolRoute?.name ||
                    '🚧 Direct Checkpoints'}
                </div>
                <div className="rpt-meta-sub">{shiftDisplay}</div>
              </div>

              <div className="rpt-meta-card">
                <div className="rpt-meta-label">Status & Duration</div>
                <div className="rpt-meta-status-row">
                  <StatusChip status={report.status} />
                  <span className="rpt-meta-duration">
                    {patrolDurationFormatted}
                  </span>
                </div>
                {startedFormatted && (
                  <div
                    className="rpt-meta-sub"
                    style={{ fontSize: '0.72rem', marginTop: '4px' }}
                  >
                    Started: {startedFormatted}
                    {completedFormatted
                      ? ` • Completed: ${completedFormatted}`
                      : ''}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Checkpoint Scan Summary */}
        <div>
          <div
            style={{
              fontSize: '0.85rem',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              marginBottom: '8px',
            }}
          >
            Checkpoint Scan Summary
          </div>
          <div className="rpt-summary-cards-row">
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-color)',
              }}
            >
              <div
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  letterSpacing: '0.03em',
                }}
              >
                Total Checkpoints
              </div>
              <div
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  color: 'var(--primary, #3b82f6)',
                  marginTop: '2px',
                }}
              >
                {totalGates}
              </div>
            </div>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                backgroundColor: 'rgba(16, 185, 129, 0.05)',
              }}
            >
              <div
                style={{
                  fontSize: '0.72rem',
                  color: '#10b981',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  letterSpacing: '0.03em',
                }}
              >
                Scanned
              </div>
              <div
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  color: '#10b981',
                  marginTop: '2px',
                }}
              >
                {completedCount}
              </div>
            </div>

            <div
              className={`rpt-summary-unscanned-card ${unscannedCount > 0 ? 'is-clickable' : ''}`}
              role={unscannedCount > 0 ? 'button' : undefined}
              tabIndex={unscannedCount > 0 ? 0 : undefined}
              aria-label={
                unscannedCount > 0
                  ? `Scroll to first unscanned checkpoint (${unscannedCount} unscanned)`
                  : 'No unscanned checkpoints'
              }
              title={
                unscannedCount > 0
                  ? 'Click to scroll to first unscanned checkpoint'
                  : 'All checkpoints scanned'
              }
              onClick={
                unscannedCount > 0 ? handleScrollToFirstUnscanned : undefined
              }
              onKeyDown={(e) => {
                if (
                  unscannedCount > 0 &&
                  (e.key === 'Enter' || e.key === ' ')
                ) {
                  e.preventDefault();
                  handleScrollToFirstUnscanned();
                }
              }}
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                backgroundColor: 'rgba(239, 68, 68, 0.05)',
                cursor: unscannedCount > 0 ? 'pointer' : 'default',
                userSelect: 'none',
              }}
            >
              <div
                style={{
                  fontSize: '0.72rem',
                  color: '#ef4444',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  letterSpacing: '0.03em',
                }}
              >
                Unscanned
              </div>
              <div
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  color: '#ef4444',
                  marginTop: '2px',
                }}
              >
                {unscannedCount}
              </div>
            </div>
          </div>
        </div>

        {/* Compliance Progress Metrics */}
        <div
          style={{
            padding: '16px',
            borderRadius: '10px',
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
            }}
          >
            <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>
              Inspection Compliance Score
            </span>
            <span
              style={{
                fontSize: '1rem',
                fontWeight: 800,
                color: 'var(--primary)',
              }}
            >
              {compliancePct}% ({completedCount} of {totalGates} Completed)
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'var(--border-color)',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${compliancePct}%`,
                height: '100%',
                backgroundColor: compliancePct === 100 ? '#10b981' : '#3b82f6',
                borderRadius: '4px',
              }}
            />
          </div>
        </div>

        {/* Checkpoint Inspection Breakdown */}
        <div>
          <h4
            style={{
              margin: '0 0 16px 0',
              fontSize: '1.05rem',
              fontWeight: 700,
            }}
          >
            Detailed Checkpoint Timeline
          </h4>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
            {checkpointsTimeline.map((item: any, idx: number) => {
              const timing = resolveCheckpointTiming(item);
              const isHighlighted = highlightedCheckpointSeq === item.sequence;

              return (
                <div
                  key={item.sequence ?? idx}
                  ref={(el) => {
                    if (el) {
                      checkpointCardRefs.current.set(item.sequence, el);
                    } else {
                      checkpointCardRefs.current.delete(item.sequence);
                    }
                  }}
                  id={`checkpoint-timeline-item-${item.sequence}`}
                  tabIndex={-1}
                  className={`rpt-checkpoint-item ${isHighlighted ? 'is-highlighted' : ''}`}
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--surface-color)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '8px',
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
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: item.scanned
                              ? 'rgba(16, 185, 129, 0.15)'
                              : 'rgba(239, 68, 68, 0.15)',
                            color: item.scanned ? '#10b981' : '#ef4444',
                          }}
                        >
                          Seq #{item.sequence} —{' '}
                          {item.scanned ? 'SCANNED' : 'NOT SCANNED'}
                        </span>
                        <h5
                          style={{
                            margin: 0,
                            fontSize: '0.95rem',
                            fontWeight: 700,
                          }}
                        >
                          {item.gate.name}
                        </h5>
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          fontFamily: 'monospace',
                          marginTop: '4px',
                        }}
                      >
                        CODE: {item.gate.gateCode}
                      </div>
                    </div>

                    <div
                      style={{
                        textAlign: 'right',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: '3px',
                      }}
                    >
                      {timing.isPending ? (
                        <em
                          style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-muted)',
                          }}
                        >
                          Pending
                        </em>
                      ) : (
                        <>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              fontSize: '0.82rem',
                              flexWrap: 'wrap',
                              justifyContent: 'flex-end',
                            }}
                          >
                            <span>
                              <span
                                style={{
                                  color: 'var(--text-muted)',
                                  fontSize: '0.75rem',
                                }}
                              >
                                Start Time:{' '}
                              </span>
                              <strong>{timing.startTimeFormatted}</strong>
                            </span>
                            <span
                              style={{ color: 'var(--border-color, #cbd5e1)' }}
                            >
                              •
                            </span>
                            <span>
                              <span
                                style={{
                                  color: 'var(--text-muted)',
                                  fontSize: '0.75rem',
                                }}
                              >
                                End Time:{' '}
                              </span>
                              <strong
                                style={{
                                  color: timing.isIncomplete
                                    ? '#ef4444'
                                    : 'inherit',
                                }}
                              >
                                {timing.endTimeFormatted}
                              </strong>
                            </span>
                            <span
                              style={{ color: 'var(--border-color, #cbd5e1)' }}
                            >
                              •
                            </span>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                backgroundColor: timing.isIncomplete
                                  ? 'rgba(239, 68, 68, 0.12)'
                                  : 'rgba(16, 185, 129, 0.12)',
                                color: timing.isIncomplete
                                  ? '#ef4444'
                                  : '#10b981',
                                fontWeight: 700,
                                fontSize: '0.78rem',
                              }}
                            >
                              Duration: {timing.durationFormatted}
                            </span>
                          </div>
                          {item.scanCoords && (
                            <div
                              style={{
                                fontSize: '0.72rem',
                                color: 'var(--text-muted)',
                                fontFamily: 'monospace',
                              }}
                            >
                              GPS: {item.scanCoords}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {item.scanned && item.status && (
                    <div style={{ fontSize: '0.82rem' }}>
                      🔧 Gate Condition:{' '}
                      <strong
                        style={{
                          color: item.status === 'GOOD' ? '#10b981' : '#ef4444',
                        }}
                      >
                        {item.status === 'GOOD'
                          ? 'Good Condition'
                          : 'Damaged / Issue Reported'}
                      </strong>
                    </div>
                  )}

                  {item.remarks && (
                    <div
                      style={{
                        fontSize: '0.82rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      📝 Remarks: {item.remarks}
                    </div>
                  )}

                  <TaskVerificationChecklist
                    scanned={item.scanned}
                    configuredSubTasks={item.gate?.subTasks || []}
                    subTaskResponses={item.subTaskResponses || []}
                    checkpointImages={item.images || []}
                    employeeRole={officerRole}
                    employeeName={guardName}
                    scannedAt={item.scannedAt}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Reported Incidents Summary */}
        {incidents.length > 0 && (
          <div
            style={{
              padding: '16px',
              borderRadius: '10px',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
            }}
          >
            <h4
              style={{
                margin: '0 0 12px 0',
                fontSize: '1rem',
                fontWeight: 700,
                color: '#ef4444',
              }}
            >
              🚨 Reported Incidents & Hazards ({incidents.length})
            </h4>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              {incidents.map((inc: any) => (
                <div
                  key={inc.id}
                  style={{
                    padding: '12px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--surface-color)',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      color: '#ef4444',
                    }}
                  >
                    {inc.type} ({inc.severity})
                  </div>
                  <p
                    style={{
                      margin: '4px 0 0 0',
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {inc.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reported Snags / Defects Summary */}
        {snags.length > 0 && (
          <div
            style={{
              padding: '16px',
              borderRadius: '10px',
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
            }}
          >
            <h4
              style={{
                margin: '0 0 12px 0',
                fontSize: '1rem',
                fontWeight: 700,
                color: '#f59e0b',
              }}
            >
              🔧 Reported Snags & Maintenance Defects ({snags.length})
            </h4>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              {snags.map((snag: any) => (
                <div
                  key={snag.id}
                  style={{
                    padding: '12px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--surface-color)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        color: '#f59e0b',
                      }}
                    >
                      {snag.category}{' '}
                      {snag.subCategory ? `• ${snag.subCategory}` : ''} (
                      {snag.priority} PRIORITY)
                    </div>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(245, 158, 11, 0.15)',
                        color: '#f59e0b',
                      }}
                    >
                      {snag.status}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: '4px 0 0 0',
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {snag.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Image Zoom Modal */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          <img
            src={selectedImage}
            alt="Zoomed Inspection"
            style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '8px' }}
          />
        </div>
      )}

      {/* Single Report Print Template */}
      <SingleReportPrintTemplate report={report} />

      <style>{`
        .rpt-wide-modal {
          width: 90vw !important;
          max-width: 1200px !important;
          max-height: 90vh !important;
        }
        @media (max-width: 1024px) {
          .rpt-wide-modal {
            width: 94vw !important;
          }
        }
        @media (max-width: 640px) {
          .rpt-wide-modal {
            width: calc(100vw - 24px) !important;
          }
        }
        .rpt-meta-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }
        @media (max-width: 640px) {
          .rpt-meta-grid {
            grid-template-columns: 1fr;
          }
        }
        .rpt-meta-card {
          padding: 14px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background-color: var(--bg-color);
        }
        .rpt-meta-label {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-bottom: 4px;
        }
        .rpt-meta-val {
          font-weight: 700;
          font-size: 0.95rem;
        }
        .rpt-meta-sub {
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-top: 2px;
        }
        .rpt-meta-status-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 2px;
        }
        .rpt-meta-duration {
          font-weight: 700;
          font-size: 0.9rem;
        }
        .rpt-summary-cards-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        @media (max-width: 640px) {
          .rpt-summary-cards-row {
            grid-template-columns: 1fr;
          }
        }
        .rpt-summary-unscanned-card.is-clickable {
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
        }
        .rpt-summary-unscanned-card.is-clickable:hover {
          background-color: rgba(239, 68, 68, 0.12) !important;
          border-color: rgba(239, 68, 68, 0.45) !important;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.12);
        }
        .rpt-summary-unscanned-card.is-clickable:focus-visible {
          outline: 2px solid #ef4444;
          outline-offset: 2px;
        }
        .rpt-checkpoint-item {
          transition: border-color 0.3s ease, box-shadow 0.3s ease, background-color 0.3s ease;
        }
        .rpt-checkpoint-item:focus {
          outline: none;
        }
        .rpt-checkpoint-item.is-highlighted {
          border-color: rgba(239, 68, 68, 0.65) !important;
          background-color: rgba(239, 68, 68, 0.06) !important;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.3), 0 6px 20px rgba(239, 68, 68, 0.12) !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .rpt-summary-unscanned-card.is-clickable {
            transition: none !important;
          }
          .rpt-checkpoint-item {
            transition: none !important;
          }
        }
      `}</style>
    </Modal>
  );
}
