import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { AppError } from '../../common/errors/AppError';
import { ErrorCodes } from '../../common/errors/ErrorCodes';
import { HttpStatus } from '../../common/errors/HttpStatus';
import { isRoleMatching } from '../../common/utils/role-matching';
import { reportRepository } from './report.repository';
import { ReportQueryDto } from './report.types';

// ─── Image Resolver Helper ───────────────────────────────────────────────────
export function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('data:')) {
    return trimmed;
  }

  if (trimmed.startsWith('/9j/')) return `data:image/jpeg;base64,${trimmed}`;
  if (trimmed.startsWith('iVBOR')) return `data:image/png;base64,${trimmed}`;
  if (trimmed.startsWith('R0lG')) return `data:image/gif;base64,${trimmed}`;
  if (trimmed.startsWith('UklGR')) return `data:image/webp;base64,${trimmed}`;

  // If relative path, try reading from disk directly to convert to data URI for Puppeteer
  const cleanPath = trimmed.replace(/^https?:\/\/[^\/]+/, '').replace(/^\/+/, '');
  const possibleLocalPaths = [
    path.join(process.cwd(), cleanPath),
    path.join(process.cwd(), 'public', cleanPath),
    path.join(process.cwd(), 'uploads', cleanPath),
    path.join(process.cwd(), 'api', 'uploads', cleanPath.replace(/^uploads\//, '')),
    path.join('/Users/zinfogcodelabs/Documents/Projects/hello-security/api/uploads', cleanPath.replace(/^uploads\//, '')),
  ];

  for (const localPath of possibleLocalPaths) {
    if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
      try {
        const fileBuf = fs.readFileSync(localPath);
        const ext = path.extname(localPath).toLowerCase().replace('.', '') || 'jpeg';
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        return `data:${mime};base64,${fileBuf.toString('base64')}`;
      } catch (e) {
        // ignore read error
      }
    }
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  const baseUrl = (process.env.API_URL || 'http://localhost:3001/api/v1').replace(/\/+api\/v1\/?$/, '').replace(/\/+$/, '');
  return `${baseUrl}/${cleanPath}`;
}

// ─── Image Deduplication Helper ──────────────────────────────────────────────
export function deduplicateImages(images: any[]): string[] {
  if (!Array.isArray(images)) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const img of images) {
    if (!img || typeof img !== 'string') continue;
    const trimmed = img.trim();
    if (!trimmed) continue;

    // Deduplicate by normalized path / identity
    const key = trimmed.replace(/^https?:\/\/[^\/]+/, '').replace(/^data:image\/[^;]+;base64,/, '').slice(0, 100);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(trimmed);
    }
  }

  return result;
}

// ─── Role Labels ──────────────────────────────────────────────────────────────
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

function fmtTime(dateStr?: any): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleTimeString();
  } catch {
    return '—';
  }
}

function fmtDateTime(dateStr?: any): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return '—';
  }
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
          images: deduplicateImages(Array.isArray(res.images) ? res.images : []),
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
        images: deduplicateImages(Array.isArray(res.images) ? res.images : []),
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

