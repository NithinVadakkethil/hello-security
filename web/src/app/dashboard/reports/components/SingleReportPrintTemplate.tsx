'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { resolveImageUrl } from '../../../../lib/image';

interface SingleReportPrintTemplateProps {
  report: any;
}

// ─── CSS injected via dangerouslySetInnerHTML (works in Next.js App Router) ──
const PRINT_CSS = `
  @media screen {
    .audit-report-print-root {
      display: none !important;
    }
  }

  @media print {
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #000000 !important;
      overflow: visible !important;
      height: auto !important;
    }

    /* Hide all top-level children of body EXCEPT our print template portaled to body */
    body > :not(.audit-report-print-root) {
      display: none !important;
    }

    /* Print root starts at top of Page 1 in normal document flow */
    .audit-report-print-root {
      display: block !important;
      position: static !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #111111 !important;
      font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
      font-size: 9pt;
      line-height: 1.45;
    }

    /* A4 page setup */
    @page {
      size: A4 portrait;
      margin: 12mm 14mm 16mm 14mm;
    }

    @page {
      @bottom-center {
        content: "Page " counter(page) " of " counter(pages) "   ·   Hello Orbit Security Management System";
        font-size: 7.5pt;
        color: #64748b;
        font-family: 'Segoe UI', Arial, sans-serif;
      }
    }

    /* ── Page header ── */
    .aup-header-first {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2.5px solid #1d4ed8;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .aup-org-name {
      font-size: 20pt;
      font-weight: 800;
      color: #1d4ed8;
      margin: 0;
      letter-spacing: -0.5px;
    }
    .aup-org-sub {
      font-size: 9pt;
      color: #475569;
      margin: 2px 0 0 0;
    }
    .aup-report-id-box {
      text-align: right;
    }
    .aup-report-id-label {
      font-size: 7.5pt;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .aup-report-id-value {
      font-size: 13pt;
      font-weight: 800;
      font-family: 'Courier New', monospace;
      color: #1d4ed8;
    }
    .aup-generated {
      font-size: 7.5pt;
      color: #94a3b8;
      margin-top: 3px;
    }

    /* ── Summary grid ── */
    .aup-summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
      margin-bottom: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px;
    }
    .aup-summary-cell {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .aup-cell-label {
      font-size: 7pt;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      font-weight: 700;
    }
    .aup-cell-value {
      font-size: 9.5pt;
      font-weight: 700;
      color: #0f172a;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .aup-cell-sub {
      font-size: 7.5pt;
      color: #64748b;
      word-wrap: break-word;
    }

    /* ── Inspection summary bar ── */
    .aup-inspection-summary {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 8px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 14px;
    }
    .aup-insp-stat {
      text-align: center;
    }
    .aup-insp-stat-label {
      font-size: 7pt;
      color: #3b82f6;
      text-transform: uppercase;
      font-weight: 700;
    }
    .aup-insp-stat-value {
      font-size: 12pt;
      font-weight: 800;
      color: #1d4ed8;
    }
    .aup-insp-stat.green .aup-insp-stat-value { color: #16a34a; }
    .aup-insp-stat.green .aup-insp-stat-label { color: #16a34a; }
    .aup-insp-stat.red .aup-insp-stat-value { color: #dc2626; }
    .aup-insp-stat.red .aup-insp-stat-label { color: #dc2626; }

    /* ── Section headings ── */
    .aup-section-title {
      font-size: 10pt;
      font-weight: 800;
      color: #1e3a5f;
      margin: 14px 0 8px 0;
      padding: 6px 10px;
      background: #dbeafe;
      border-left: 4px solid #1d4ed8;
      border-radius: 0 4px 4px 0;
      break-after: avoid;
      page-break-after: avoid;
    }

    /* ── Checkpoint card ── */
    .aup-checkpoint-card {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      margin-bottom: 12px;
      overflow: visible;
    }
    .aup-checkpoint-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 8px 12px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      break-after: avoid;
      page-break-after: avoid;
    }
    .aup-cp-left {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .aup-cp-name {
      font-size: 10pt;
      font-weight: 800;
      color: #0f172a;
    }
    .aup-cp-code {
      font-size: 7.5pt;
      color: #64748b;
      font-family: 'Courier New', monospace;
    }
    .aup-cp-status {
      font-size: 7.5pt;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .aup-cp-status.scanned {
      background: #dcfce7;
      color: #15803d;
    }
    .aup-cp-status.not-scanned {
      background: #fee2e2;
      color: #dc2626;
    }
    .aup-cp-right {
      text-align: right;
    }
    .aup-cp-time {
      font-size: 9pt;
      font-weight: 700;
      color: #1d4ed8;
    }
    .aup-cp-gps {
      font-size: 7pt;
      color: #94a3b8;
      font-family: 'Courier New', monospace;
    }
    .aup-cp-remarks {
      padding: 6px 12px;
      background: #fefce8;
      border-bottom: 1px solid #fef08a;
      font-size: 8.5pt;
      color: #713f12;
      word-wrap: break-word;
      overflow-wrap: break-word;
      white-space: pre-wrap;
    }

    /* ── Task checklist header ── */
    .aup-tasklist-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 12px;
      background: #f1f5f9;
      border-bottom: 1px solid #e2e8f0;
      break-after: avoid;
      page-break-after: avoid;
    }
    .aup-tasklist-title {
      font-size: 8.5pt;
      font-weight: 800;
      color: #334155;
    }
    .aup-tasklist-stats {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .aup-badge {
      font-size: 7pt;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 10px;
    }
    .aup-badge.green  { background: #dcfce7; color: #15803d; }
    .aup-badge.red    { background: #fee2e2; color: #dc2626; }
    .aup-badge.blue   { background: #dbeafe; color: #1d4ed8; }
    .aup-badge.yellow { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    .aup-badge.gray   { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }

    /* ── Individual task row ── */
    .aup-task-row {
      padding: 8px 12px;
      border-bottom: 1px solid #f1f5f9;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .aup-task-row:last-child {
      border-bottom: none;
    }
    .aup-task-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 4px;
    }
    .aup-task-left {
      flex: 1;
    }
    .aup-task-number {
      font-size: 7.5pt;
      color: #94a3b8;
      font-weight: 700;
      margin-bottom: 2px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .aup-task-title {
      font-size: 9pt;
      font-weight: 700;
      color: #0f172a;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .aup-task-meta {
      display: flex;
      gap: 5px;
      align-items: center;
      flex-wrap: wrap;
      margin-top: 3px;
    }
    .aup-task-role {
      font-size: 7pt;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
      background: #eff6ff;
      color: #1d4ed8;
    }
    .aup-task-required {
      font-size: 7pt;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 4px;
      background: #fee2e2;
      color: #dc2626;
    }
    .aup-answer-badge {
      flex-shrink: 0;
      font-size: 8pt;
      font-weight: 800;
      padding: 3px 10px;
      border-radius: 4px;
      letter-spacing: 0.5px;
    }
    .aup-answer-badge.yes { background: #dcfce7; color: #15803d; }
    .aup-answer-badge.no  { background: #fee2e2; color: #dc2626; }
    .aup-answer-badge.unanswered { background: #f1f5f9; color: #94a3b8; }

    /* ── Remarks block ── */
    .aup-remarks-block {
      margin-top: 5px;
      padding: 6px 10px;
      background: #fefce8;
      border-left: 3px solid #facc15;
      border-radius: 0 4px 4px 0;
      font-size: 8.5pt;
      color: #713f12;
      word-wrap: break-word;
      overflow-wrap: break-word;
      white-space: pre-wrap;
    }
    .aup-remarks-label {
      font-size: 7pt;
      font-weight: 700;
      color: #92400e;
      text-transform: uppercase;
      display: block;
      margin-bottom: 2px;
    }

    /* ── Evidence images ── */
    .aup-evidence-section {
      margin-top: 6px;
    }
    .aup-evidence-label {
      font-size: 7pt;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      margin-bottom: 4px;
    }
    .aup-evidence-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .aup-evidence-img {
      max-width: 130px;
      max-height: 130px;
      width: auto;
      height: auto;
      object-fit: contain;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
    }

    /* ── Task footer ── */
    .aup-task-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 5px;
      padding-top: 4px;
      border-top: 1px dashed #e2e8f0;
      font-size: 7.5pt;
      color: #94a3b8;
      flex-wrap: wrap;
      gap: 6px;
    }
    .aup-task-footer-left {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .aup-task-submitter {
      font-weight: 600;
      color: #475569;
    }
    .aup-voice-badge {
      font-size: 7pt;
      padding: 1px 6px;
      border-radius: 4px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      color: #94a3b8;
    }

    /* ── Snag Cards ── */
    .aup-snag-card {
      border: 1px solid #fde68a;
      background: #fffbeb;
      border-radius: 6px;
      margin-bottom: 10px;
      padding: 10px 12px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .aup-snag-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid #fef08a;
    }
    .aup-snag-number {
      font-size: 9.5pt;
      font-weight: 800;
      color: #92400e;
    }
    .aup-snag-badges {
      display: flex;
      gap: 6px;
    }
    .aup-snag-body {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .aup-snag-field {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .aup-snag-field-label {
      font-size: 7pt;
      font-weight: 700;
      color: #b45309;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .aup-snag-field-value {
      font-size: 8.5pt;
      color: #1e293b;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .aup-snag-remarks {
      font-size: 8.5pt;
      color: #713f12;
      background: #fefce8;
      padding: 6px 10px;
      border-left: 3px solid #facc15;
      border-radius: 0 4px 4px 0;
      word-wrap: break-word;
      overflow-wrap: break-word;
      white-space: pre-wrap;
    }
    .aup-snag-footer-row {
      display: flex;
      justify-content: space-between;
      font-size: 7.5pt;
      color: #78350f;
      padding-top: 4px;
      border-top: 1px dashed #fde68a;
      margin-top: 4px;
    }

    /* ── Incident Blocks ── */
    .aup-incident-block {
      padding: 8px 10px;
      border: 1px solid #fca5a5;
      background: #fef2f2;
      border-radius: 4px;
      margin-bottom: 6px;
      font-size: 8.5pt;
      break-inside: avoid;
      page-break-inside: avoid;
      word-wrap: break-word;
    }

    /* ── No-task placeholder ── */
    .aup-no-tasks {
      padding: 8px 12px;
      font-size: 8pt;
      color: #94a3b8;
      font-style: italic;
    }
  }
`;

