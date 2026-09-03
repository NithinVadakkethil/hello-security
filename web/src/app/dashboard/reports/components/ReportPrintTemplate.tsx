'use client';

import React from 'react';

interface ReportPrintTemplateProps {
  analytics?: any;
  sessions: any[];
  filters: any;
}

export default function ReportPrintTemplate({ analytics, sessions, filters }: ReportPrintTemplateProps) {
  return (
    <div className="report-print-only">
      <style jsx global>{`
        @media screen {
          .report-print-only {
            display: none !important;
          }
        }
        @media print {
          body * {
            visibility: hidden;
          }
          .report-print-only,
          .report-print-only * {
            visibility: visible;
          }
          .report-print-only {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
            color: #000;
            background: #fff;
            font-family: system-ui, -apple-system, sans-serif;
          }
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
        }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: '2px solid #000', paddingBottom: '12px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22pt', fontWeight: 'bold' }}>Hello Orbit</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '10pt', color: '#444' }}>
            Enterprise Security Guard Inspection & Patrol Audit Report
          </p>
        </div>
        <div style={{ textAlign: 'right', fontSize: '9pt', color: '#444' }}>
          <div>Generated: {new Date().toLocaleString()}</div>
          <div>Filter Preset: {filters.datePreset || 'All Time'}</div>
        </div>
      </div>

      {/* Summary KPI Box */}
      {analytics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px', backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '6px' }}>
          <div>
            <div style={{ fontSize: '8pt', color: '#666' }}>Total Inspections</div>
            <div style={{ fontSize: '14pt', fontWeight: 'bold' }}>{analytics.totalInspections}</div>
          </div>
          <div>
            <div style={{ fontSize: '8pt', color: '#666' }}>Completed Sweeps</div>
            <div style={{ fontSize: '14pt', fontWeight: 'bold' }}>{analytics.completedInspections}</div>
          </div>
          <div>
            <div style={{ fontSize: '8pt', color: '#666' }}>Compliance Rate</div>
            <div style={{ fontSize: '14pt', fontWeight: 'bold' }}>{analytics.complianceRate}%</div>
          </div>
          <div>
            <div style={{ fontSize: '8pt', color: '#666' }}>Issues Reported</div>
            <div style={{ fontSize: '14pt', fontWeight: 'bold' }}>{analytics.totalIssuesReported}</div>
          </div>
        </div>
      )}

      {/* Inspection Log Table */}
      <h3 style={{ fontSize: '12pt', marginBottom: '8px' }}>Inspection Log Records ({sessions.length})</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
        <thead>
          <tr style={{ borderBottom: '1.5px solid #000', backgroundColor: '#eaeaea' }}>
            <th style={{ padding: '6px', textAlign: 'left' }}>Report ID</th>
            <th style={{ padding: '6px', textAlign: 'left' }}>Date & Time</th>
            <th style={{ padding: '6px', textAlign: 'left' }}>Security Guard</th>
            <th style={{ padding: '6px', textAlign: 'left' }}>Site</th>
            <th style={{ padding: '6px', textAlign: 'left' }}>Route / Target</th>
            <th style={{ padding: '6px', textAlign: 'left' }}>Status</th>
            <th style={{ padding: '6px', textAlign: 'left' }}>Progress</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session, idx) => {
            const isDirectAssignment =
              (session.assignment as any)?.assignmentType === 'DIRECT_CHECKPOINTS' ||
              (!session.assignment?.patrolRoute &&
                (session.assignment?.assignmentGates?.length || 0) > 0);

            const totalGates = isDirectAssignment
              ? session.assignment?.assignmentGates?.length || 0
              : session.assignment?.patrolRoute?.routeGates?.length || 0;

            const scannedCount = new Set(
              (session.checkpoints || []).map((cp: any) => cp.gateId || cp.id),
            ).size;

            return (
              <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '6px', fontFamily: 'monospace', fontWeight: 'bold' }}>{session.patrolCode}</td>
                <td style={{ padding: '6px' }}>{new Date(session.startedAt).toLocaleString()}</td>
                <td style={{ padding: '6px' }}>
                  {session.assignment?.employee?.firstName} {session.assignment?.employee?.lastName} ({session.assignment?.employee?.employeeNumber})
                </td>
                <td style={{ padding: '6px' }}>{session.assignment?.site?.name}</td>
                <td style={{ padding: '6px' }}>{session.assignment?.patrolRoute?.name || 'Direct Checkpoints'}</td>
                <td style={{ padding: '6px', fontWeight: 'bold' }}>{session.status}</td>
                <td style={{ padding: '6px' }}>
                  {scannedCount} / {totalGates} Scanned
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Footer */}
      <div style={{ marginTop: '30px', borderTop: '1px solid #ccc', paddingTop: '8px', fontSize: '8pt', color: '#666', textAlign: 'center' }}>
        Hello Orbit Security Management System — Official Audit Document
      </div>
    </div>
  );
}