function buildCheckpointTimeline(
  report: any,
  guardName: string,
  officerRole: string,
): any[] {
  const scans: any[] = report.checkpoints || [];

  const routeGates: any[] =
    report.assignment?.assignmentGates &&
    report.assignment.assignmentGates.length > 0
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

function findChromeExecutable(): string | undefined {
  const possiblePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

export class ReportService {
  async getAnalytics(clientId: string | undefined, query: ReportQueryDto) {
    return reportRepository.getAnalytics(clientId, query);
  }

  async getInspectionReports(clientId: string | undefined, query: ReportQueryDto) {
    return reportRepository.findInspectionReports(clientId, query);
  }

  async getSingleInspectionReport(id: string, clientId?: string) {
    const session = await reportRepository.findSingleInspectionReport(id, clientId);
    if (!session) {
      throw new AppError(
        HttpStatus.NOT_FOUND,
        ErrorCodes.NOT_FOUND,
        'Patrol report not found.',
      );
    }
    return session;
  }

  async generateCsv(clientId: string | undefined, query: ReportQueryDto) {
    const result = await reportRepository.findInspectionReports(clientId, {
      ...query,
      page: 1,
      limit: 1000,
    });

    const headers = [
      'Report ID',
      'Patrol Code',
      'Inspection Date',
      'Guard Name',
      'Employee Code',
      'Site Name',
      'Route / Target',
      'Status',
      'Duration (Mins)',
      'Scanned Checkpoints',
      'Total Checkpoints',
      'Compliance %',
      'Incidents Reported',
      'Remarks',
    ];

    const rows = result.data.map((session) => {
      const guardName = `${session.assignment?.employee?.firstName || ''} ${session.assignment?.employee?.lastName || ''}`.trim();
      const empCode = session.assignment?.employee?.employeeNumber || 'N/A';
      const siteName = session.assignment?.site?.name || 'N/A';
      const routeName = session.assignment?.patrolRoute?.name || 'Direct Checkpoints';
      const uniqueGateIds = new Set(session.checkpoints.map((cp) => cp.gateId).filter(Boolean));
      const scannedCount = uniqueGateIds.size;
      const totalGates = session.assignment?.patrolRoute?.routeGates?.length || session.assignment?.assignmentGates?.length || 0;
      const compliance = totalGates > 0 ? Math.round((scannedCount / totalGates) * 100) : 100;
      const durationMins = session.totalDuration ? Math.round(session.totalDuration / 60) : 0;
      const incidentCount = session.incidents?.length || 0;

      return [
        session.id,
        session.patrolCode,
        new Date(session.startedAt).toLocaleString(),
        `"${guardName.replace(/"/g, '""')}"`,
        empCode,
        `"${siteName.replace(/"/g, '""')}"`,
        `"${routeName.replace(/"/g, '""')}"`,
        session.status,
        durationMins,
        scannedCount,
        totalGates,
        `${compliance}%`,
        incidentCount,
        `"${(session.remarks || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  buildPatrolReportHtml(report: any): string {
    const guardName = report.assignment?.employee
      ? `${report.assignment.employee.firstName} ${report.assignment.employee.lastName || ''}`.trim()
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

    const employeeId = report.assignment?.employee?.employeeNumber || '—';
    const siteName = report.assignment?.site?.name || '—';
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

    const generatedAt = new Date().toLocaleString();
    const verificationStatus = getVerificationStatus(report);
    const verificationPillClass = getVerificationStatusPillClass(verificationStatus);

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Patrol Audit Report - ${report.patrolCode}</title>
  <style>
    @page {
      size: A4;
      margin: 8mm 8mm 10mm 8mm;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #1e293b !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 8.5pt;
      line-height: 1.35;
    }
    .audit-report-print-root {
      display: block !important;
      position: static !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      background: #ffffff !important;
      color: #1e293b !important;
    }
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
    .rpt-cp-remarks {
      padding: 4px 8px;
      background: #fefce8;
      border-bottom: 1px solid #fef08a;
      font-size: 7.5pt;
      color: #713f12;
      word-wrap: break-word;
      white-space: pre-wrap;
    }
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
    .rpt-task-meta {
      display: flex;
      gap: 12px;
      font-size: 7.5pt;
      color: #64748b;
      margin-top: 4px;
      padding-top: 3px;
      border-top: 1px dashed #e2e8f0;
    }
    .rpt-no-tasks {
      padding: 6px 8px;
      font-size: 8pt;
      color: #64748b;
      font-style: italic;
    }
    .rpt-sup-box {
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      padding: 6px 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8.5pt;
      font-weight: 700;
      margin-bottom: 8px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .rpt-patrol-summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 12px;
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      padding: 6px 8px;
      font-size: 8.5pt;
      background: #f8fafc;
      break-inside: avoid;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  <div class="audit-report-print-root">
    <!-- Top Header -->
    <div class="rpt-header">
      <div>
        <h1 class="rpt-brand-title">Hello Orbit</h1>
        <div class="rpt-brand-sub">Security Patrol Audit Report</div>
      </div>
      <div class="rpt-header-right">
        <div class="rpt-ref-label">REPORT REFERENCE #</div>
        <div class="rpt-ref-code">${report.patrolCode}</div>
        <div class="rpt-gen-date">Generated: ${generatedAt}</div>
      </div>
    </div>

    <!-- PATROL DETAILS Table -->
    <div class="rpt-section-heading">PATROL DETAILS</div>
    <table class="rpt-details-table">
      <tbody>
        <tr>
          <td class="rpt-details-label">Security Officer</td>
          <td class="rpt-details-val">${guardName}</td>
          <td class="rpt-details-label">Company Name</td>
          <td class="rpt-details-val">${clientCompanyName}</td>
        </tr>
        <tr>
          <td class="rpt-details-label">Employee ID</td>
          <td class="rpt-details-val">${employeeId}</td>
          <td class="rpt-details-label">Monitored Site</td>
          <td class="rpt-details-val">${siteName}</td>
        </tr>
        <tr>
          <td class="rpt-details-label">Role</td>
          <td class="rpt-details-val">${officerRole === 'CLEANER' ? 'House Keeper' : officerRole}</td>
          <td class="rpt-details-label">Shift</td>
          <td class="rpt-details-val">${shiftInfo}</td>
        </tr>
        <tr>
          <td class="rpt-details-label">Route / Target</td>
          <td class="rpt-details-val">${routeName}</td>
          <td class="rpt-details-label">Supervisor Status</td>
          <td class="rpt-details-val">
            <span class="rpt-pill ${verificationPillClass}">
              ${verificationStatus}
            </span>
          </td>
        </tr>
        <tr>
          <td class="rpt-details-label">Started</td>
          <td class="rpt-details-val">${fmtDateTime(report.startedAt)}</td>
          <td class="rpt-details-label">Patrol Status</td>
          <td class="rpt-details-val">
            <span class="rpt-pill ${report.status === 'COMPLETED' ? 'green' : 'yellow'}">
              ${report.status}
            </span>
          </td>
        </tr>
        <tr>
          <td class="rpt-details-label">Completed</td>
          <td class="rpt-details-val">${fmtDateTime(report.endedAt)}</td>
          <td class="rpt-details-label">Compliance / Score</td>
          <td class="rpt-details-val" style="color: #1d4ed8;">
            ${gateCompliancePct}% (${scannedCount} / ${totalGates})
          </td>
        </tr>
      </tbody>
    </table>

    <!-- PATROL COMPLIANCE SUMMARY (KPI Grid) -->
    <div class="rpt-section-heading">PATROL COMPLIANCE SUMMARY</div>
    <div class="rpt-summary-grid">
      <div class="rpt-kpi-box">
        <div class="rpt-kpi-label">Scanned Gates</div>
        <div class="rpt-kpi-val">${scannedCount} / ${totalGates}</div>
      </div>
      <div class="rpt-kpi-box">
        <div class="rpt-kpi-label">Gate Compliance</div>
        <div class="rpt-kpi-val blue">${gateCompliancePct}%</div>
      </div>
      <div class="rpt-kpi-box">
        <div class="rpt-kpi-label">Task Compliance</div>
        <div class="rpt-kpi-val blue">${taskCompliancePct}%</div>
      </div>
      <div class="rpt-kpi-box">
        <div class="rpt-kpi-label">Completed</div>
        <div class="rpt-kpi-val green">${allTasksYes}</div>
      </div>
      <div class="rpt-kpi-box">
        <div class="rpt-kpi-label">Not Completed</div>
        <div class="rpt-kpi-val red">${allTasksNo}</div>
      </div>
      <div class="rpt-kpi-box">
        <div class="rpt-kpi-label">Issues Reported</div>
        <div class="rpt-kpi-val red">${totalIssuesCount}</div>
      </div>
    </div>

    <!-- DETAILED CHECKPOINT TIMELINE -->
    <div class="rpt-section-heading">DETAILED CHECKPOINT TIMELINE</div>
    ${checkpointsTimeline
      .map((item, cpIdx) => {
        const tasksList = item.tasks;
        const taskTotal = tasksList.length;
        const taskYes = tasksList.filter((t: any) => t.answer === 'YES').length;
        const taskNo = tasksList.filter((t: any) => t.answer === 'NO').length;
        const taskCompleted = taskYes + taskNo;
        const taskCompliance =
          taskTotal > 0 ? Math.round((taskYes / taskTotal) * 100) : 100;

        return `
        <div class="rpt-cp-card">
          <!-- Header bar -->
          <div class="rpt-cp-header">
            <div class="rpt-cp-header-left">
              <span class="rpt-seq-pill ${item.scanned ? 'scanned' : 'pending'}">
                Seq #${item.sequence} — ${item.scanned ? 'SCANNED' : 'PENDING'}
              </span>
              <span class="rpt-cp-name">
                ${item.gate?.name || 'Checkpoint'} (${item.gate?.gateCode || '—'})
              </span>
            </div>
            <div>
              ${
                item.scanned
                  ? `<span class="rpt-scan-time">Scan Time: ${fmtTime(item.scannedAt)}</span>`
                  : `<span class="rpt-pending-scan">⏳ PENDING SCAN</span>`
              }
            </div>
          </div>

          <!-- Sub-header bar -->
          <div class="rpt-task-summary-bar">
            <span>Task Verification Checklist</span>
            <span>
              Completed: ${taskCompleted} / ${taskTotal} | YES: ${taskYes} | NO: ${taskNo} | Compliance: ${taskCompliance}%
            </span>
          </div>

          <!-- Checkpoint remarks -->
          ${
            item.remarks
              ? `<div class="rpt-cp-remarks"><strong>Checkpoint Remarks:</strong> ${item.remarks}</div>`
              : ''
          }

          <!-- Tasks list -->
          ${
            tasksList.length === 0
              ? `<div class="rpt-no-tasks">No inspection tasks were configured for this checkpoint.</div>`
              : tasksList
                  .map((t: any, tIdx: number) => {
                    const uniqueEvidences = deduplicateImages(t.images || []);
                    return `
              <div class="rpt-task-card ${t.answer === 'NO' ? 'is-no' : ''}">
                <div class="rpt-task-row1">
                  <div class="rpt-task-title">
                    <strong>${tIdx + 1}. ${t.title}</strong>
                  </div>
                  <div>
                    ${
                      t.answer === 'YES'
                        ? `<span class="rpt-result-pill yes">All in Order</span>`
                        : t.answer === 'NO'
                        ? `<span class="rpt-result-pill no">Not in Order</span>`
                        : `<span class="rpt-result-pill unanswered">UNANSWERED</span>`
                    }
                  </div>
                </div>

                ${
                  t.remarks
                    ? `
                <div class="rpt-task-remarks">
                  <div class="rpt-task-remarks-head">Employee Remarks:</div>
                  <div>${t.remarks}</div>
                </div>`
                    : ''
                }

                ${
                  uniqueEvidences.length > 0
                    ? `
                <div class="rpt-task-evidence">
                  <div class="rpt-task-evidence-head">EVIDENCE:</div>
                  <div class="rpt-task-evidence-imgs">
                    ${uniqueEvidences
                      .map((imgUrl: string) => `<img src="${resolveImageUrl(imgUrl)}" alt="Evidence" class="rpt-evidence-img" />`)
                      .join('')}
                  </div>
                </div>`
                    : ''
                }

                <div class="rpt-task-meta">
                  ${t.answeredAt ? `<span>Recorded: ${fmtDateTime(t.answeredAt)}</span>` : ''}
                  <span>Voice Note: None</span>
                </div>
              </div>
            `;
                  })
                  .join('')
          }
        </div>
      `;
      })
      .join('')}

    <!-- REPORTED ISSUES & MAINTENANCE SNAG LIFECYCLE -->
    ${
      snags.length > 0
        ? `
      <div style="break-inside: avoid; page-break-inside: avoid; margin-top: 14px;">
        <div class="rpt-section-heading">
          REPORTED ISSUES &amp; MAINTENANCE SNAG LIFECYCLE (${snags.length})
        </div>
        ${snags
          .map((snag: any) => {
            const snagIdDisplay = `SNAG-${snag.id.slice(-6).toUpperCase()}`;
            const reporterName = snag.employee
              ? `${snag.employee.firstName} ${snag.employee.lastName || ''}`.trim()
              : 'Security Officer';
            const reporterEmpId = snag.employee?.employeeNumber || '—';
            const beforeImages = deduplicateImages(Array.isArray(snag.images) ? snag.images : []);

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
            const afterImages = deduplicateImages(completionEntry?.images || []);

            return `
            <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; margin-bottom: 12px; background: #ffffff; break-inside: avoid; page-break-inside: avoid;">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 8px;">
                <div>
                  <span style="font-size: 8pt; font-weight: 800; color: #0f172a; text-transform: uppercase;">
                    SNAG REPORT #${snagIdDisplay}
                  </span>
                  <span style="font-size: 7.5pt; color: #64748b; margin-left: 8px;">
                    Checkpoint: <strong>${snag.gate?.name || 'Gate'} (${snag.gate?.gateCode || '—'})</strong>
                  </span>
                </div>
                <div>
                  <span style="font-size: 7pt; font-weight: 800; padding: 2px 8px; border-radius: 4px; background-color: ${snag.priority === 'HIGH' ? '#fee2e2' : '#fef3c7'}; color: ${snag.priority === 'HIGH' ? '#dc2626' : '#d97706'}; border: 1px solid ${snag.priority === 'HIGH' ? '#fca5a5' : '#fde68a'};">
                    ${snag.priority || 'NORMAL'} PRIORITY
                  </span>
                  <span style="font-size: 7pt; font-weight: 800; padding: 2px 8px; border-radius: 4px; margin-left: 6px; background-color: ${snag.status === 'RESOLVED' || snag.status === 'CLOSED' ? '#dcfce7' : snag.status === 'ASSIGNED' ? '#dbeafe' : '#f1f5f9'}; color: ${snag.status === 'RESOLVED' || snag.status === 'CLOSED' ? '#15803d' : snag.status === 'ASSIGNED' ? '#1d4ed8' : '#475569'}; border: 1px solid ${snag.status === 'RESOLVED' || snag.status === 'CLOSED' ? '#86efac' : snag.status === 'ASSIGNED' ? '#93c5fd' : '#cbd5e1'};">
                    FINAL STATUS: ${snag.status}
                  </span>
                </div>
              </div>

              <!-- SECTION 1: ORIGINAL GUARD INSPECTION REPORT -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px 10px; margin-bottom: 8px;">
                <div style="font-size: 7.5pt; font-weight: 800; color: #3b82f6; text-transform: uppercase; margin-bottom: 4px;">
                  1. ORIGINAL GUARD INSPECTION REPORT
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; font-size: 7.5pt; color: #334155; margin-bottom: 6px;">
                  <div>Reported By: <strong>${reporterName}</strong> (ID: ${reporterEmpId})</div>
                  <div>Reported At: <strong>${fmtDateTime(snag.createdAt)}</strong></div>
                  <div>Category: <strong>${snag.category}</strong> ${snag.subCategory ? `• ${snag.subCategory}` : ''}</div>
                  <div>Initial Status: <strong>${snag.status}</strong></div>
                </div>
                <div style="font-size: 7.5pt; color: #1e293b; font-style: italic; margin-bottom: 6px;">
                  "${snag.description}"
                </div>

                <div style="margin-top: 6px;">
                  <div style="font-size: 7pt; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 4px;">
                    BEFORE REPAIR PHOTO (Original Guard Evidence):
                  </div>
                  ${
                    beforeImages.length > 0
                      ? `<div style="display: flex; gap: 6px; flex-wrap: wrap;">
                          ${beforeImages
                            .map(
                              (imgUrl: string) => `
                            <div style="text-align: center;">
                              <img src="${resolveImageUrl(imgUrl)}" alt="Before Repair" style="width: 70px; height: 70px; object-fit: cover; border-radius: 4px; border: 1px solid #cbd5e1;" />
                              <div style="font-size: 6.5pt; color: #64748b; margin-top: 2px;">Reported by ${reporterName}</div>
                            </div>
                          `,
                            )
                            .join('')}
                        </div>`
                      : `<div style="font-size: 7.5pt; font-style: italic; color: #94a3b8;">No before-repair photo available</div>`
                  }
                </div>
              </div>

              <!-- SECTION 2: SNAG ASSIGNMENT -->
              ${
                latestAssignment
                  ? `<div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; padding: 8px 10px; margin-bottom: 8px;">
                      <div style="font-size: 7.5pt; font-weight: 800; color: #1d4ed8; text-transform: uppercase; margin-bottom: 4px;">
                        2. SNAG ASSIGNMENT
                      </div>
                      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; font-size: 7.5pt; color: #1e3a8a;">
                        <div>Assigned To: <strong>${assignedTechName}</strong> (ID: ${assignedTechEmpId})</div>
                        <div>Assigned Role: <strong>${assignedTechRole}</strong></div>
                        <div>Assigned By: <strong>${assignedByAdmin}</strong></div>
                        <div>Assigned At: <strong>${assignedAtTime}</strong></div>
                        <div>Assignment Status: <strong>${latestAssignment.status || 'ASSIGNED'}</strong></div>
                      </div>
                    </div>`
                  : `<div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 4px; padding: 6px 10px; margin-bottom: 8px; font-size: 7.5pt; color: #64748b; font-style: italic;">
                      Snag Assignment: Unassigned (Pending Admin Assignment)
                    </div>`
              }

              <!-- SECTION 3: TECHNICIAN REPAIR VERIFICATION -->
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 8px 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <span style="font-size: 7.5pt; font-weight: 800; color: #15803d; text-transform: uppercase;">
                    3. TECHNICIAN REPAIR VERIFICATION &amp; RESOLUTION
                  </span>
                  <span style="font-size: 7pt; font-weight: 800; padding: 2px 8px; border-radius: 4px; background-color: ${repairResult === 'PASS' ? '#dcfce7' : repairResult === 'FAIL' ? '#fee2e2' : '#fef3c7'}; color: ${repairResult === 'PASS' ? '#15803d' : repairResult === 'FAIL' ? '#dc2626' : '#d97706'}; border: 1px solid ${repairResult === 'PASS' ? '#86efac' : repairResult === 'FAIL' ? '#fca5a5' : '#fde68a'};">
                    REPAIR RESULT: ${repairResult}
                  </span>
                </div>

                ${
                  repairResult !== 'PENDING'
                    ? `
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; font-size: 7.5pt; color: #14532d; margin-bottom: 6px;">
                    <div>Technician: <strong>${completedTechName}</strong> (ID: ${completedTechEmpId})</div>
                    <div>Verified At: <strong>${fmtDateTime(completionEntry?.createdAt || snag.updatedAt)}</strong></div>
                  </div>

                  ${
                    techRemarks
                      ? `
                  <div style="margin-top: 4px; margin-bottom: 6px;">
                    <div style="font-size: 7pt; font-weight: 700; color: #166534; text-transform: uppercase; margin-bottom: 2px;">
                      TECHNICIAN ACTION &amp; REMARKS:
                    </div>
                    <div style="font-size: 7.5pt; color: #14532d; background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 8px; white-space: pre-wrap;">
                      ${techRemarks}
                    </div>
                  </div>`
                      : ''
                  }

                  <div style="margin-top: 6px;">
                    <div style="font-size: 7pt; font-weight: 700; color: #166534; text-transform: uppercase; margin-bottom: 4px;">
                      AFTER REPAIR PHOTO (Technician Completion Evidence):
                    </div>
                    ${
                      afterImages.length > 0
                        ? `<div style="display: flex; gap: 6px; flex-wrap: wrap;">
                            ${afterImages
                              .map(
                                (imgUrl: string) => `
                              <div style="text-align: center;">
                                <img src="${resolveImageUrl(imgUrl)}" alt="After Repair" style="width: 70px; height: 70px; object-fit: cover; border-radius: 4px; border: 1px solid #86efac;" />
                                <div style="font-size: 6.5pt; color: #15803d; margin-top: 2px;">Uploaded by ${completedTechName}</div>
                              </div>
                            `,
                              )
                              .join('')}
                          </div>`
                        : `<div style="font-size: 7.5pt; font-style: italic; color: #64748b;">No after-repair photo attached</div>`
                    }
                  </div>
                `
                    : `<div style="font-size: 7.5pt; font-style: italic; color: #64748b;">
                    Repair Verification: PENDING (Technician repair verification not yet submitted)
                  </div>`
                }
              </div>
            </div>
          `;
          })
          .join('')}
      </div>
      `
        : ''
    }

    <!-- SUPERVISOR VERIFICATION -->
    <div style="break-inside: avoid; page-break-inside: avoid;">
      <div class="rpt-section-heading">SUPERVISOR VERIFICATION</div>
      <div class="rpt-sup-box">
        <span>Verification Status</span>
        <span class="rpt-pill ${verificationPillClass}">
          ${verificationStatus}
        </span>
      </div>
      ${
        report.supervisorRemarks
          ? `<div style="margin-top: 6px; font-size: 8pt; color: #475569;">
              <strong>Supervisor Remarks:</strong> ${report.supervisorRemarks}
            </div>`
          : ''
      }
    </div>

    <!-- PATROL SUMMARY -->
    <div style="break-inside: avoid; page-break-inside: avoid;">
      <div class="rpt-section-heading">PATROL SUMMARY</div>
      <div class="rpt-patrol-summary-grid">
        <div>Total Checkpoints: <strong>${totalGates}</strong></div>
        <div>Scanned Checkpoints: <strong>${scannedCount}</strong></div>
        <div>Completed Tasks: <strong>${allTasksCompleted} / ${allTasksTotal}</strong></div>
        <div>YES / NO Responses: <strong>YES: ${allTasksYes} | NO: ${allTasksNo}</strong></div>
        <div>Overall Compliance: <strong>${taskCompliancePct}%</strong></div>
        <div>Patrol Status: <strong>${report.status}</strong></div>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  async getPatrolPdf(patrolSessionId: string, clientId?: string) {
    const session = await this.getSingleInspectionReport(patrolSessionId, clientId);
    const html = this.buildPatrolReportHtml(session);

    const executablePath = findChromeExecutable();
    const browser = await puppeteer.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: '8mm', right: '8mm', bottom: '10mm', left: '8mm' },
      });

      return {
        pdfBuffer: Buffer.from(pdfBuffer),
        filename: `Patrol_Report_${session.patrolCode || session.id}.pdf`,
      };
    } finally {
      await browser.close();
    }
  }
}

export const reportService = new ReportService();
