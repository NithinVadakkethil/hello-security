'use client';

import React from 'react';
import { resolveImageUrl } from '../../../../lib/image';

interface SingleReportPrintTemplateProps {
  report: any;
}

export default function SingleReportPrintTemplate({ report }: SingleReportPrintTemplateProps) {
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
        scanCoords: scan?.latitude && scan?.longitude ? `${scan.latitude.toFixed(5)}, ${scan.longitude.toFixed(5)}` : null,
      };
    });

  const totalGates = routeGates.length;
  const scannedCount = scans.length;
  const compliancePct = totalGates > 0 ? Math.round((scannedCount / totalGates) * 100) : 100;
  const durationMins = report.totalDuration ? Math.round(report.totalDuration / 60) : 0;

  return (
    <div className="single-report-print-only">
      <style jsx global>{`
        @media screen {
          .single-report-print-only {
            display: none !important;
          }
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          .single-report-print-only,
          .single-report-print-only * {
            visibility: visible !important;
          }
          .single-report-print-only {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 20px !important;
            color: #000 !important;
            background: #fff !important;
            font-family: system-ui, -apple-system, sans-serif !important;
          }
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
        }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: '2px solid #000', paddingBottom: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20pt', fontWeight: 'bold' }}>Hello Orbit</h1>
          <p style={{ margin: '2px 0 0 0', fontSize: '9pt', color: '#333' }}>
            Official Security Patrol Inspection Audit Report
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '8pt', color: '#666' }}>Report Code</div>
          <div style={{ fontSize: '14pt', fontWeight: 'bold', fontFamily: 'monospace' }}>{report.patrolCode}</div>
          <div style={{ fontSize: '8pt', color: '#666', marginTop: '2px' }}>
            Generated: {new Date().toLocaleString()}
          </div>
        </div>
      </div>

      {/* Inspection Meta Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '16px', backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '6px' }}>
        <div>
          <div style={{ fontSize: '8pt', color: '#666' }}>Security Officer</div>
          <div style={{ fontSize: '10pt', fontWeight: 'bold' }}>
            {report.assignment?.employee?.firstName} {report.assignment?.employee?.lastName} (ID: {report.assignment?.employee?.employeeNumber})
          </div>
        </div>
        <div>
          <div style={{ fontSize: '8pt', color: '#666' }}>Monitored Site</div>
          <div style={{ fontSize: '10pt', fontWeight: 'bold' }}>{report.assignment?.site?.name}</div>
        </div>
        <div>
          <div style={{ fontSize: '8pt', color: '#666' }}>Route / Target</div>
          <div style={{ fontSize: '10pt', fontWeight: 'bold' }}>
            {report.assignment?.patrolRoute?.name || 'Direct Checkpoints'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '8pt', color: '#666' }}>Status & Duration</div>
          <div style={{ fontSize: '10pt', fontWeight: 'bold' }}>
            {report.status} ({durationMins} mins)
          </div>
        </div>
      </div>

      {/* Compliance Score */}
      <div style={{ marginBottom: '16px', border: '1px solid #ddd', padding: '10px', borderRadius: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', fontWeight: 'bold', marginBottom: '4px' }}>
          <span>Compliance Score</span>
          <span>{compliancePct}% ({scannedCount} / {totalGates} Scanned)</span>
        </div>
      </div>

      {/* Timeline Table */}
      <h3 style={{ fontSize: '11pt', marginBottom: '8px' }}>Checkpoint Inspection Timeline</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt', marginBottom: '20px' }}>
        <thead>
          <tr style={{ borderBottom: '1.5px solid #000', backgroundColor: '#eaeaea' }}>
            <th style={{ padding: '6px', textAlign: 'left' }}>Seq</th>
            <th style={{ padding: '6px', textAlign: 'left' }}>Checkpoint Name</th>
            <th style={{ padding: '6px', textAlign: 'left' }}>Status</th>
            <th style={{ padding: '6px', textAlign: 'left' }}>Time</th>
            <th style={{ padding: '6px', textAlign: 'left' }}>Remarks</th>
            <th style={{ padding: '6px', textAlign: 'left' }}>GPS</th>
          </tr>
        </thead>
        <tbody>
          {checkpointsTimeline.map((item: any, idx: number) => (
            <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px', fontWeight: 'bold' }}>#{item.sequence}</td>
              <td style={{ padding: '6px' }}>
                <strong>{item.gate.name}</strong> ({item.gate.gateCode})
              </td>
              <td style={{ padding: '6px', fontWeight: 'bold', color: item.scanned ? (item.status === 'GOOD' ? '#10b981' : '#ef4444') : '#999' }}>
                {item.scanned ? (item.status === 'GOOD' ? 'Good' : 'Damaged / Issue') : 'Not Scanned'}
              </td>
              <td style={{ padding: '6px' }}>{item.scannedAt ? new Date(item.scannedAt).toLocaleTimeString() : '-'}</td>
              <td style={{ padding: '6px' }}>{item.remarks || '-'}</td>
              <td style={{ padding: '6px', fontFamily: 'monospace' }}>{item.scanCoords || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Incidents Section */}
      {incidents.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '11pt', color: '#d97706', marginBottom: '6px' }}>Reported Incidents ({incidents.length})</h3>
          {incidents.map((inc: any, idx: number) => (
            <div key={idx} style={{ padding: '8px', border: '1px solid #fcd34d', backgroundColor: '#fffbeb', borderRadius: '4px', marginBottom: '6px', fontSize: '8.5pt' }}>
              <strong>{inc.type} ({inc.severity})</strong>: {inc.description}
            </div>
          ))}
        </div>
      )}

      {/* Embedded Photos */}
      {scans.some((s: any) => s.images && s.images.length > 0) && (
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '11pt', marginBottom: '8px' }}>Inspection Photo Attachments</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {scans.flatMap((s: any) => (s.images || []).map((imgUrl: string, idx: number) => {
              const fullUrl = resolveImageUrl(imgUrl);
              return (
                <img
                  key={idx}
                  src={fullUrl}
                  alt={`Attachment ${idx}`}
                  style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              );
            }))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: '20px', borderTop: '1px solid #ccc', paddingTop: '8px', fontSize: '8pt', color: '#666', textAlign: 'center' }}>
        Hello Orbit Security Management System — Official Individual Audit Document ({report.patrolCode})
      </div>
    </div>
  );
}
