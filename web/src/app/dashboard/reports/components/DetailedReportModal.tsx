'use client';

import React, { useState } from 'react';
import { Printer, Shield } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import StatusChip from '../../../components/ui/StatusChip';
import SingleReportPrintTemplate from './SingleReportPrintTemplate';
import TaskVerificationChecklist from '../../patrol-sessions/components/TaskVerificationChecklist';
import { formatPatrolDateTime, formatPatrolTime } from '@/lib/date-formatter';

interface DetailedReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: any;
}

export default function DetailedReportModal({ isOpen, onClose, report }: DetailedReportModalProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!report) return null;

  const isDirectAssignment =
    (report.assignment as any)?.assignmentType === 'DIRECT_CHECKPOINTS' ||
    (!report.assignment?.patrolRoute &&
      report.assignment?.assignmentGates &&
      report.assignment.assignmentGates.length > 0);

  const routeGates = isDirectAssignment
    ? (report.assignment?.assignmentGates || []).map((ag: any, idx: number) => ({
        sequence: ag.sequence || idx + 1,
        gate: ag.gate,
      }))
    : report.assignment?.patrolRoute?.routeGates || [];

  const scans = report.checkpoints || [];
  const incidents = report.incidents || [];
  const snags = report.snags || [];

  const checkpointsTimeline = routeGates
    .sort((a: any, b: any) => a.sequence - b.sequence)
    .map((rg: any) => {
      const scan = scans.find((s: any) => s.gateId === rg.gate.id);
      return {
        sequence: rg.sequence,
        gate: rg.gate,
        scanned: !!scan,
        scannedAt: scan?.scannedAt,
        remarks: scan?.remarks,
        status: scan?.status,
        images: scan?.images || [],
        subTaskResponses: scan?.subTaskResponses || [],
        scanCoords: scan?.latitude && scan?.longitude ? `${scan.latitude.toFixed(5)}, ${scan.longitude.toFixed(5)}` : null,
      };
    });

  const isManagerSession = !report.assignment && !!(report as any).managerUserId;
  const expectedGateIds: string[] = isManagerSession
    ? Array.from(new Set((scans || []).map((cp: any) => cp.gateId || cp.gate?.id).filter(Boolean)))
    : isDirectAssignment
    ? (report.assignment?.assignmentGates || []).map((ag: any) => ag.gateId || ag.gate?.id).filter(Boolean)
    : (report.assignment?.patrolRoute?.routeGates || []).map((rg: any) => rg.gateId || rg.gate?.id).filter(Boolean);

  const expectedGatesSet = new Set(expectedGateIds);
  const totalGates = expectedGatesSet.size;

  const scannedGateIds = (scans || []).map((cp: any) => cp.gateId || cp.gate?.id).filter(Boolean);
  const scannedAssignedCount = new Set(scannedGateIds.filter((id: string) => expectedGatesSet.has(id))).size;

  const completedCount = isManagerSession ? (scans.length ? totalGates : 0) : scannedAssignedCount;
  const unscannedCount = Math.max(0, totalGates - completedCount);
  const compliancePct = totalGates > 0 ? Math.round((completedCount / totalGates) * 100) : 100;
  const durationMins = report.totalDuration ? Math.round(report.totalDuration / 60) : 0;

  const handlePrintSingle = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Inspection Report: ${report.patrolCode}`}
      className="rpt-wide-modal"
      headerContent={
        <button
          type="button"
          onClick={handlePrintSingle}
          className="btn btn-primary"
          style={{ fontSize: '0.85rem', padding: '6px 14px', gap: '6px', display: 'inline-flex', alignItems: 'center' }}
        >
          <Printer size={15} />
          <span>Print Audit Report</span>
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0' }}>
        {/* Company & Executive Header */}
        <div
          style={{
            padding: '16px 20px',
            borderRadius: '12px',
            backgroundColor: 'var(--surface-color)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Hello Orbit</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Official Security Patrol Audit Report
              </p>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Report ID</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'monospace', color: 'var(--primary)' }}>
              {report.patrolCode}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Generated: {formatPatrolDateTime(new Date())}
            </div>
          </div>
        </div>

        {/* Inspection Meta Information - 2 Column Grid on Desktop */}
        {(() => {
          const emp = report.assignment?.employee || report.employee;
          const mgrEmp = report.managerUser?.employee;
          const officerName = emp
            ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name || emp.email || '—'
            : mgrEmp
            ? `${mgrEmp.firstName || ''} ${mgrEmp.lastName || ''}`.trim() || '—'
            : report.managerUser?.email || (report.user ? `${report.user.firstName || ''} ${report.user.lastName || ''}`.trim() || report.user.name : '') || (report.officerName && report.officerName !== 'Inspector' ? report.officerName : '—');
          const officerCode = emp?.employeeNumber || emp?.employeeCode || mgrEmp?.employeeNumber || report.employeeCode || null;

          return (
            <div className="rpt-meta-grid">
              <div className="rpt-meta-card">
                <div className="rpt-meta-label">Security Officer / Inspector</div>
                <div className="rpt-meta-val">{officerName}</div>
                {officerCode && (
                  <div className="rpt-meta-sub" style={{ fontFamily: 'monospace' }}>
                    ID: {officerCode}
                  </div>
                )}
              </div>

              <div className="rpt-meta-card">
                <div className="rpt-meta-label">Monitored Site</div>
                <div className="rpt-meta-val">{report.assignment?.site?.name || 'N/A'}</div>
                <div className="rpt-meta-sub">
                  {report.assignment?.site?.address || 'Standard Location'}
                </div>
              </div>

              <div className="rpt-meta-card">
                <div className="rpt-meta-label">Route / Target</div>
                <div className="rpt-meta-val">
                  {report.assignment?.patrolRoute?.name || '🚧 Direct Checkpoints'}
                </div>
                <div className="rpt-meta-sub">
                  Shift: {report.assignment?.shift?.startTime || '—'} - {report.assignment?.shift?.endTime || '—'}
                </div>
              </div>

              <div className="rpt-meta-card">
                <div className="rpt-meta-label">Status & Duration</div>
                <div className="rpt-meta-status-row">
                  <StatusChip status={report.status} />
                  <span className="rpt-meta-duration">{durationMins} mins</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Checkpoint Scan Summary */}
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
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
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.03em' }}>
                Total Checkpoints
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary, #3b82f6)', marginTop: '2px' }}>
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
              <div style={{ fontSize: '0.72rem', color: '#10b981', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.03em' }}>
                Scanned
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                {completedCount}
              </div>
            </div>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                backgroundColor: 'rgba(239, 68, 68, 0.05)',
              }}
            >
              <div style={{ fontSize: '0.72rem', color: '#ef4444', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.03em' }}>
                Unscanned
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444', marginTop: '2px' }}>
                {unscannedCount}
              </div>
            </div>
          </div>
        </div>

        {/* Compliance Progress Metrics */}
        <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>Inspection Compliance Score</span>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>
              {compliancePct}% ({completedCount} of {totalGates} Completed)
            </span>
          </div>
          <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
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
          <h4 style={{ margin: '0 0 16px 0', fontSize: '1.05rem', fontWeight: 700 }}>Detailed Checkpoint Timeline</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {checkpointsTimeline.map((item: any, idx: number) => {
              return (
                <div
                  key={idx}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: item.scanned ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: item.scanned ? '#10b981' : '#ef4444',
                          }}
                        >
                          Seq #{item.sequence} — {item.scanned ? 'SCANNED' : 'NOT SCANNED'}
                        </span>
                        <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>{item.gate.name}</h5>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '4px' }}>
                        CODE: {item.gate.gateCode}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      {item.scanned ? (
                        <>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                            {formatPatrolTime(item.scannedAt)}
                          </div>
                          {item.scanCoords && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              GPS: {item.scanCoords}
                            </div>
                          )}
                        </>
                      ) : (
                        <em style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pending</em>
                      )}
                    </div>
                  </div>

                  {item.scanned && item.status && (
                    <div style={{ fontSize: '0.82rem' }}>
                      🔧 Gate Condition:{' '}
                      <strong style={{ color: item.status === 'GOOD' ? '#10b981' : '#ef4444' }}>
                        {item.status === 'GOOD' ? 'Good Condition' : 'Damaged / Issue Reported'}
                      </strong>
                    </div>
                  )}

                  {item.remarks && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      📝 Remarks: {item.remarks}
                    </div>
                  )}

                  <TaskVerificationChecklist
                    scanned={item.scanned}
                    configuredSubTasks={item.gate?.subTasks || []}
                    subTaskResponses={item.subTaskResponses || []}
                    checkpointImages={item.images || []}
                    employeeRole={
                      report.assignment?.employee?.role || report.employeeRole || 'SECURITY'
                    }
                    employeeName={
                      report.assignment?.employee
                        ? `${report.assignment.employee.firstName} ${report.assignment.employee.lastName}`
                        : report.employeeName
                    }
                    scannedAt={item.scannedAt}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Reported Incidents Summary */}
        {incidents.length > 0 && (
          <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: 700, color: '#ef4444' }}>
              🚨 Reported Incidents & Hazards ({incidents.length})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {incidents.map((inc: any) => (
                <div key={inc.id} style={{ padding: '12px', borderRadius: '6px', backgroundColor: 'var(--surface-color)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#ef4444' }}>
                    {inc.type} ({inc.severity})
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    {inc.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reported Snags / Defects Summary */}
        {snags.length > 0 && (
          <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: 700, color: '#f59e0b' }}>
              🔧 Reported Snags & Maintenance Defects ({snags.length})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {snags.map((snag: any) => (
                <div key={snag.id} style={{ padding: '12px', borderRadius: '6px', backgroundColor: 'var(--surface-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f59e0b' }}>
                      {snag.category} {snag.subCategory ? `• ${snag.subCategory}` : ''} ({snag.priority} PRIORITY)
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                      {snag.status}
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
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
          <img src={selectedImage} alt="Zoomed Inspection" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: '8px' }} />
        </div>
      )}

      {/* Single Report Print Template */}
      <SingleReportPrintTemplate report={report} />

      <style jsx global>{`
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
      `}</style>
    </Modal>
  );
}
