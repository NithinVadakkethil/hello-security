'use client';

import React, { useState } from 'react';
import { Printer, Shield } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import StatusChip from '../../../components/ui/StatusChip';
import { resolveImageUrl } from '../../../../lib/image';
import SingleReportPrintTemplate from './SingleReportPrintTemplate';
import TaskVerificationChecklist from '../../patrol-sessions/components/TaskVerificationChecklist';

interface DetailedReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: any;
}

export default function DetailedReportModal({ isOpen, onClose, report }: DetailedReportModalProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!report) return null;

  const routeGates =
    report.assignment?.assignmentGates && report.assignment.assignmentGates.length > 0
      ? report.assignment.assignmentGates.map((ag: any, idx: number) => ({
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

  const totalGates = routeGates.length;
  const scannedCount = scans.length;
  const compliancePct = totalGates > 0 ? Math.round((scannedCount / totalGates) * 100) : 100;
  const durationMins = report.totalDuration ? Math.round(report.totalDuration / 60) : 0;

  const handlePrintSingle = () => {
    window.print();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Inspection Report: ${report.patrolCode}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '10px 0' }}>
        {/* Actions Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={handlePrintSingle}
            className="btn btn-primary"
            style={{ fontSize: '0.85rem', padding: '8px 16px', gap: '6px' }}
          >
            <Printer size={16} />
            <span>Print Audit Report</span>
          </button>
        </div>

        {/* Company & Executive Header */}
        <div
          style={{
            padding: '20px',
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
              Generated: {new Date().toLocaleString()}
            </div>
          </div>
        </div>

        {/* Inspection Meta Information */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Security Officer</div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
              {report.assignment?.employee?.firstName} {report.assignment?.employee?.lastName}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
              ID: {report.assignment?.employee?.employeeNumber}
            </div>
          </div>

          <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Monitored Site</div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{report.assignment?.site?.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {report.assignment?.site?.address || 'Standard Location'}
            </div>
          </div>

          <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Route / Target</div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
              {report.assignment?.patrolRoute?.name || '🚧 Direct Checkpoints'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Shift: {report.assignment?.shift?.startTime} - {report.assignment?.shift?.endTime}
            </div>
          </div>

          <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Status & Duration</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              <StatusChip status={report.status} />
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{durationMins} mins</span>
            </div>
          </div>
        </div>

        {/* Compliance Progress Metrics */}
        <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>Inspection Compliance Score</span>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)' }}>
              {compliancePct}% ({scannedCount} of {totalGates} Completed)
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
                            {new Date(item.scannedAt).toLocaleTimeString()}
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

                  {item.scanned && (
                    <TaskVerificationChecklist
                      scanned={item.scanned}
                      configuredSubTasks={item.gate?.subTasks || []}
                      subTaskResponses={item.subTaskResponses || []}
                      checkpointImages={item.images || []}
                      employeeRole={report.employeeRole || 'SECURITY'}
                      employeeName={report.employeeName}
                      scannedAt={item.scannedAt}
                    />
                  )}

                  {item.scanned && item.images && item.images.length > 0 ? (
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        Uploaded Live Inspection Photos:
                      </div>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {item.images.map((imgUrl: string, imgIdx: number) => {
                          const fullUrl = resolveImageUrl(imgUrl);
                          return (
                            <img
                              key={imgIdx}
                              src={fullUrl}
                              alt={`Scan photo ${imgIdx}`}
                              onClick={() => setSelectedImage(fullUrl)}
                              style={{
                                width: '76px',
                                height: '76px',
                                borderRadius: '6px',
                                objectFit: 'cover',
                                border: '1px solid var(--border-color)',
                                cursor: 'zoom-in',
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ) : item.scanned ? (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>📷 No photos attached</div>
                  ) : null}
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
    </Modal>
  );
}
