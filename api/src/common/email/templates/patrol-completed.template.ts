export interface PatrolCompletedEmailData {
  patrolCode: string;
  officerName: string;
  employeeId: string;
  siteName: string;
  routeName: string;
  shiftName: string;
  startedAt: string;
  completedAt: string;
  scannedCount: number;
  totalCount: number;
  compliancePercentage: number;
  observationsCount: number;
  supervisorStatus: string;
  checkpoints: Array<{ name: string; sequence: number; scannedAt?: string }>;
  observations: Array<{ title: string; description?: string; severity?: string }>;
}

export function buildPatrolCompletedEmailHtml(data: PatrolCompletedEmailData): string {
  const checkpointsListHtml = data.checkpoints
    .map(
      (cp) =>
        `<li style="margin-bottom: 6px; color: #334155; font-size: 14px;">
          <span style="color: #16a34a; font-weight: bold; margin-right: 6px;">✓</span>
          <strong>${cp.name}</strong>
        </li>`,
    )
    .join('');

  const observationsListHtml =
    data.observations.length > 0
      ? data.observations
          .map(
            (obs) =>
              `<div style="padding: 10px 12px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; margin-bottom: 8px;">
                <div style="font-weight: 600; color: #be123c; font-size: 14px;">⚠️ ${obs.title}</div>
                ${obs.description ? `<div style="color: #475569; font-size: 13px; margin-top: 4px;">${obs.description}</div>` : ''}
              </div>`,
          )
          .join('')
      : `<div style="color: #64748b; font-style: italic; font-size: 14px;">No observations reported.</div>`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Patrol Completed — ${data.siteName} — ${data.patrolCode}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    
    <!-- Header -->
    <div style="background: #0f172a; padding: 24px; text-align: center;">
      <h1 style="color: #38bdf8; margin: 0 0 6px 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px;">Hello Orbit</h1>
      <div style="color: #94a3b8; font-size: 14px; font-weight: 500;">COMPLETED PATROL NOTIFICATION</div>
    </div>

    <div style="padding: 24px;">
      <p style="font-size: 15px; color: #334155; margin-top: 0;">
        A security patrol session has been successfully completed. Below are the summary details:
      </p>

      <!-- Details Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
        <tr>
          <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Patrol Code</td>
          <td style="padding: 10px 14px; font-size: 14px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #e2e8f0;">${data.patrolCode}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Security Officer</td>
          <td style="padding: 10px 14px; font-size: 14px; color: #0f172a; font-weight: 600; border-bottom: 1px solid #e2e8f0;">${data.officerName} (${data.employeeId})</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Monitored Site</td>
          <td style="padding: 10px 14px; font-size: 14px; color: #0f172a; font-weight: 600; border-bottom: 1px solid #e2e8f0;">${data.siteName}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Route / Target</td>
          <td style="padding: 10px 14px; font-size: 14px; color: #0f172a; font-weight: 600; border-bottom: 1px solid #e2e8f0;">${data.routeName}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Shift</td>
          <td style="padding: 10px 14px; font-size: 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${data.shiftName}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Started</td>
          <td style="padding: 10px 14px; font-size: 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${data.startedAt}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Completed</td>
          <td style="padding: 10px 14px; font-size: 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${data.completedAt}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Checkpoint Progress</td>
          <td style="padding: 10px 14px; font-size: 14px; color: #0f172a; font-weight: 600; border-bottom: 1px solid #e2e8f0;">${data.scannedCount} / ${data.totalCount}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Compliance</td>
          <td style="padding: 10px 14px; font-size: 14px; color: #16a34a; font-weight: 700; border-bottom: 1px solid #e2e8f0;">${data.compliancePercentage}%</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Observations / Issues</td>
          <td style="padding: 10px 14px; font-size: 14px; color: ${data.observationsCount > 0 ? '#e11d48' : '#0f172a'}; font-weight: 700; border-bottom: 1px solid #e2e8f0;">${data.observationsCount}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 600;">Supervisor Verification</td>
          <td style="padding: 10px 14px; font-size: 14px; color: #0284c7; font-weight: 600;">${data.supervisorStatus}</td>
        </tr>
      </table>

      <!-- Checkpoint Summary Section -->
      <h3 style="font-size: 15px; color: #0f172a; margin: 20px 0 10px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">CHECKPOINT SUMMARY</h3>
      <ul style="padding-left: 20px; margin-top: 0; margin-bottom: 24px;">
        ${checkpointsListHtml}
      </ul>

      <!-- Observation Summary Section -->
      <h3 style="font-size: 15px; color: #0f172a; margin: 20px 0 10px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">OBSERVATION SUMMARY</h3>
      ${observationsListHtml}

    </div>

    <!-- Footer -->
    <div style="background: #f1f5f9; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0;">
      <div style="font-size: 13px; color: #64748b; font-weight: 600;">Hello Orbit</div>
      <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">Powered by Atlabs</div>
    </div>
  </div>
</body>
</html>
  `;
}
