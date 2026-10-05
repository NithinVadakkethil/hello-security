import * as XLSX from 'xlsx';
import puppeteer from 'puppeteer';
import { logger } from '../../common/logger/logger';
import { AttendanceRecordDto } from './attendance.types';

export interface AttendanceReportMetadata {
  title?: string;
  clientName?: string;
  siteName?: string;
  employeeName?: string;
  employeeRole?: string;
  employeeNumber?: string;
  dateStr: string;
  statusFilter?: string;
  generatedAt: string;
  timezone: string;
}

export class AttendanceReportService {
  /**
   * Generates a structured .xlsx Buffer from filtered attendance records
   */
  generateAttendanceExcel(records: AttendanceRecordDto[], metadata: AttendanceReportMetadata): Buffer {
    const wb = XLSX.utils.book_new();

    // 1. Metadata / Summary Header
    const summaryRows: (string | number)[][] = [
      ['HELLO ORBIT ATTENDANCE REPORT'],
      ['Report Title', metadata.title || 'ATTENDANCE REPORT'],
      ['Reporting Date / Period', metadata.dateStr],
      ['Organization / Client', metadata.clientName || 'All Organizations'],
      ['Site', metadata.siteName || 'All Sites'],
    ];

    if (metadata.employeeName) {
      summaryRows.push(
        ['Employee Name', metadata.employeeName],
        ['Employee Role', metadata.employeeRole || 'Security Guard'],
        ['Staff ID', metadata.employeeNumber || '—']
      );
    }

    if (metadata.statusFilter && metadata.statusFilter !== 'ALL') {
      summaryRows.push(['Status Filter', metadata.statusFilter]);
    }

    summaryRows.push(
      ['Generated Date & Time', `${metadata.generatedAt} (${metadata.timezone})`],
      ['Total Records Found', records.length],
      []
    );

    // If no records found
    if (records.length === 0) {
      summaryRows.push(['No attendance records found for the selected filters.']);
      const wsEmpty = XLSX.utils.aoa_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsEmpty, 'Attendance Report');
      return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }

    // 2. Data Rows
    const tableHeader = [
      'Employee',
      'Staff ID',
      'Role',
      'Site',
      'Date',
      'Shift',
      'Check-In',
      'Check-Out',
      'Status',
      'Duration',
    ];

    const dataRows = records.map((r) => [
      r.employeeName,
      r.employeeNumber || '—',
      r.employeeRole,
      r.siteName,
      r.date,
      r.shiftName ? `${r.shiftName} (${r.shiftStartTime} - ${r.shiftEndTime})` : '—',
      r.checkInTime || '—',
      r.checkOutTime || '—',
      r.status,
      r.workingDuration || '—',
    ]);