// ─── Role label map (print-friendly) ──────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  SECURITY: 'Security Guard',
  TECHNICIAN: 'Technician',
  CLEANER: 'House Keeping',
  SERVICE_ENGINEER: 'Service Engineer',
  PLUMBER: 'Plumber',
  LIFE_GUARD: 'Lifeguard',
};

function getRoleLabel(role?: string | null): string {
  if (!role) return 'House Keeping';
  const u = role.toUpperCase();
  return ROLE_LABELS[u] || role;
}

// ─── Format helpers ──────────────────────────────────────────────────────────
function fmtTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleTimeString(); } catch { return '—'; }
}

function fmtDateTime(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleString(); } catch { return '—'; }
}

function fmtDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

// ─── Build a de-duplicated task list from a checkpoint's subTaskResponses ────
function buildTaskList(subTaskResponses: any[]): any[] {
  const seen = new Set<string>();
  const tasks: any[] = [];
  for (const res of (subTaskResponses || [])) {
    const key = res.id || res.gateSubTaskId || JSON.stringify(res);
    if (!seen.has(key)) {
      seen.add(key);
      tasks.push(res);
    }
  }
  return tasks;
}

// ─── Build de-duplicated checkpoint timeline ─────────────────────────────────
function buildCheckpointTimeline(report: any): any[] {
  const scans: any[] = report.checkpoints || [];

  // Prefer routeGates / assignmentGates (route-based patrol)
  const routeGates: any[] =
    report.assignment?.assignmentGates && report.assignment.assignmentGates.length > 0
      ? report.assignment.assignmentGates
          .map((ag: any, idx: number) => ({
            sequence: ag.sequence ?? idx + 1,
            gate: ag.gate,
          }))
          .filter((rg: any) => !!rg.gate)
      : (report.assignment?.patrolRoute?.routeGates || [])
          .map((rg: any) => ({
            sequence: rg.sequence ?? 0,
            gate: rg.gate ?? rg,
          }))
          .filter((rg: any) => !!rg.gate);

  if (routeGates.length > 0) {
    // Route-based: merge gates with scans
    const sorted = [...routeGates].sort((a, b) => a.sequence - b.sequence);
    const seen = new Set<string>();
    return sorted
      .filter((rg) => {
        const gateId = rg.gate?.id;
        if (!gateId || seen.has(gateId)) return false;
        seen.add(gateId);
        return true;
      })
      .map((rg) => {
        const scan = scans.find((s: any) => s.gateId === rg.gate.id);
        return buildCheckpointEntry(rg.sequence, rg.gate, scan);
      });
  }

  // Direct-checkpoint patrol: use scans as the source of truth
  const seen = new Set<string>();
  return scans
    .filter((scan: any) => {
      if (!scan.id || seen.has(scan.id)) return false;
      seen.add(scan.id);
      return true;
    })
    .map((scan: any, idx: number) => {
      const gate = scan.gate || { id: scan.gateId, name: scan.gate?.name || `Checkpoint ${idx + 1}`, gateCode: scan.gate?.gateCode || '—' };
      return buildCheckpointEntry(idx + 1, gate, scan);
    });
}

