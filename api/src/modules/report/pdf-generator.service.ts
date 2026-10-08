import puppeteer from 'puppeteer';
import { ReportDataset } from './summary-report.service';
import { logger } from '../../common/logger/logger';
import { findChromeExecutable, resolveImageUrl } from './report.service';

export class PdfGeneratorService {
  /**
   * Builds client-presentable HTML string from normalized ReportDataset
   */
  private buildHtml(dataset: ReportDataset): string {
    const { metadata, summary, patrols, mandatoryPatrols, incidents, siteSummary, employeeSummary } = dataset;
    const isKaizen = metadata.isKaizen || metadata.includeIncidents === false || metadata.clientName?.toLowerCase().includes('kaizen');
    const resolvedLogo = metadata.clientLogoUrl ? resolveImageUrl(metadata.clientLogoUrl) : null;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${metadata.title}</title>
  <style>
    @page {
      size: A4;
      margin: 12mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.4;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 14px;
      border-bottom: 2px solid #2563eb;
      margin-bottom: 16px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      letter-spacing: -0.5px;
    }
    .brand-title span {
      color: #2563eb;
    }
    .report-meta {
      text-align: right;
      font-size: 10px;
      color: #64748b;
    }
    .report-meta strong {
      color: #0f172a;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 18px;
      margin-bottom: 10px;
      padding-bottom: 4px;
      border-bottom: 1px solid #e2e8f0;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 18px;
    }
    .metric-card {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      box-sizing: border-box;
    }
    .metric-label {
      font-size: 8.5px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 6px;
      line-height: 1.35;
      min-height: 24px;
      word-break: normal;
      white-space: normal;
      hyphens: none;
    }
    .metric-value {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
    }
    .metric-value.highlight {
      color: #2563eb;
    }
    .metric-value.success {
      color: #10b981;
    }
    .metric-value.warning {
      color: #f59e0b;
    }
    .metric-value.danger {
      color: #ef4444;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 10px;
    }
    th {
      background-color: #f1f5f9;
      color: #334155;
      font-weight: 700;
      text-align: left;
      padding: 8px 10px;
      border: 1px solid #cbd5e1;
      text-transform: uppercase;
      font-size: 9px;
    }
    td {
      padding: 7px 10px;
      border: 1px solid #e2e8f0;
      color: #334155;
    }
    tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .badge-completed { background-color: #d1fae5; color: #065f46; }
    .badge-due { background-color: #fee2e2; color: #991b1b; }
    .badge-missed { background-color: #fef3c7; color: #92400e; }
    .badge-upcoming { background-color: #f1f5f9; color: #475569; }
    .footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 9px;
      color: #94a3b8;
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header-bar">
    <div style="display: flex; align-items: center; gap: 14px;">
      ${resolvedLogo ? `<img src="${resolvedLogo}" alt="Client Logo" style="max-height: 44px; max-width: 130px; object-fit: contain;" />` : ''}
      <div>
        <h1 class="brand-title">HELLO <span>ORBIT</span></h1>
        <p style="margin: 3px 0 0 0; font-size: 12px; font-weight: 700; color: #334155;">
          ${metadata.title}
        </p>
      </div>
    </div>
    <div class="report-meta">
      <p style="margin: 0;">Organization: <strong>${metadata.clientName}</strong></p>
      ${metadata.siteName ? `<p style="margin: 2px 0 0 0;">Site: <strong>${metadata.siteName}</strong></p>` : ''}
      ${metadata.employeeName ? `
        <p style="margin: 2px 0 0 0;">Employee: <strong>${metadata.employeeName}</strong></p>
        <p style="margin: 2px 0 0 0;">Role: <strong>${metadata.employeeRole || 'Security Guard'}</strong></p>
        ${metadata.employeeNumber ? `<p style="margin: 2px 0 0 0;">Staff ID: <strong>${metadata.employeeNumber}</strong></p>` : ''}
      ` : ''}
      <p style="margin: 2px 0 0 0;">Report Type: <strong>${metadata.periodType}</strong></p>
      <p style="margin: 2px 0 0 0;">Period: <strong>${metadata.periodLabel}</strong></p>
      <p style="margin: 2px 0 0 0;">Generated: <strong>${metadata.generatedAt.split('T')[0]} (${metadata.timezone})</strong></p>
    </div>
  </div>

  <!-- Executive Summary Cards -->
  <div class="section-title">Executive Summary</div>
  <div class="metrics-grid">
    <div class="metric-card">
      <div class="metric-label">MANDATORY PATROLS<br>COMPLETED</div>
      <div class="metric-value success">${summary.mandatoryCompleted}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">MANDATORY PATROLS<br>MISSED</div>
      <div class="metric-value ${summary.mandatoryMissed > 0 ? 'danger' : ''}">${summary.mandatoryMissed}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">TOTAL PATROL<br>SESSIONS</div>
      <div class="metric-value highlight">${summary.assignedPatrols}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">TOTAL<br>CHECKPOINTS</div>
      <div class="metric-value">${summary.totalCheckpoints ?? summary.requiredCheckpoints}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">CHECKPOINTS<br>SCANNED</div>
      <div class="metric-value success">${summary.checkpointsScanned ?? summary.completedCheckpoints}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">CHECKPOINTS<br>MISSED</div>
      <div class="metric-value ${(summary.checkpointsMissed ?? summary.missedCheckpoints) > 0 ? 'danger' : ''}">${summary.checkpointsMissed ?? summary.missedCheckpoints}</div>
    </div>
  </div>

  <!-- Mandatory Patrol Schedule Compliance -->
  <div class="section-title">Mandatory Patrol Schedule Compliance</div>
  ${
    mandatoryPatrols.length === 0
      ? '<p style="color: #64748b;">No mandatory patrol instances scheduled for this period.</p>'
      : `
  <table>
    <thead>
      <tr>
        <th>Sequence</th>
        <th>Employee</th>
        <th>Role</th>
        <th>Site</th>
        <th>Shift</th>
        <th>Scheduled Time</th>
        <th>Mandatory Window</th>
        <th>Status</th>
        <th>Completed At</th>
      </tr>
    </thead>
    <tbody>
      ${mandatoryPatrols
        .map(
          (m) => `
        <tr>
          <td>Patrol ${m.sequence}</td>
          <td><strong>${m.guardName}</strong></td>
          <td>${m.employeeRole || 'Security Guard'}</td>
          <td>${m.siteName}</td>
          <td>${m.shiftName}</td>
          <td>${m.scheduledAt}</td>
          <td>${m.windowStart} - ${m.windowEnd}</td>
          <td>
            <span class="badge badge-${m.status.toLowerCase()}">${m.status}</span>
          </td>
          <td>${m.completedAt || '—'}</td>
        </tr>
      `,
        )
        .join('')}
    </tbody>
  </table>
  `
  }

  ${
    metadata.employeeId
      ? `
  <!-- Patrol Sessions Activity (Employee Scoped Report Only) -->
  <div class="section-title">Patrol Sessions Activity</div>
  ${
    patrols.length === 0
      ? '<p style="color: #64748b;">No patrol sessions recorded for this employee.</p>'
      : `
  <table>
    <thead>
      <tr>
        <th>Patrol Code</th>
        <th>Employee</th>
        <th>Role</th>
        <th>Site / Route</th>
        <th>Started At</th>
        <th>Completed At</th>
        <th>Checkpoints</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${patrols
        .slice(0, 100)
        .map(
          (p) => `
        <tr>
          <td><strong>${p.patrolCode}</strong></td>
          <td><strong>${p.employeeName || p.guardName}</strong></td>
          <td>${p.employeeRole || 'Security Guard'}</td>
          <td>${p.siteName} - ${p.routeName}</td>
          <td>${p.startedAt}</td>
          <td>${p.completedAt || '—'}</td>
          <td><strong>${p.checkpointsDisplay || `${p.checkpointsCompleted} / ${p.checkpointsRequired}`}</strong></td>
          <td>
            <span class="badge badge-${p.status.toLowerCase() === 'completed' ? 'completed' : 'upcoming'}">${p.status}</span>
          </td>
        </tr>
      `,
        )
        .join('')}
    </tbody>
  </table>
  `
  }
  `
      : ''
  }

  <!-- Incidents (Excluded for Kaizen) -->
  ${
    !isKaizen && incidents.length > 0
      ? `
  <div class="section-title">Security Incidents (${incidents.length})</div>
  <table>
    <thead>
      <tr>
        <th>Type</th>
        <th>Severity</th>
        <th>Status</th>
        <th>Site</th>
        <th>Employee</th>
        <th>Reported Time</th>
        <th>Description</th>
      </tr>
    </thead>
    <tbody>
      ${incidents
        .map(
          (inc) => `
        <tr>
          <td><strong>${inc.type}</strong></td>
          <td><span class="badge badge-missed">${inc.severity}</span></td>
          <td>${inc.status}</td>
          <td>${inc.siteName}</td>
          <td>${inc.guardName}</td>
          <td>${inc.reportedAt}</td>
          <td>${inc.description}</td>
        </tr>
      `,
        )
        .join('')}
    </tbody>
  </table>
  `
      : ''
  }

  <!-- Site Summary Breakdown -->
  ${
    siteSummary.length > 0
      ? `
  <div class="section-title">Site Summary Breakdown</div>
  <table>
    <thead>
      <tr>
        <th>Site Name</th>
        <th>Completed Patrols</th>
        <th>Mandatory Scheduled</th>
        <th>Mandatory Completed</th>
        <th>Mandatory Compliance %</th>
        <th>Checkpoints Scanned</th>
      </tr>
    </thead>
    <tbody>
      ${siteSummary
        .map(
          (s) => `
        <tr>
          <td><strong>${s.siteName}</strong></td>
          <td>${s.completedPatrols}</td>
          <td>${s.mandatoryScheduled}</td>
          <td>${s.mandatoryCompleted}</td>
          <td><strong>${s.mandatoryCompliancePct}%</strong></td>
          <td>${s.completedCheckpoints} / ${s.requiredCheckpoints}</td>
        </tr>
      `,
        )
        .join('')}
    </tbody>
  </table>
  `
      : ''
  }

  <!-- Employee Performance Summary -->
  ${
    employeeSummary.length > 0
      ? `
  <div class="section-title">Guard & Staff Performance Summary</div>
  <table>
    <thead>
      <tr>
        <th>Employee Name</th>
        <th>Role</th>
        <th>Site</th>
        <th>Completed Patrols</th>
        <th>Mandatory Patrols</th>
        <th>Mandatory %</th>
        <th>Checkpoints Scanned</th>
      </tr>
    </thead>
    <tbody>
      ${employeeSummary
        .map(
          (emp) => `
        <tr>
          <td><strong>${emp.employeeName}</strong></td>
          <td>${emp.employeeRole || 'Security Guard'}</td>
          <td>${emp.siteName}</td>
          <td>${emp.completedPatrols}</td>
          <td>${emp.mandatoryCompleted} / ${emp.mandatoryScheduled}</td>
          <td><strong>${emp.mandatoryCompliancePct}%</strong></td>
          <td>${emp.checkpointsScanned}</td>
        </tr>
      `,
        )
        .join('')}
    </tbody>
  </table>
  `
      : ''
  }

  <!-- Footer -->
  <div class="footer">
    Hello Orbit Security Management Platform • Confidential Client Executive Report
  </div>

</body>
</html>
    `;
  }

  /**
   * Generates PDF buffer using Puppeteer
   */
  async generatePdf(dataset: ReportDataset): Promise<Buffer> {
    const htmlContent = this.buildHtml(dataset);

    logger.info(`[PdfGeneratorService] Launching Puppeteer for ${dataset.metadata.title}`);

    const executablePath = findChromeExecutable();
    const browser = await puppeteer.launch({
      ...(executablePath ? { executablePath } : {}),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      headless: true,
    });

    try {
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      const pdfUint8Array = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm',
        },
      });

      return Buffer.from(pdfUint8Array);
    } finally {
      await browser.close();
    }
  }
}

export const pdfGeneratorService = new PdfGeneratorService();