    const combinedRows = [...summaryRows, tableHeader, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(combinedRows);

    // Set column widths
    ws['!cols'] = [
      { wch: 24 }, // Employee
      { wch: 14 }, // Staff ID
      { wch: 20 }, // Role
      { wch: 22 }, // Site
      { wch: 14 }, // Date
      { wch: 28 }, // Shift
      { wch: 22 }, // Check-In
      { wch: 22 }, // Check-Out
      { wch: 14 }, // Status
      { wch: 16 }, // Duration
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Attendance Report');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Generates a PDF buffer using Puppeteer
   */
  async generateAttendancePdf(records: AttendanceRecordDto[], metadata: AttendanceReportMetadata): Promise<Buffer> {
    const htmlContent = this.buildPdfHtml(records, metadata);

    logger.info(`[AttendanceReportService] Launching Puppeteer for Attendance Report (${records.length} records)`);

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
    });

    try {
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      const pdfUint8Array = await page.pdf({
        format: 'A4',
        landscape: true,
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

  /**
   * Builds client-presentable HTML string for PDF rendering
   */
  private buildPdfHtml(records: AttendanceRecordDto[], metadata: AttendanceReportMetadata): string {
    const totalCount = records.length;
    const totalCheckedInCount = records.filter(
      (r) => Boolean(r.checkInTimeRaw || (r.checkInTime && r.checkInTime !== '—')),
    ).length;
    const lateCount = records.filter((r) => r.status === 'LATE').length;
    const completedCount = records.filter((r) => r.status === 'COMPLETED').length;
    const offCount = records.filter((r) => r.status === 'OFF').length;

    const rowsHtml =
      records.length === 0
        ? `<tr><td colspan="9" style="text-align: center; padding: 24px; color: #64748b; font-style: italic;">No attendance records found for the selected filters.</td></tr>`
        : records
            .map(
              (r) => `
          <tr>
            <td>
              <div style="font-weight: 600; color: #0f172a;">${this.escapeHtml(r.employeeName)}</div>
              ${r.employeeNumber && r.employeeNumber !== '—' ? `<div style="font-size: 9px; color: #64748b; font-family: monospace;">ID: ${this.escapeHtml(r.employeeNumber)}</div>` : ''}
            </td>
            <td>${this.escapeHtml(r.employeeRole)}</td>
            <td>${this.escapeHtml(r.siteName)}</td>
            <td>
              <div>${this.escapeHtml(r.shiftName || '—')}</div>
              ${r.shiftStartTime && r.shiftEndTime ? `<div style="font-size: 9px; color: #64748b;">${this.escapeHtml(r.shiftStartTime)} - ${this.escapeHtml(r.shiftEndTime)}</div>` : ''}
            </td>
            <td style="font-family: monospace;">${this.escapeHtml(r.date)}</td>
            <td style="font-weight: ${r.checkInTime ? '600' : 'normal'}; color: ${r.checkInTime ? '#0f172a' : '#94a3b8'};">
              ${r.checkInTime ? this.escapeHtml(r.checkInTime) : '—'}
            </td>
            <td style="font-weight: ${r.checkOutTime ? '600' : 'normal'}; color: ${r.checkOutTime ? '#0f172a' : '#94a3b8'};">
              ${r.checkOutTime ? this.escapeHtml(r.checkOutTime) : '—'}
            </td>
            <td>
              <span class="status-badge status-${r.status.toLowerCase()}">${this.escapeHtml(r.status)}</span>
            </td>
            <td style="font-weight: 600; color: ${r.workingDuration ? '#2563eb' : '#94a3b8'};">
              ${r.workingDuration ? this.escapeHtml(r.workingDuration) : '—'}
            </td>
          </tr>`
            )
            .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Attendance Report</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 10px;
      line-height: 1.4;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      border-bottom: 2px solid #2563eb;
      margin-bottom: 14px;
    }
    .brand-title {
      font-size: 18px;
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
      font-size: 9.5px;
      color: #64748b;
    }
    .report-meta strong {
      color: #0f172a;
    }
    .filter-banner {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 14px;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      font-size: 9.5px;
    }
    .filter-item {
      display: flex;
      flex-direction: column;
    }
    .filter-label {
      color: #64748b;
      font-size: 8.5px;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .filter-value {
      font-weight: 700;
      color: #0f172a;
      margin-top: 2px;
    }
    .metrics-row {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .metric-pill {
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 10px;
      text-align: center;
    }
    .metric-pill-label {
      font-size: 8px;
      color: #64748b;
      font-weight: 700;
      text-transform: uppercase;
    }
    .metric-pill-val {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      font-size: 9.5px;
    }
    th {
      background-color: #f1f5f9;
      color: #334155;
      text-align: left;
      padding: 7px 8px;
      font-weight: 700;
      font-size: 8.5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #cbd5e1;
    }
    td {
      padding: 6px 8px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
    }
    tr:nth-child(even) {
      background-color: #fafafa;
    }
    .status-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 8.5px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .status-present {
      background-color: #ecfdf5;
      color: #059669;
      border: 1px solid #a7f3d0;
    }
    .status-late {
      background-color: #fffbeb;
      color: #d97706;
      border: 1px solid #fde68a;
    }
    .status-completed {
      background-color: #eff6ff;
      color: #2563eb;
      border: 1px solid #bfdbfe;
    }
    .status-off {
      background-color: #f1f5f9;
      color: #64748b;
      border: 1px solid #cbd5e1;
    }
    .footer-bar {
      margin-top: 14px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      color: #94a3b8;
      font-size: 8.5px;
    }
  </style>
</head>
<body>
  <div class="header-bar">
    <div>
      <h1 class="brand-title">HELLO<span>ORBIT</span> <span style="color: #64748b; font-weight: 400; font-size: 14px;">| ATTENDANCE REPORT</span></h1>
    </div>
    <div class="report-meta">
      <div>Generated: <strong>${this.escapeHtml(metadata.generatedAt)}</strong> (${this.escapeHtml(metadata.timezone)})</div>
      <div>Client: <strong>${this.escapeHtml(metadata.clientName || 'All Clients')}</strong></div>
    </div>
  </div>

  <div class="filter-banner">
    <div class="filter-item">
      <span class="filter-label">Period / Date</span>
      <span class="filter-value">${this.escapeHtml(metadata.dateStr)}</span>
    </div>
    <div class="filter-item">
      <span class="filter-label">Site</span>
      <span class="filter-value">${this.escapeHtml(metadata.siteName || 'All Sites')}</span>
    </div>
    <div class="filter-item">
      <span class="filter-label">Employee</span>
      <span class="filter-value">${this.escapeHtml(metadata.employeeName ? `${metadata.employeeName} (${metadata.employeeRole || 'Staff'})` : 'All Employees')}</span>
    </div>
    <div class="filter-item">
      <span class="filter-label">Status Filter</span>
      <span class="filter-value">${this.escapeHtml(metadata.statusFilter || 'All Statuses')}</span>
    </div>
  </div>

  <div class="metrics-row">
    <div class="metric-pill">
      <div class="metric-pill-label">Total Records</div>
      <div class="metric-pill-val">${totalCount}</div>
    </div>
    <div class="metric-pill">
      <div class="metric-pill-label">Total Check In Count</div>
      <div class="metric-pill-val" style="color: #059669;">${totalCheckedInCount}</div>
    </div>
    <div class="metric-pill">
      <div class="metric-pill-label">Late Check-ins</div>
      <div class="metric-pill-val" style="color: #d97706;">${lateCount}</div>
    </div>
    <div class="metric-pill">
      <div class="metric-pill-label">Completed Shifts</div>
      <div class="metric-pill-val" style="color: #2563eb;">${completedCount}</div>
    </div>
    <div class="metric-pill">
      <div class="metric-pill-label">Off / Not Checked-In</div>
      <div class="metric-pill-val" style="color: #64748b;">${offCount}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 17%;">Employee</th>
        <th style="width: 13%;">Role</th>
        <th style="width: 13%;">Site</th>
        <th style="width: 15%;">Shift</th>
        <th style="width: 10%;">Date</th>
        <th style="width: 11%;">Check-In</th>
        <th style="width: 11%;">Check-Out</th>
        <th style="width: 9%;">Status</th>
        <th style="width: 11%;">Duration</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="footer-bar">
    <div>Hello Orbit Security Platform — Authoritative Face-Verified Attendance Record</div>
    <div>Confidential Document</div>
  </div>
</body>
</html>`;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export const attendanceReportService = new AttendanceReportService();