function buildCheckpointEntry(sequence: number, gate: any, scan: any) {
  return {
    sequence,
    gate,
    scanned: !!scan,
    scannedAt: scan?.scannedAt ?? null,
    remarks: scan?.remarks ?? null,
    status: scan?.status ?? null,
    images: Array.isArray(scan?.images) ? scan.images : [],
    subTaskResponses: Array.isArray(scan?.subTaskResponses) ? scan.subTaskResponses : [],
    scanCoords:
      scan?.latitude != null && scan?.longitude != null
        ? `${Number(scan.latitude).toFixed(5)}, ${Number(scan.longitude).toFixed(5)}`
        : null,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function SingleReportPrintTemplate({ report }: SingleReportPrintTemplateProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!report || !mounted) return null;

  const checkpointsTimeline = buildCheckpointTimeline(report);
  const incidents = report.incidents || [];
  const snags = report.snags || [];

  const totalGates = checkpointsTimeline.length;
  const scannedCount = checkpointsTimeline.filter((c) => c.scanned).length;
  const compliancePct = totalGates > 0 ? Math.round((scannedCount / totalGates) * 100) : 100;
  const durationMins = fmtDuration(report.totalDuration);

  // Aggregate task stats across all checkpoints
  let totalTasks = 0, yesCount = 0, noCount = 0;
  for (const cp of checkpointsTimeline) {
    const tasks = buildTaskList(cp.subTaskResponses);
    totalTasks += tasks.length;
    for (const t of tasks) {
      if (t.answer === 'YES') yesCount++;
      if (t.answer === 'NO') noCount++;
    }
  }

  const employeeName =
    report.assignment?.employee
      ? `${report.assignment.employee.firstName} ${report.assignment.employee.lastName}`
      : '—';
  const employeeId = report.assignment?.employee?.employeeNumber || '—';
  const siteName = report.assignment?.site?.name || '—';
  const siteAddress = report.assignment?.site?.address || '';
  const routeName = report.assignment?.patrolRoute?.name || 'Direct Checkpoints';
  const shiftInfo =
    report.assignment?.shift
      ? `${report.assignment.shift.startTime} – ${report.assignment.shift.endTime}`
      : '—';

  const generatedAt = new Date().toLocaleString();

  const printContent = (
    <div className="audit-report-print-root">
      {/* Inject print CSS */}
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      {/* ── Page 1: Header ────────────────────────────────────────────── */}
      <div className="aup-header-first">
        <div>
          <h1 className="aup-org-name">Hello Orbit</h1>
          <p className="aup-org-sub">Official Security Patrol Audit Report</p>
        </div>
        <div className="aup-report-id-box">
          <div className="aup-report-id-label">Report ID</div>
          <div className="aup-report-id-value">{report.patrolCode}</div>
          <div className="aup-generated">Generated: {generatedAt}</div>
        </div>
      </div>

      {/* ── Patrol Summary ─────────────────────────────────────────── */}
      <div className="aup-summary-grid">
        <div className="aup-summary-cell">
          <span className="aup-cell-label">Security Officer</span>
          <span className="aup-cell-value">{employeeName}</span>
          <span className="aup-cell-sub">Employee ID: {employeeId}</span>
        </div>
        <div className="aup-summary-cell">
          <span className="aup-cell-label">Monitored Site</span>
          <span className="aup-cell-value">{siteName}</span>
          {siteAddress && <span className="aup-cell-sub">{siteAddress}</span>}
        </div>
        <div className="aup-summary-cell">
          <span className="aup-cell-label">Route / Target</span>
          <span className="aup-cell-value">{routeName}</span>
          <span className="aup-cell-sub">Shift: {shiftInfo}</span>
        </div>
        <div className="aup-summary-cell">
          <span className="aup-cell-label">Patrol Status</span>
          <span className="aup-cell-value">{report.status}</span>
        </div>
        <div className="aup-summary-cell">
          <span className="aup-cell-label">Start Time</span>
          <span className="aup-cell-value">{fmtDateTime(report.startedAt)}</span>
        </div>
        <div className="aup-summary-cell">
          <span className="aup-cell-label">End Time / Duration</span>
          <span className="aup-cell-value">{fmtDateTime(report.endedAt)}</span>
          <span className="aup-cell-sub">Duration: {durationMins}</span>
        </div>
      </div>

      {/* ── Inspection Summary ─────────────────────────────────────── */}
      <div className="aup-inspection-summary">
        <div className="aup-insp-stat">
          <div className="aup-insp-stat-label">Checkpoints</div>
          <div className="aup-insp-stat-value">{totalGates}</div>
        </div>
        <div className="aup-insp-stat green">
          <div className="aup-insp-stat-label">Scanned</div>
          <div className="aup-insp-stat-value">{scannedCount}</div>
        </div>
        <div className="aup-insp-stat">
          <div className="aup-insp-stat-label">Compliance</div>
          <div className="aup-insp-stat-value">{compliancePct}%</div>
        </div>
        <div className="aup-insp-stat">
          <div className="aup-insp-stat-label">Total Tasks</div>
          <div className="aup-insp-stat-value">{totalTasks}</div>
        </div>
        <div className="aup-insp-stat green">
          <div className="aup-insp-stat-label">YES</div>
          <div className="aup-insp-stat-value">{yesCount}</div>
        </div>
        <div className="aup-insp-stat red">
          <div className="aup-insp-stat-label">NO</div>
          <div className="aup-insp-stat-value">{noCount}</div>
        </div>
      </div>

      {/* ── Detailed Checkpoint Timeline ───────────────────────────── */}
      <h2 className="aup-section-title">Detailed Checkpoint Timeline</h2>

      {checkpointsTimeline.map((item, cpIdx) => {
        const tasksList = buildTaskList(item.subTaskResponses);
        const taskTotal = tasksList.length;
        const taskYes = tasksList.filter((t) => t.answer === 'YES').length;
        const taskNo = tasksList.filter((t) => t.answer === 'NO').length;
        const taskCompleted = taskYes + taskNo;

        return (
          <div key={`cp-${item.gate?.id || cpIdx}`} className="aup-checkpoint-card">
            {/* Checkpoint header */}
            <div className="aup-checkpoint-header">
              <div className="aup-cp-left">
                <span className="aup-cp-name">
                  Checkpoint {item.sequence} — {item.gate?.name || '—'}
                </span>
                <span className="aup-cp-code">
                  Gate Code: {item.gate?.gateCode || '—'}
                </span>
              </div>
              <div className="aup-cp-right">
                <span className={`aup-cp-status ${item.scanned ? 'scanned' : 'not-scanned'}`}>
                  {item.scanned ? '✓ SCANNED' : '✗ NOT SCANNED'}
                </span>
                {item.scanned && (
                  <>
                    <div className="aup-cp-time">Scanned Time: {fmtTime(item.scannedAt)}</div>
                    {item.scanCoords && (
                      <div className="aup-cp-gps">GPS: {item.scanCoords}</div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Checkpoint remarks */}
            {item.remarks && (
              <div className="aup-cp-remarks">
                <strong>Checkpoint Remarks:</strong> {item.remarks}
              </div>
            )}

            {/* Task Verification Checklist header */}
            {item.scanned && (
              <div className="aup-tasklist-header">
                <span className="aup-tasklist-title">
                  Task Verification Checklist — {taskTotal} {taskTotal === 1 ? 'Task' : 'Tasks'}
                </span>
                <div className="aup-tasklist-stats">
                  <span className="aup-badge blue">Completed: {taskCompleted} / {taskTotal}</span>
                  <span className="aup-badge green">YES: {taskYes}</span>
                  <span className="aup-badge red">NO: {taskNo}</span>
                  {taskTotal > 0 && (
                    <span className="aup-badge gray">
                      {Math.round((taskCompleted / taskTotal) * 100)}%
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Individual tasks */}
            {item.scanned && tasksList.length === 0 && (
              <div className="aup-no-tasks">No verification tasks recorded for this checkpoint.</div>
            )}

            {item.scanned && tasksList.map((res, taskIdx) => {
              const isYes = res.answer === 'YES';
              const isNo = res.answer === 'NO';

              const taskName = res.gateSubTask?.taskName || res.taskName || `Task ${taskIdx + 1}`;
              const taskDesc = res.gateSubTask?.description || res.description || null;
              const taskRole = res.gateSubTask?.role || res.role || 'SECURITY';
              const taskRequired = res.gateSubTask?.isRequired ?? res.isRequired ?? false;
              const taskRemarks = res.remarks || null;
              const taskImages: string[] = Array.isArray(res.images) ? res.images : [];
              const answeredAt = res.answeredAt || res.createdAt || null;

              const submittedBy =
                report.assignment?.employee
                  ? `${report.assignment.employee.firstName} ${report.assignment.employee.lastName}`
                  : '—';

              return (
                <div key={`task-${res.id || taskIdx}`} className="aup-task-row">
                  <div className="aup-task-top">
                    <div className="aup-task-left">
                      <div className="aup-task-number">Task {taskIdx + 1}</div>
                      <div className="aup-task-title">{taskName}</div>
                      {taskDesc && (
                        <div style={{ fontSize: '8pt', color: '#64748b', marginTop: '2px', wordWrap: 'break-word' }}>
                          {taskDesc}
                        </div>
                      )}
                      <div className="aup-task-meta">
                        <span className="aup-task-role">Role: {getRoleLabel(taskRole)}</span>
                        {taskRequired && (
                          <span className="aup-task-required">REQUIRED</span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`aup-answer-badge ${
                        isYes ? 'yes' : isNo ? 'no' : 'unanswered'
                      }`}
                    >
                      {isYes ? '✓ YES' : isNo ? '✗ NO' : 'UNANSWERED'}
                    </span>
                  </div>

                  {/* Remarks */}
                  {taskRemarks && (
                    <div className="aup-remarks-block">
                      <span className="aup-remarks-label">Employee Remarks:</span>
                      {taskRemarks}
                    </div>
                  )}

                  {/* Evidence images */}
                  {taskImages.length > 0 && (
                    <div className="aup-evidence-section">
                      <div className="aup-evidence-label">
                        Live Camera Evidence ({taskImages.length})
                      </div>
                      <div className="aup-evidence-grid">
                        {taskImages.map((imgUrl, imgIdx) => {
                          const src = resolveImageUrl(imgUrl);
                          if (!src) return null;
                          return (
                            <img
                              key={imgIdx}
                              src={src}
                              alt={`Task ${taskIdx + 1} evidence ${imgIdx + 1}`}
                              className="aup-evidence-img"
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Task footer: submitter, timestamp, voice note */}
                  <div className="aup-task-footer">
                    <div className="aup-task-footer-left">
                      <span>
                        Submitted By:{' '}
                        <span className="aup-task-submitter">{submittedBy}</span>
                      </span>
                      <span>Recorded: {fmtDateTime(answeredAt)}</span>
                    </div>
                    <span className="aup-voice-badge">Voice Note: None</span>
                  </div>
                </div>
              );
            })}

            {/* Not-scanned checkpoint */}
            {!item.scanned && (
              <div className="aup-no-tasks">This checkpoint was not scanned during this patrol session.</div>
            )}
          </div>
        );
      })}

      {/* ── Incidents ──────────────────────────────────────────────── */}
      {incidents.length > 0 && (
        <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
          <h2 className="aup-section-title" style={{ color: '#991b1b', borderLeftColor: '#dc2626', background: '#fee2e2' }}>
            Reported Incidents &amp; Hazards ({incidents.length})
          </h2>
          {incidents.map((inc: any, idx: number) => (
            <div key={inc.id || idx} className="aup-incident-block">
              <strong>{inc.type} ({inc.severity})</strong>
              {inc.description && <span>: {inc.description}</span>}
            </div>
          ))}
        </div>
      )}

      {/* ── Maintenance Snags & Defects ──────────────────────────── */}
      {snags.length > 0 && (
        <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
          <h2 className="aup-section-title" style={{ color: '#92400e', borderLeftColor: '#f59e0b', background: '#fef3c7' }}>
            Reported Maintenance Snags &amp; Defects ({snags.length})
          </h2>
          {snags.map((snag: any, idx: number) => {
            const checkpointName = snag.gate?.name || 'Checkpoint Verification';
            const checkpointCode = snag.gate?.gateCode ? `(${snag.gate.gateCode})` : '';
            const taskName = snag.category || snag.taskName || 'Maintenance Task';
            const taskDesc = snag.subCategory || snag.description || null;
            const priority = (snag.priority || 'MEDIUM').toUpperCase();
            const status = (snag.status || 'OPEN').toUpperCase();
            const role = getRoleLabel(snag.employeeRole || snag.role || 'CLEANER');
            const remarks = snag.remarks || snag.description || null;
            const source = snag.source || 'Mobile';
            const sessionCode = report.patrolCode || '—';

            return (
              <div key={snag.id || idx} className="aup-snag-card">
                <div className="aup-snag-card-header">
                  <span className="aup-snag-number">Snag #{idx + 1} — {checkpointName} {checkpointCode}</span>
                  <div className="aup-snag-badges">
                    <span className="aup-badge yellow">{priority} PRIORITY</span>
                    <span className="aup-badge blue">{status}</span>
                  </div>
                </div>

                <div className="aup-snag-body">
                  <div className="aup-snag-field">
                    <span className="aup-snag-field-label">Task</span>
                    <span className="aup-snag-field-value">{taskName}</span>
                  </div>

                  {taskDesc && taskDesc !== remarks && (
                    <div className="aup-snag-field">
                      <span className="aup-snag-field-label">Description</span>
                      <span className="aup-snag-field-value">{taskDesc}</span>
                    </div>
                  )}

                  <div className="aup-snag-field">
                    <span className="aup-snag-field-label">Employee Role</span>
                    <span className="aup-snag-field-value">{role}</span>
                  </div>

                  {remarks && (
                    <div className="aup-snag-field">
                      <span className="aup-snag-field-label">Remarks</span>
                      <div className="aup-snag-remarks">{remarks}</div>
                    </div>
                  )}

                  <div className="aup-snag-footer-row">
                    <span>Source: <strong>{source}</strong></span>
                    <span>Patrol Session: <strong>{sessionCode}</strong></span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return createPortal(printContent, document.body);
}
