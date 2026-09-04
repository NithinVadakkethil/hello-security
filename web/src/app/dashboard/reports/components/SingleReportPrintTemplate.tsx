'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { resolveImageUrl } from '../../../../lib/image';
import { isRoleMatching } from '../../../utils/role-matching';
import { formatPatrolDateTime, formatPatrolTime } from '@/lib/date-formatter';

interface SingleReportPrintTemplateProps {
  report: any;
}

// ─── Exact Print Template CSS (Matching attached PDF layout) ─────────────────
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
      color: #1e293b !important;
      overflow: visible !important;
      height: auto !important;
    }

    /* Hide all web application elements at root except our portaled print template */
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
      color: #1e293b !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 8.5pt;
      line-height: 1.4;
    }

    /* Page Margins & Container */
    @page {
      size: A4 portrait;
      margin: 8mm 8mm 10mm 8mm;
    }

    @page {
      @bottom-left {
        content: "Hello Orbit • Security Patrol Audit Report";
        font-size: 8pt;
        color: #475569;
        font-family: system-ui, -apple-system, sans-serif;
      }
      @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 8pt;
        color: #475569;
        font-family: system-ui, -apple-system, sans-serif;
      }
    }

    /* Top Brand Header */
    .rpt-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1.5px solid #0f172a;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .rpt-brand-title {
      font-size: 18pt;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      line-height: 1.1;
    }
    .rpt-brand-sub {
      font-size: 9pt;
      font-weight: 600;
      color: #475569;
      margin-top: 2px;
    }
    .rpt-header-right {
      text-align: right;
    }
    .rpt-ref-label {
      font-size: 7.5pt;
      font-weight: 700;
      color: #475569;
      letter-spacing: 0.5px;
    }
    .rpt-ref-code {
      font-size: 12pt;
      font-weight: 800;
      font-family: 'Courier New', monospace;
      color: #1d4ed8;
      margin: 1px 0;
    }
    .rpt-gen-date {
      font-size: 7.5pt;
      color: #64748b;
    }

    /* Section Headings */
    .rpt-section-heading {
      font-size: 8.5pt;
      font-weight: 800;
      color: #475569;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin: 8px 0 4px 0;
      break-after: avoid;
      page-break-after: avoid;
    }

    /* PATROL DETAILS Table */
    .rpt-details-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
      margin-bottom: 8px;
      border: 1px solid #cbd5e1;
    }
    .rpt-details-table td {
      padding: 4px 6px;
      border: 1px solid #cbd5e1;
      vertical-align: middle;
    }
    .rpt-details-label {
      font-weight: 600;
      color: #475569;
      width: 18%;
      background: #f8fafc;
    }
    .rpt-details-val {
      font-weight: 700;
      color: #0f172a;
      width: 32%;
    }

    /* Status Pills */
    .rpt-pill {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 7.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .rpt-pill.green { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .rpt-pill.yellow { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
    .rpt-pill.red { background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; }
    .rpt-pill.gray { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }

    /* Compliance KPI Summary Grid */
    .rpt-summary-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 4px;
      margin-bottom: 10px;
    }
    .rpt-kpi-box {
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      padding: 4px 2px;
      text-align: center;
      background: #ffffff;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .rpt-kpi-label {
      font-size: 7pt;
      font-weight: 700;
      color: #475569;
      margin-bottom: 2px;
    }
    .rpt-kpi-val {
      font-size: 11pt;
      font-weight: 800;
      color: #0f172a;
    }
    .rpt-kpi-val.blue { color: #1d4ed8; }
    .rpt-kpi-val.green { color: #15803d; }
    .rpt-kpi-val.red { color: #dc2626; }

    /* Detailed Checkpoint Timeline Cards */
    .rpt-cp-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      margin-bottom: 8px;
      overflow: visible;
    }
    .rpt-cp-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 5px 8px;
      background: #ffffff;
      border-bottom: 1px solid #cbd5e1;
      break-after: avoid;
      page-break-after: avoid;
    }
    .rpt-cp-header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .rpt-seq-pill {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 7.5pt;
      font-weight: 700;
    }
    .rpt-seq-pill.scanned { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .rpt-seq-pill.pending { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }

    .rpt-cp-name {
      font-size: 9.5pt;
      font-weight: 800;
      color: #0f172a;
    }
    .rpt-scan-time {
      font-size: 8pt;
      font-weight: 700;
      color: #15803d;
    }
    .rpt-pending-scan {
      font-size: 8pt;
      font-weight: 700;
      color: #b45309;
    }

    /* Checkpoint Sub-bar */
    .rpt-task-summary-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 8px;
      background: #f8fafc;
      border-bottom: 1px solid #cbd5e1;
      font-size: 7.5pt;
      font-weight: 700;
      color: #334155;
      break-after: avoid;
      page-break-after: avoid;
    }

    /* Checkpoint Remarks */
    .rpt-cp-remarks {
      padding: 4px 8px;
      background: #fefce8;
      border-bottom: 1px solid #fef08a;
      font-size: 7.5pt;
      color: #713f12;
      word-wrap: break-word;
      white-space: pre-wrap;
    }

    /* Task Card inside Checkpoint */
    .rpt-task-card {
      border: 1px solid #e2e8f0;
      border-radius: 5px;
      margin: 4px 6px;
      padding: 6px 8px;
      background: #ffffff;
    }
    .rpt-task-card.is-no {
      border: 1.5px solid #fca5a5;
    }
    .rpt-task-row1 {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .rpt-task-title {
      font-size: 8.5pt;
      color: #0f172a;
      line-height: 1.3;
    }
    .rpt-task-role {
      font-size: 7.5pt;
      color: #64748b;
      margin-left: 6px;
    }
    .rpt-task-req {
      font-size: 7.5pt;
      font-weight: 700;
      color: #dc2626;
      margin-left: 4px;
    }

    /* Result Pills */
    .rpt-result-pill {
      font-size: 7.5pt;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
      letter-spacing: 0.3px;
      flex-shrink: 0;
    }
    .rpt-result-pill.yes { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .rpt-result-pill.no { background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; }
    .rpt-result-pill.unanswered { background: #ffffff; color: #475569; border: 1px solid #cbd5e1; }

    /* Task Remarks & Evidence */
    .rpt-task-remarks {
      margin-top: 4px;
      padding: 4px 6px;
      background: #fffbeb;
      border-left: 3px solid #f59e0b;
      font-size: 7.5pt;
      color: #78350f;
      word-wrap: break-word;
      white-space: pre-wrap;
      height: auto;
      min-height: 0;
    }
    .rpt-task-remarks-head {
      font-size: 7pt;
      font-weight: 700;
      color: #b45309;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .rpt-task-evidence {
      margin-top: 4px;
    }
    .rpt-task-evidence-head {
      font-size: 7.5pt;
      font-weight: 700;
      color: #475569;
      margin-bottom: 3px;
    }
    .rpt-task-evidence-imgs {
      display: flex !important;
      flex-direction: row !important;
      flex-wrap: wrap !important;
      align-items: flex-start !important;
      gap: 6px !important;
      width: 100% !important;
    }
    .rpt-evidence-img,
    .rpt-task-evidence-imgs img {
      width: 80px !important;
      height: 80px !important;
      max-width: 80px !important;
      max-height: 80px !important;
      min-width: 80px !important;
      min-height: 80px !important;
      object-fit: cover !important;
      display: block !important;
      flex: 0 0 80px !important;
      border: 1px solid #cbd5e1 !important;
      border-radius: 4px !important;
      background: #f8fafc !important;
    }

    /* Task Meta Footer */
    .rpt-task-meta {
      display: flex;
      gap: 12px;
      font-size: 7.5pt;
      color: #64748b;
      margin-top: 4px;
      padding-top: 3px;
      border-top: 1px dashed #e2e8f0;
    }

    /* No Tasks Message */
    .rpt-no-tasks {
      padding: 6px 8px;
      font-size: 8pt;
      color: #64748b;
      font-style: italic;
    }

    /* Defect Card */
    .rpt-defect-card {
      border: 1px solid #fca5a5;
      background: #fef2f2;
      border-radius: 5px;
      padding: 8px 10px;
      font-size: 8pt;
      color: #991b1b;
      margin-bottom: 8px;
      break-inside: avoid;
      page-break-inside: avoid;
      word-wrap: break-word;
      white-space: pre-wrap;
    }

    /* Supervisor Box */
    .rpt-sup-box {
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      padding: 8px 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8.5pt;
      font-weight: 700;
      margin-bottom: 12px;
    }

    /* Patrol Summary Grid */
    .rpt-patrol-summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 16px;
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      padding: 8px 10px;
      font-size: 8.5pt;
      background: #f8fafc;
    }
  }
`;

// ─── Role label map ───────────────────────────────────────────────────────────
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
  return formatPatrolTime(dateStr);
}

function fmtDateTime(dateStr?: string | null): string {
  return formatPatrolDateTime(dateStr);
}



function getVerificationStatus(report: any): string {
  const status =
    report?.verificationStatus ||
    report?.verification_status ||
    report?.supervisorVerificationStatus ||
    'PENDING';
  return String(status).toUpperCase();
}

function getVerificationStatusPillClass(status: string): string {
  if (status === 'VERIFIED') return 'green';
  if (status === 'REJECTED' || status === 'NOT_VERIFIED') return 'red';
  return 'yellow';
}

// ─── Build Checkpoint Entry with combined configured tasks + responses ───────
function buildCheckpointEntry(
  sequence: number,
  gate: any,
  scan: any,
  guardName: string,
  officerRole: string,
) {
  const scanned = !!scan;
  const configuredTasks: any[] = Array.isArray(gate?.subTasks)
    ? gate.subTasks.filter((st: any) => isRoleMatching(st.role, officerRole))
    : [];
  const responses: any[] = Array.isArray(scan?.subTaskResponses)
    ? scan.subTaskResponses.filter((res: any) =>
        isRoleMatching(res.gateSubTask?.role || res.role, officerRole),
      )
    : [];

  const responseMap = new Map<string, any>();
  for (const res of responses) {
    const key = res.gateSubTaskId || res.id;
    if (key) responseMap.set(key, res);
  }

  const combinedTasks: any[] = [];

  if (configuredTasks.length > 0) {
    for (const st of configuredTasks) {
      const res = responseMap.get(st.id);
      if (res) {
        combinedTasks.push({
          id: st.id,
          title: st.taskName || 'Verification Task',
          role: st.role || 'SECURITY',
          isRequired: st.isRequired ?? false,
          answer: res.answer || 'UNANSWERED',
          remarks: res.remarks || null,
          images: Array.isArray(res.images) ? res.images : [],
          answeredAt: res.answeredAt || res.createdAt || null,
          submittedBy: guardName,
        });
      } else {
        combinedTasks.push({
          id: st.id,
          title: st.taskName || 'Verification Task',
          role: st.role || 'SECURITY',
          isRequired: st.isRequired ?? false,
          answer: 'UNANSWERED',
          remarks: null,
          images: [],
          answeredAt: null,
          submittedBy: guardName,
        });
      }
    }
  } else if (responses.length > 0) {
    for (const res of responses) {
      combinedTasks.push({
        id: res.id || res.gateSubTaskId,
        title: res.gateSubTask?.taskName || res.taskName || 'Verification Task',
        role: res.gateSubTask?.role || res.role || 'SECURITY',
        isRequired: res.gateSubTask?.isRequired ?? res.isRequired ?? false,
        answer: res.answer || 'UNANSWERED',
        remarks: res.remarks || null,
        images: Array.isArray(res.images) ? res.images : [],
        answeredAt: res.answeredAt || res.createdAt || null,
        submittedBy: guardName,
      });
    }
  }

  return {
    sequence,
    gate,
    scanned,
    scannedAt: scan?.scannedAt ?? null,
    remarks: scan?.remarks ?? null,
    status: scan?.status ?? null,
    tasks: combinedTasks,
  };
}

// ─── Build Timeline ──────────────────────────────────────────────────────────
function buildCheckpointTimeline(
  report: any,
  guardName: string,
  officerRole: string,
): any[] {
  const scans: any[] = report.checkpoints || [];

  const isDirectAssignment =
    (report.assignment as any)?.assignmentType === 'DIRECT_CHECKPOINTS' ||
    (!report.assignment?.patrolRoute &&
      report.assignment?.assignmentGates &&
      report.assignment.assignmentGates.length > 0);

  const routeGates: any[] = isDirectAssignment
    ? (report.assignment?.assignmentGates || [])
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
        return buildCheckpointEntry(
          rg.sequence,
          rg.gate,
          scan,
          guardName,
          officerRole,
        );
      });
  }

  const seen = new Set<string>();
  return scans
    .filter((scan: any) => {
      if (!scan.id || seen.has(scan.id)) return false;
      seen.add(scan.id);
      return true;
    })
    .map((scan: any, idx: number) => {
      const gate = scan.gate || {
        id: scan.gateId,
        name: scan.gate?.name || `Checkpoint ${idx + 1}`,
        gateCode: scan.gate?.gateCode || '—',
      };
      return buildCheckpointEntry(idx + 1, gate, scan, guardName, officerRole);
    });
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function SingleReportPrintTemplate({
  report,
}: SingleReportPrintTemplateProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!report || !mounted) return null;

  const guardName = report.assignment?.employee
    ? `${report.assignment.employee.firstName} ${report.assignment.employee.lastName}`
    : '';

  const officerRole =
    report.assignment?.employee?.role || report.employeeRole || 'SECURITY';

  const checkpointsTimeline = buildCheckpointTimeline(
    report,
    guardName,
    officerRole,
  );
  const incidents = report.incidents || [];
  const snags = report.snags || [];

  const totalGates = checkpointsTimeline.length;
  const scannedCount = checkpointsTimeline.filter((c) => c.scanned).length;
  const gateCompliancePct =
    totalGates > 0 ? Math.round((scannedCount / totalGates) * 100) : 100;

  let allTasksTotal = 0,
    allTasksYes = 0,
    allTasksNo = 0,
    allTasksCompleted = 0;
  for (const cp of checkpointsTimeline) {
    allTasksTotal += cp.tasks.length;
    for (const t of cp.tasks) {
      if (t.answer === 'YES') {
        allTasksYes++;
        allTasksCompleted++;
      }
      if (t.answer === 'NO') {
        allTasksNo++;
        allTasksCompleted++;
      }
    }
  }
  const taskCompliancePct =
    allTasksTotal > 0 ? Math.round((allTasksYes / allTasksTotal) * 100) : 100;
  const totalIssuesCount = snags.length + incidents.length;

  const employeeId = report.assignment?.employee?.employeeNumber;
  const siteName = report.assignment?.site?.name;
  const routeName =
    report.assignment?.patrolRoute?.name || 'Direct Checkpoints';
  const shiftInfo = report.assignment?.shift
    ? `Day (${report.assignment.shift.startTime} - ${report.assignment.shift.endTime})`
    : 'Day (06:00 - 5:59)';

  const clientCompanyName =
    report.client?.companyName ||
    report.assignment?.client?.companyName ||
    report.assignment?.site?.client?.companyName ||
    report.assignment?.site?.companyName ||
    report.clientCompanyName ||
    '—';

  const generatedAt = formatPatrolDateTime(new Date());

  const verificationStatus = getVerificationStatus(report);
  const verificationPillClass = getVerificationStatusPillClass(verificationStatus);

  const printContent = (
    <div className="audit-report-print-root">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      {/* ── Top Header ────────────────────────────────────────────────── */}
      <div className="rpt-header">
        <div>
          <h1 className="rpt-brand-title">Hello Orbit</h1>
          <div className="rpt-brand-sub">Security Patrol Audit Report</div>
        </div>
        <div className="rpt-header-right">
          <div className="rpt-ref-label">REPORT REFERENCE #</div>
          <div className="rpt-ref-code">{report.patrolCode}</div>
          <div className="rpt-gen-date">Generated: {generatedAt}</div>
        </div>
      </div>

      {/* ── PATROL DETAILS Table ─────────────────────────────────────── */}
      <div className="rpt-section-heading">PATROL DETAILS</div>
      <table className="rpt-details-table">
        <tbody>
          <tr>
            <td className="rpt-details-label">Security Officer</td>
            <td className="rpt-details-val">{guardName}</td>
            <td className="rpt-details-label">Company Name</td>
            <td className="rpt-details-val">{clientCompanyName}</td>
          </tr>
          <tr>
            <td className="rpt-details-label">Employee ID</td>
            <td className="rpt-details-val">{employeeId}</td>
            <td className="rpt-details-label">Monitored Site</td>
            <td className="rpt-details-val">{siteName}</td>
          </tr>
          <tr>
            <td className="rpt-details-label">Role</td>
            <td className="rpt-details-val">
              {officerRole === 'CLEANER' ? 'House Keeper' : officerRole}
            </td>
            <td className="rpt-details-label">Shift</td>
            <td className="rpt-details-val">{shiftInfo}</td>
          </tr>
          <tr>
            <td className="rpt-details-label">Route / Target</td>
            <td className="rpt-details-val">{routeName}</td>
            <td className="rpt-details-label">Supervisor Status</td>
            <td className="rpt-details-val">
              <span className={`rpt-pill ${verificationPillClass}`}>
                {verificationStatus}
              </span>
            </td>
          </tr>
          <tr>
            <td className="rpt-details-label">Started</td>
            <td className="rpt-details-val">{fmtDateTime(report.startedAt)}</td>
            <td className="rpt-details-label">Patrol Status</td>
            <td className="rpt-details-val">
              <span
                className={`rpt-pill ${report.status === 'COMPLETED' ? 'green' : 'yellow'}`}
              >
                {report.status}
              </span>
            </td>
          </tr>
          <tr>
            <td className="rpt-details-label">Completed</td>
            <td className="rpt-details-val">{fmtDateTime(report.endedAt)}</td>
            <td className="rpt-details-label">Compliance / Score</td>
            <td className="rpt-details-val" style={{ color: '#1d4ed8' }}>
              {gateCompliancePct}% ({scannedCount} / {totalGates})
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── PATROL COMPLIANCE SUMMARY (KPI Grid) ─────────────────────── */}
      <div className="rpt-section-heading">PATROL COMPLIANCE SUMMARY</div>
      <div className="rpt-summary-grid">
        <div className="rpt-kpi-box">
          <div className="rpt-kpi-label">Scanned Gates</div>
          <div className="rpt-kpi-val">
            {scannedCount} / {totalGates}
          </div>
        </div>
        <div className="rpt-kpi-box">
          <div className="rpt-kpi-label">Gate Compliance</div>
          <div className="rpt-kpi-val blue">{gateCompliancePct}%</div>
        </div>
        <div className="rpt-kpi-box">
          <div className="rpt-kpi-label">Task Compliance</div>
          <div className="rpt-kpi-val blue">{taskCompliancePct}%</div>
        </div>
        <div className="rpt-kpi-box">
          <div className="rpt-kpi-label">Completed</div>
          <div className="rpt-kpi-val green">{allTasksYes}</div>
        </div>
        <div className="rpt-kpi-box">
          <div className="rpt-kpi-label">Not Completed</div>
          <div className="rpt-kpi-val red">{allTasksNo}</div>
        </div>
        <div className="rpt-kpi-box">
          <div className="rpt-kpi-label">Issues Reported</div>
          <div className="rpt-kpi-val red">{totalIssuesCount}</div>
        </div>
      </div>

      {/* ── DETAILED CHECKPOINT TIMELINE ────────────────────────────── */}
      <div className="rpt-section-heading">DETAILED CHECKPOINT TIMELINE</div>

      {checkpointsTimeline.map((item, cpIdx) => {
        const tasksList = item.tasks;
        const taskTotal = tasksList.length;
        const taskYes = tasksList.filter((t: any) => t.answer === 'YES').length;
        const taskNo = tasksList.filter((t: any) => t.answer === 'NO').length;
        const taskCompleted = taskYes + taskNo;
        const taskCompliance =
          taskTotal > 0 ? Math.round((taskYes / taskTotal) * 100) : 100;

        return (
          <div key={`cp-${item.gate?.id || cpIdx}`} className="rpt-cp-card">
            {/* Header bar */}
            <div className="rpt-cp-header">
              <div className="rpt-cp-header-left">
                <span
                  className={`rpt-seq-pill ${item.scanned ? 'scanned' : 'pending'}`}
                >
                  Seq #{item.sequence} — {item.scanned ? 'SCANNED' : 'PENDING'}
                </span>
                <span className="rpt-cp-name">
                  {item.gate?.name} ({item.gate?.gateCode})
                </span>
              </div>
              <div>
                {item.scanned ? (
                  <span className="rpt-scan-time">
                    Scan Time: {fmtTime(item.scannedAt)}
                  </span>
                ) : (
                  <span className="rpt-pending-scan">⏳ PENDING SCAN</span>
                )}
              </div>
            </div>

            {/* Sub-header bar */}
            <div className="rpt-task-summary-bar">
              <span>Task Verification Checklist</span>
              <span>
                Completed: {taskCompleted} / {taskTotal} | YES: {taskYes} | NO:{' '}
                {taskNo} | Compliance: {taskCompliance}%
              </span>
            </div>

            {/* Checkpoint remarks */}
            {item.remarks && (
              <div className="rpt-cp-remarks">
                <strong>Checkpoint Remarks:</strong> {item.remarks}
              </div>
            )}

            {/* Tasks list */}
            {tasksList.length === 0 ? (
              <div className="rpt-no-tasks">
                No inspection tasks were configured for this checkpoint.
              </div>
            ) : (
              tasksList.map((t: any, tIdx: number) => (
                <div
                  key={`t-${t.id || tIdx}`}
                  className={`rpt-task-card ${t.answer === 'NO' ? 'is-no' : ''}`}
                >
                  <div className="rpt-task-row1">
                    <div className="rpt-task-title">
                      <strong>
                        {tIdx + 1}. {t.title}
                      </strong>
                      {/* <span className="rpt-task-role">
                        Role: {getRoleLabel(t.role)}
                      </span>
                      {t.isRequired && (
                        <span className="rpt-task-req">Required</span>
                      )} */}
                    </div>
                    <div>
                      {t.answer === 'YES' && (
                        <span className="rpt-result-pill yes">
                          All in Order
                        </span>
                      )}
                      {t.answer === 'NO' && (
                        <span className="rpt-result-pill no">Not in Order</span>
                      )}
                      {t.answer === 'UNANSWERED' && (
                        <span className="rpt-result-pill unanswered">
                          UNANSWERED
                        </span>
                      )}
                    </div>
                  </div>

                  {t.remarks && (
                    <div className="rpt-task-remarks">
                      <div className="rpt-task-remarks-head">
                        Employee Remarks:
                      </div>
                      <div>{t.remarks}</div>
                    </div>
                  )}

                  {t.images && t.images.length > 0 && (
                    <div className="rpt-task-evidence">
                      <div className="rpt-task-evidence-head">EVIDENCE:</div>
                      <div className="rpt-task-evidence-imgs">
                        {t.images.map((imgUrl: string, imgIdx: number) => (
                          <img
                            key={imgIdx}
                            src={resolveImageUrl(imgUrl)}
                            alt="Evidence"
                            className="rpt-evidence-img"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rpt-task-meta">
                    {/* <span>
                      Submitted by: <strong>{t.submittedBy}</strong>
                    </span> */}
                    {t.answeredAt && (
                      <span>Recorded: {fmtDateTime(t.answeredAt)}</span>
                    )}
                    <span>Voice Note: None</span>
                  </div>
                </div>
              ))
            )}
          </div>
        );
      })}

      {/* ── REPORTED ISSUES & MAINTENANCE DEFECTS ───────────────────── */}
      {snags.length > 0 && (
        <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid', marginTop: '14px' }}>
          <div className="rpt-section-heading">
            REPORTED ISSUES &amp; MAINTENANCE SNAG LIFECYCLE ({snags.length})
          </div>
          {snags.map((snag: any, idx: number) => {
            const snagIdDisplay = `SNAG-${snag.id.slice(-6).toUpperCase()}`;
            const reporterName = snag.employee
              ? `${snag.employee.firstName} ${snag.employee.lastName || ''}`.trim()
              : 'Security Officer';
            const reporterEmpId = snag.employee?.employeeNumber || '—';
            const beforeImages = Array.isArray(snag.images) ? snag.images : [];

            // Assignment details
            const latestAssignment = Array.isArray(snag.assignments) && snag.assignments.length > 0 ? snag.assignments[0] : null;
            const assignedTechName = latestAssignment?.assignedTo?.employee
              ? `${latestAssignment.assignedTo.employee.firstName} ${latestAssignment.assignedTo.employee.lastName || ''}`.trim()
              : latestAssignment?.assignedTo?.email || null;
            const assignedTechEmpId = latestAssignment?.assignedTo?.employee?.employeeNumber || '—';
            const assignedTechRole = getRoleLabel(latestAssignment?.assignedTo?.role || latestAssignment?.assignedTo?.employee?.role || 'TECHNICIAN');
            const assignedByAdmin = latestAssignment?.assignedBy?.employee
              ? `${latestAssignment.assignedBy.employee.firstName} ${latestAssignment.assignedBy.employee.lastName || ''}`.trim()
              : 'Admin';
            const assignedAtTime = latestAssignment?.createdAt ? fmtDateTime(latestAssignment.createdAt) : null;

            // Technician resolution history
            const completionEntry = Array.isArray(snag.history)
              ? snag.history.find((h: any) => h.action === 'RESOLVED' || h.newState === 'RESOLVED')
              : null;
            const techUser = completionEntry?.user;
            const completedTechName = techUser?.employee
              ? `${techUser.employee.firstName} ${techUser.employee.lastName || ''}`.trim()
              : techUser?.email || assignedTechName;
            const completedTechEmpId = techUser?.employee?.employeeNumber || assignedTechEmpId;

            const repairResult =
              snag.status === 'RESOLVED' || snag.status === 'CLOSED'
                ? 'PASS'
                : snag.status === 'REJECTED'
                ? 'FAIL'
                : 'PENDING';

            const techRemarks = completionEntry?.notes || (snag.status === 'RESOLVED' ? 'Technician completed repair job and verified checkpoint QR.' : null);
            const afterImages = completionEntry?.images || [];

            return (
              <div
                key={snag.id || idx}
                style={{
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  marginBottom: '12px',
                  background: '#ffffff',
                  breakInside: 'avoid',
                  pageBreakInside: 'avoid',
                }}
              >
                {/* Header Bar */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #e2e8f0',
                    paddingBottom: '6px',
                    marginBottom: '8px',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '8pt', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                      SNAG REPORT #{snagIdDisplay}
                    </span>
                    <span style={{ fontSize: '7.5pt', color: '#64748b', marginLeft: '8px' }}>
                      Checkpoint: <strong>{snag.gate?.name || 'Gate'} ({snag.gate?.gateCode || '—'})</strong>
                    </span>
                  </div>
                  <div>
                    <span
                      style={{
                        fontSize: '7pt',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: snag.priority === 'HIGH' ? '#fee2e2' : '#fef3c7',
                        color: snag.priority === 'HIGH' ? '#dc2626' : '#d97706',
                        border: `1px solid ${snag.priority === 'HIGH' ? '#fca5a5' : '#fde68a'}`,
                      }}
                    >
                      {snag.priority || 'NORMAL'} PRIORITY
                    </span>
                    <span
                      style={{
                        fontSize: '7pt',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        marginLeft: '6px',
                        backgroundColor:
                          snag.status === 'RESOLVED' || snag.status === 'CLOSED'
                            ? '#dcfce7'
                            : snag.status === 'ASSIGNED'
                            ? '#dbeafe'
                            : '#f1f5f9',
                        color:
                          snag.status === 'RESOLVED' || snag.status === 'CLOSED'
                            ? '#15803d'
                            : snag.status === 'ASSIGNED'
                            ? '#1d4ed8'
                            : '#475569',
                        border: `1px solid ${
                          snag.status === 'RESOLVED' || snag.status === 'CLOSED'
                            ? '#86efac'
                            : snag.status === 'ASSIGNED'
                            ? '#93c5fd'
                            : '#cbd5e1'
                        }`,
                      }}
                    >
                      FINAL STATUS: {snag.status}
                    </span>
                  </div>
                </div>

                {/* SECTION 1: ORIGINAL SNAG REPORT */}
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '8px 10px', marginBottom: '8px' }}>
                  <div style={{ fontSize: '7.5pt', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', marginBottom: '4px' }}>
                    1. ORIGINAL GUARD INSPECTION REPORT
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '7.5pt', color: '#334155', marginBottom: '6px' }}>
                    <div>Reported By: <strong>{reporterName}</strong> (ID: {reporterEmpId})</div>
                    <div>Reported At: <strong>{fmtDateTime(snag.createdAt)}</strong></div>
                    <div>Category: <strong>{snag.category}</strong> {snag.subCategory ? `• ${snag.subCategory}` : ''}</div>
                    <div>Initial Status: <strong>{snag.status}</strong></div>
                  </div>
                  <div style={{ fontSize: '7.5pt', color: '#1e293b', fontStyle: 'italic', marginBottom: '6px' }}>
                    "{snag.description}"
                  </div>

                  {/* BEFORE REPAIR PHOTO */}
                  <div style={{ marginTop: '6px' }}>
                    <div style={{ fontSize: '7pt', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                      BEFORE REPAIR PHOTO (Original Guard Evidence):
                    </div>
                    {beforeImages.length > 0 ? (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {beforeImages.map((imgUrl: string, imgIdx: number) => (
                          <div key={imgIdx} style={{ textAlign: 'center' }}>
                            <img src={resolveImageUrl(imgUrl)} alt="Before Repair" style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                            <div style={{ fontSize: '6.5pt', color: '#64748b', marginTop: '2px' }}>Reported by {reporterName}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '7.5pt', fontStyle: 'italic', color: '#94a3b8' }}>No before-repair photo available</div>
                    )}
                  </div>
                </div>

                {/* SECTION 2: SNAG ASSIGNMENT (If assigned) */}
                {latestAssignment ? (
                  <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '8px 10px', marginBottom: '8px' }}>
                    <div style={{ fontSize: '7.5pt', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', marginBottom: '4px' }}>
                      2. SNAG ASSIGNMENT
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '7.5pt', color: '#1e3a8a' }}>
                      <div>Assigned To: <strong>{assignedTechName}</strong> (ID: {assignedTechEmpId})</div>
                      <div>Assigned Role: <strong>{assignedTechRole}</strong></div>
                      <div>Assigned By: <strong>{assignedByAdmin}</strong></div>
                      <div>Assigned At: <strong>{assignedAtTime}</strong></div>
                      <div>Assignment Status: <strong>{latestAssignment.status || 'ASSIGNED'}</strong></div>
                    </div>
                  </div>
                ) : (
                  <div style={{ backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '4px', padding: '6px 10px', marginBottom: '8px', fontSize: '7.5pt', color: '#64748b', fontStyle: 'italic' }}>
                    Snag Assignment: Unassigned (Pending Admin Assignment)
                  </div>
                )}

                {/* SECTION 3: TECHNICIAN REPAIR VERIFICATION */}
                <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px', padding: '8px 10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '7.5pt', fontWeight: 800, color: '#15803d', textTransform: 'uppercase' }}>
                      3. TECHNICIAN REPAIR VERIFICATION & RESOLUTION
                    </span>
                    <span
                      style={{
                        fontSize: '7pt',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: repairResult === 'PASS' ? '#dcfce7' : repairResult === 'FAIL' ? '#fee2e2' : '#fef3c7',
                        color: repairResult === 'PASS' ? '#15803d' : repairResult === 'FAIL' ? '#dc2626' : '#d97706',
                        border: `1px solid ${repairResult === 'PASS' ? '#86efac' : repairResult === 'FAIL' ? '#fca5a5' : '#fde68a'}`,
                      }}
                    >
                      REPAIR RESULT: {repairResult}
                    </span>
                  </div>

                  {repairResult !== 'PENDING' ? (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '7.5pt', color: '#14532d', marginBottom: '6px' }}>
                        <div>Technician: <strong>{completedTechName}</strong> (ID: {completedTechEmpId})</div>
                        <div>Verified At: <strong>{fmtDateTime(completionEntry?.createdAt || snag.updatedAt)}</strong></div>
                      </div>

                      {techRemarks && (
                        <div style={{ marginTop: '4px', marginBottom: '6px' }}>
                          <div style={{ fontSize: '7pt', fontWeight: 700, color: '#166534', textTransform: 'uppercase', marginBottom: '2px' }}>
                            TECHNICIAN ACTION & REMARKS:
                          </div>
                          <div style={{ fontSize: '7.5pt', color: '#14532d', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '6px 8px', whiteSpace: 'pre-wrap' }}>
                            {techRemarks}
                          </div>
                        </div>
                      )}

                      {/* AFTER REPAIR PHOTO */}
                      <div style={{ marginTop: '6px' }}>
                        <div style={{ fontSize: '7pt', fontWeight: 700, color: '#166534', textTransform: 'uppercase', marginBottom: '4px' }}>
                          AFTER REPAIR PHOTO (Technician Completion Evidence):
                        </div>
                        {afterImages.length > 0 ? (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {afterImages.map((imgUrl: string, imgIdx: number) => (
                              <div key={imgIdx} style={{ textAlign: 'center' }}>
                                <img src={resolveImageUrl(imgUrl)} alt="After Repair" style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #86efac' }} />
                                <div style={{ fontSize: '6.5pt', color: '#15803d', marginTop: '2px' }}>Uploaded by {completedTechName}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: '7.5pt', fontStyle: 'italic', color: '#64748b' }}>No after-repair photo attached</div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '7.5pt', fontStyle: 'italic', color: '#64748b' }}>
                      Repair Verification: PENDING (Technician repair verification not yet submitted)
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── SUPERVISOR VERIFICATION ──────────────────────────────────── */}
      <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <div className="rpt-section-heading">SUPERVISOR VERIFICATION</div>
        <div className="rpt-sup-box">
          <span>Verification Status</span>
          <span className={`rpt-pill ${verificationPillClass}`}>
            {verificationStatus}
          </span>
        </div>
        {report.supervisorRemarks && (
          <div style={{ marginTop: '6px', fontSize: '8pt', color: '#475569' }}>
            <strong>Supervisor Remarks:</strong> {report.supervisorRemarks}
          </div>
        )}
      </div>

      {/* ── PATROL SUMMARY ───────────────────────────────────────────── */}
      <div style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <div className="rpt-section-heading">PATROL SUMMARY</div>
        <div className="rpt-patrol-summary-grid">
          <div>
            Total Checkpoints: <strong>{totalGates}</strong>
          </div>
          <div>
            Scanned Checkpoints: <strong>{scannedCount}</strong>
          </div>
          <div>
            Completed Tasks:{' '}
            <strong>
              {allTasksCompleted} / {allTasksTotal}
            </strong>
          </div>
          <div>
            YES / NO Responses:{' '}
            <strong>
              YES: {allTasksYes} | NO: {allTasksNo}
            </strong>
          </div>
          <div>
            Overall Compliance: <strong>{taskCompliancePct}%</strong>
          </div>
          <div>
            Patrol Status: <strong>{report.status}</strong>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(printContent, document.body);
}
