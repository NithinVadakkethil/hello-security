'use client';

import React, { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer, Activity, Clock, CheckSquare, AlertTriangle } from 'lucide-react';

import { apiClient } from '../../lib/axios';
import { ApiResponse } from '../../types/api';

interface Checkpoint {
  id: string;
  gateId: string;
  remarks?: string | null;
  scannedAt: string;
  gate: {
    name: string;
  };
}

interface PatrolSession {
  id: string;
  patrolCode: string;
  status: 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  startedAt: string;
  endedAt?: string | null;
  totalDuration?: number | null;
  remarks?: string | null;
  assignment: {
    employee: {
      firstName: string;
      lastName: string;
    };
    site: {
      name: string;
    };
    patrolRoute: {
      name: string;
      routeGates?: any[];
    };
  };
  checkpoints?: Checkpoint[];
}

export default function ReportsPage() {
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch Patrol Sessions
  const { data: sessionsRes, isLoading } = useQuery<ApiResponse<PatrolSession[]>>({
    queryKey: ['patrol-sessions'],
    queryFn: () => apiClient.get('/patrol-sessions'),
  });

  const sessions = sessionsRes?.data || [];

  // Calculate Report Metrics
  const completedPatrols = sessions.filter((s) => s.status === 'COMPLETED');
  const cancelledPatrols = sessions.filter((s) => s.status === 'CANCELLED');
  const activePatrols = sessions.filter((s) => s.status === 'IN_PROGRESS' || s.status === 'PAUSED');

  const totalPatrolsCount = sessions.length;
  const completionRate = totalPatrolsCount
    ? Math.round((completedPatrols.length / totalPatrolsCount) * 100)
    : 0;

  // Average Duration of completed patrols
  const averageDuration = completedPatrols.length
    ? Math.round(
        completedPatrols.reduce((acc, curr) => acc + (curr.totalDuration || 0), 0) /
          completedPatrols.length
      )
    : 0;

  // Total gates scanned
  const totalScans = sessions.reduce((acc, curr) => acc + (curr.checkpoints?.length || 0), 0);

  // Collect incident remarks
  const incidentsList = sessions
    .flatMap((session) => {
      const cps = session.checkpoints || [];
      return cps
        .filter((cp) => cp.remarks && cp.remarks.trim())
        .map((cp) => ({
          patrolCode: session.patrolCode,
          guard: `${session.assignment.employee.firstName} ${session.assignment.employee.lastName}`,
          site: session.assignment.site.name,
          gateName: cp.gate.name,
          remarks: cp.remarks,
          timestamp: new Date(cp.scannedAt).toLocaleString(),
        }));
    })
    .slice(0, 10); // Show recent 10 incidents

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0' }}>
        <RefreshCw className="spin-animation" size={32} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Action Header */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handlePrint} className="btn btn-primary" style={{ gap: '8px' }}>
          <Printer size={16} />
          <span>Print Statement Report</span>
        </button>
      </div>

      {/* Main Print Container */}
      <div ref={printRef} className="print-container" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Printable Header */}
        <div className="print-header" style={{ display: 'none', borderBottom: '2px solid #000', paddingBottom: '12px' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Hello Orbit</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem' }}>Operational Patrol Report Summary</p>
          <span style={{ fontSize: '0.8rem', color: '#555' }}>
            Generated Date: {new Date().toLocaleString()}
          </span>
        </div>

        {/* Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          <div className="glass-card stat-card" style={{ padding: '24px' }}>
            <div className="stat-icon-wrapper blue" style={{ marginBottom: '12px' }}>
              <CheckSquare size={20} />
            </div>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>PATROL COMPLETION RATE</h4>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>{completionRate}%</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {completedPatrols.length} of {totalPatrolsCount} sessions succeeded
            </span>
          </div>

          <div className="glass-card stat-card" style={{ padding: '24px' }}>
            <div className="stat-icon-wrapper purple" style={{ marginBottom: '12px' }}>
              <Clock size={20} />
            </div>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>AVG PATROL DURATION</h4>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>{averageDuration} mins</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Completed patrol session mean
            </span>
          </div>

          <div className="glass-card stat-card" style={{ padding: '24px' }}>
            <div className="stat-icon-wrapper cyan" style={{ marginBottom: '12px' }}>
              <Activity size={20} />
            </div>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>TOTAL GATES SCANNED</h4>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>{totalScans}</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Scans logged across all sites
            </span>
          </div>

          <div className="glass-card stat-card" style={{ padding: '24px' }}>
            <div className="stat-icon-wrapper gold" style={{ marginBottom: '12px' }}>
              <AlertTriangle size={20} style={{ color: 'var(--warning)' }} />
            </div>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 4px 0' }}>FLAGGED INCIDENTS</h4>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>{incidentsList.length}</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Checkpoints with logged remarks
            </span>
          </div>
        </div>

        {/* Sessions Completion Chart Representation */}
        <div className="glass-card" style={{ padding: '28px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '20px' }}>Session Status Summary</h3>
          
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', justifySelf: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                    <span>Completed Patrols ({completedPatrols.length})</span>
                    <span>{totalPatrolsCount ? Math.round((completedPatrols.length / totalPatrolsCount) * 100) : 0}%</span>
                  </div>
                  <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--success)', width: `${totalPatrolsCount ? (completedPatrols.length / totalPatrolsCount) * 100 : 0}%` }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifySelf: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                    <span>Active Patrols ({activePatrols.length})</span>
                    <span>{totalPatrolsCount ? Math.round((activePatrols.length / totalPatrolsCount) * 100) : 0}%</span>
                  </div>
                  <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--primary)', width: `${totalPatrolsCount ? (activePatrols.length / totalPatrolsCount) * 100 : 0}%` }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifySelf: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                    <span>Cancelled Patrols ({cancelledPatrols.length})</span>
                    <span>{totalPatrolsCount ? Math.round((cancelledPatrols.length / totalPatrolsCount) * 100) : 0}%</span>
                  </div>
                  <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--danger)', width: `${totalPatrolsCount ? (cancelledPatrols.length / totalPatrolsCount) * 100 : 0}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Incidents Feed */}
        <div className="glass-card" style={{ padding: '28px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '20px' }}>Recent Incidents & Guard Remarks</h3>

          {incidentsList.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '20px 0' }}>
              No incidents or custom remarks logged by guard staff.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {incidentsList.map((inc, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    padding: '16px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{inc.guard}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{inc.timestamp}</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Site: <strong>{inc.site}</strong> | Gate: <strong>{inc.gateName}</strong> | Code: <code>{inc.patrolCode}</code>
                  </p>
                  <div
                    style={{
                      background: 'var(--bg-primary)',
                      padding: '10px 14px',
                      borderRadius: '4px',
                      borderLeft: '4px solid var(--warning)',
                      fontSize: '0.85rem',
                      color: 'var(--text-primary)',
                      marginTop: '4px',
                    }}
                  >
                    "{inc.remarks}"
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Global CSS overrides for printing */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
            background: none !important;
            color: #000000 !important;
            box-shadow: none !important;
          }
          .print-container, .print-container * {
            visibility: visible;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }
          .print-header {
            display: block !important;
          }
          .glass-card {
            border: 1px solid #ddd !important;
            border-radius: 0 !important;
            margin-bottom: 20px !important;
            page-break-inside: avoid;
          }
          button, .header-actions, .theme-toggle-btn {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

// Simple helper loading icon definition
function RefreshCw({ className, size }: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size || 24}
      height={size || 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}
