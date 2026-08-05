'use client';

import { resolveImageUrl } from '../../../../lib/image';

interface PatrolSessionPrintTemplateProps {
  session: any;
}

export default function PatrolSessionPrintTemplate({
  session,
}: PatrolSessionPrintTemplateProps) {
  if (!session) return null;

  const assignment = session.assignment || {};
  const employee = assignment.employee || session.employee || {};
  const site = assignment.site || {};
  const client = site.client || assignment.client || {};
  const shift = assignment.shift || {};

  const routeGates =
    assignment.assignmentGates && assignment.assignmentGates.length > 0
      ? assignment.assignmentGates.map((ag: any, idx: number) => ({
          sequence: ag.sequence || idx + 1,
          gate: ag.gate,
        }))
      : assignment.patrolRoute?.routeGates || [];

  const scans = session.checkpoints || [];
  const incidents = session.incidents || [];
  const snags = session.snags || [];

  // Scanned gates lookup map
  const scanMap = new Map<string, any>();
  scans.forEach((s: any) => {
    if (s.gateId) scanMap.set(s.gateId, s);
    if (s.gate?.id) scanMap.set(s.gate.id, s);
  });

  const timeline = routeGates
    .sort((a: any, b: any) => (a.sequence || 0) - (b.sequence || 0))
    .map((rg: any, idx: number) => {
      const gate = rg.gate || {};
      const scan = scans.find(
        (s: any) =>
          s.gateId === gate.id ||
          s.gateId === rg.gateId ||
          s.gate?.id === gate.id,
      );

      return {
        sequence: rg.sequence || idx + 1,
        gate,
        scanned: !!scan,
        scannedAt: scan?.scannedAt,
        remarks: scan?.remarks,
        status: scan?.status,
        images: scan?.images || [],
        subTaskResponses: scan?.subTaskResponses || [],
        scanCoords:
          scan?.latitude && scan?.longitude
            ? `${scan.latitude.toFixed(5)}, ${scan.longitude.toFixed(5)}`
            : null,
      };
    });

  const totalCheckpoints = routeGates.length || timeline.length;
  const completedCheckpoints = scans.length;
  const missedCheckpoints = Math.max(
    0,
    totalCheckpoints - completedCheckpoints,
  );
  const completionPct =
    totalCheckpoints > 0
      ? Math.round((completedCheckpoints / totalCheckpoints) * 100)
      : 100;

  // Flatten all sub-task responses across all scanned checkpoints
  const allSubTaskResponses: any[] = [];
  timeline.forEach((item: any) => {
    if (item.subTaskResponses && Array.isArray(item.subTaskResponses)) {
      item.subTaskResponses.forEach((r: any) => {
        allSubTaskResponses.push({
          ...r,
          gateName: item.gate.name,
          scannedAt: item.scannedAt,
        });
      });
    }
  });

  const totalTasks = allSubTaskResponses.length;
  const yesCount = allSubTaskResponses.filter((r) => r.answer === 'YES').length;
  const noCount = allSubTaskResponses.filter((r) => r.answer === 'NO').length;

  // Extract all unique images
  const allUploadedImages: string[] = [];
  timeline.forEach((item: any) => {
    (item.images || []).forEach((img: string) => {
      if (img && !allUploadedImages.includes(img)) allUploadedImages.push(img);
    });
    (item.subTaskResponses || []).forEach((r: any) => {
      (r.images || []).forEach((img: string) => {
        if (img && !allUploadedImages.includes(img))
          allUploadedImages.push(img);
      });
    });
  });

  const durationSec = session.totalDuration || 0;
  const durationMins = Math.round(durationSec / 60);
  const avgSecPerGate =
    completedCheckpoints > 0
      ? Math.round(durationSec / completedCheckpoints)
      : 0;
  const avgMinsPerGate = Math.round(avgSecPerGate / 60);

  // Overall Patrol Result
  let overallResult = 'PASS';
  let overallResultColor = '#10b981';
  let overallResultBg = '#dcfce7';

  if (noCount > 2 || incidents.length > 0 || completionPct < 80) {
    overallResult = 'FAILED / DEFECTS DETECTED';
    overallResultColor = '#ef4444';
    overallResultBg = '#fee2e2';
  } else if (noCount > 0 || completionPct < 100) {
    overallResult = 'WARNING / INCOMPLETE';
    overallResultColor = '#f59e0b';
    overallResultBg = '#fef3c7';
  }

  const employeeFullName = employee.firstName
    ? `${employee.firstName} ${employee.lastName || ''}`
    : 'Field Employee';

  return (
    <div className="patrol-session-print-container">
      <style jsx global>{`
        @media screen {
          .patrol-session-print-container {
            display: none !important;
          }
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          .patrol-session-print-container,
          .patrol-session-print-container * {
            visibility: visible !important;
          }
          .patrol-session-print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            color: #0f172a !important;
            font-family:
              -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica,
              Arial, sans-serif !important;
            font-size: 9.5pt !important;
            line-height: 1.4 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          @page {
            size: A4 portrait;
            margin: 12mm 10mm 15mm 10mm;
          }
          .page-break {
            page-break-after: always;
          }
          .no-break {
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* 1. REPORT HEADER */}
      <div
        style={{
          borderBottom: '3px solid #0f172a',
          paddingBottom: '12px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '4px',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '14px',
              }}
            >
              🛡️
            </div>
            <span
              style={{
                fontSize: '16pt',
                fontWeight: 900,
                color: '#0f172a',
                letterSpacing: '-0.5px',
              }}
            >
              HELLO <span style={{ color: '#2563eb' }}>ORBIT</span>
            </span>
          </div>
          <h1
            style={{
              margin: '2px 0 0 0',
              fontSize: '14pt',
              fontWeight: 800,
              color: '#1e293b',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Guard Patrol Completion Report
          </h1>
          <div
            style={{ fontSize: '8.5pt', color: '#64748b', marginTop: '2px' }}
          >
            Official Field Verification & Inspection Audit Log
          </div>
        </div>

        <div
          style={{
            textAlign: 'right',
            backgroundColor: '#f8fafc',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
          }}
        >
          <div
            style={{
              fontSize: '8pt',
              color: '#64748b',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            Report Code
          </div>
          <div
            style={{
              fontSize: '11pt',
              fontWeight: 800,
              color: '#2563eb',
              fontFamily: 'monospace',
            }}
          >
            {session.patrolCode}
          </div>
          <div
            style={{ fontSize: '7.5pt', color: '#64748b', marginTop: '2px' }}
          >
            Generated: {new Date().toLocaleString()}
          </div>
        </div>
      </div>

      {/* 2. EMPLOYEE & ASSIGNMENT META SUMMARY GRID */}
      <div
        className="no-break"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        {/* Employee Card */}
        <div
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '10px 12px',
            backgroundColor: '#f8fafc',
          }}
        >
          <div
            style={{
              fontSize: '8.5pt',
              fontWeight: 800,
              color: '#334155',
              textTransform: 'uppercase',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '4px',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>👤</span> Employee Details
          </div>
          <table
            style={{
              width: '100%',
              fontSize: '8.5pt',
              borderCollapse: 'collapse',
            }}
          >
            <tbody>
              <tr>
                <td
                  style={{ color: '#64748b', padding: '2px 0', width: '38%' }}
                >
                  Employee Name:
                </td>
                <td style={{ fontWeight: 700, color: '#0f172a' }}>
                  {employeeFullName}
                </td>
              </tr>
              <tr>
                <td style={{ color: '#64748b', padding: '2px 0' }}>
                  Role / Designation:
                </td>
                <td style={{ fontWeight: 700, color: '#2563eb' }}>
                  {employee.role || 'SECURITY'} (
                  {employee.designation || 'Field Guard'})
                </td>
              </tr>
              <tr>
                <td style={{ color: '#64748b', padding: '2px 0' }}>
                  Employee ID:
                </td>
                <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                  {employee.employeeNumber || 'EMP-001'}
                </td>
              </tr>
              <tr>
                <td style={{ color: '#64748b', padding: '2px 0' }}>Shift:</td>
                <td style={{ fontWeight: 600 }}>
                  {shift.name || 'Day Shift'} ({shift.startTime || '08:00'} -{' '}
                  {shift.endTime || '18:00'})
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Assignment & Site Card */}
        <div
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '10px 12px',
            backgroundColor: '#f8fafc',
          }}
        >
          <div
            style={{
              fontSize: '8.5pt',
              fontWeight: 800,
              color: '#334155',
              textTransform: 'uppercase',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '4px',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>🏢</span> Assignment & Location
          </div>
          <table
            style={{
              width: '100%',
              fontSize: '8.5pt',
              borderCollapse: 'collapse',
            }}
          >
            <tbody>
              {/* <tr>
                <td
                  style={{ color: '#64748b', padding: '2px 0', width: '38%' }}
                >
                  Client Name:
                </td>
                <td style={{ fontWeight: 700, color: '#0f172a' }}>
                  {client.name || site.client?.name || 'Enterprise Client'}
                </td>
              </tr> */}
              <tr>
                <td style={{ color: '#64748b', padding: '2px 0' }}>
                  Monitored Site:
                </td>
                <td style={{ fontWeight: 700, color: '#0f172a' }}>
                  {site.name || 'Primary Facility Site'}
                </td>
              </tr>
              <tr>
                <td style={{ color: '#64748b', padding: '2px 0' }}>
                  Patrol Route:
                </td>
                <td style={{ fontWeight: 700, color: '#059669' }}>
                  {assignment.patrolRoute?.name || 'Direct Checkpoints Route'}
                </td>
              </tr>
              <tr>
                <td style={{ color: '#64748b', padding: '2px 0' }}>
                  Patrol Timings:
                </td>
                <td style={{ fontWeight: 600 }}>
                  {new Date(session.startedAt).toLocaleTimeString()} -{' '}
                  {session.endedAt
                    ? new Date(session.endedAt).toLocaleTimeString()
                    : 'In Progress'}{' '}
                  ({durationMins > 0 ? `${durationMins} Mins` : '< 1 Min'})
                </td>
              </tr>
              <tr>
                <td style={{ color: '#64748b', padding: '2px 0' }}>
                  Average Pace:
                </td>
                <td style={{ fontWeight: 600 }}>
                  {avgSecPerGate > 0
                    ? `${avgSecPerGate} sec (${avgMinsPerGate} min) / checkpoint`
                    : 'N/A'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. PATROL SUMMARY WIDGETS (6 KPI CARDS) */}
      <div
        className="no-break"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: '8px',
          marginBottom: '16px',
        }}
      >
        {/* Card 1: Completed Checkpoints */}
        <div
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '8px',
            textAlign: 'center',
            backgroundColor: '#ffffff',
          }}
        >
          <div
            style={{
              fontSize: '7pt',
              color: '#64748b',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            Checkpoints
          </div>
          <div
            style={{
              fontSize: '13pt',
              fontWeight: 900,
              color: '#2563eb',
              marginTop: '2px',
            }}
          >
            {completedCheckpoints}/{totalCheckpoints}
          </div>
          <div style={{ fontSize: '7pt', color: '#10b981', fontWeight: 700 }}>
            {completionPct}% Complete
          </div>
        </div>

        {/* Card 2: Successful Tasks */}
        <div
          style={{
            border: '1px solid #bbf7d0',
            borderRadius: '6px',
            padding: '8px',
            textAlign: 'center',
            backgroundColor: '#f0fdf4',
          }}
        >
          <div
            style={{
              fontSize: '7pt',
              color: '#166534',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            YES Tasks
          </div>
          <div
            style={{
              fontSize: '13pt',
              fontWeight: 900,
              color: '#16a34a',
              marginTop: '2px',
            }}
          >
            {yesCount}
          </div>
          <div style={{ fontSize: '7pt', color: '#15803d' }}>Passed</div>
        </div>

        {/* Card 3: Failed Tasks */}
        <div
          style={{
            border: '1px solid #fecaca',
            borderRadius: '6px',
            padding: '8px',
            textAlign: 'center',
            backgroundColor: '#fef2f2',
          }}
        >
          <div
            style={{
              fontSize: '7pt',
              color: '#991b1b',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            NO Tasks
          </div>
          <div
            style={{
              fontSize: '13pt',
              fontWeight: 900,
              color: '#dc2626',
              marginTop: '2px',
            }}
          >
            {noCount}
          </div>
          <div style={{ fontSize: '7pt', color: '#b91c1c' }}>
            Failed / Issues
          </div>
        </div>

        {/* Card 4: Snags Generated */}
        <div
          style={{
            border: '1px solid #fef08a',
            borderRadius: '6px',
            padding: '8px',
            textAlign: 'center',
            backgroundColor: '#fefce8',
          }}
        >
          <div
            style={{
              fontSize: '7pt',
              color: '#854d0e',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            Snags Raised
          </div>
          <div
            style={{
              fontSize: '13pt',
              fontWeight: 900,
              color: '#d97706',
              marginTop: '2px',
            }}
          >
            {snags.length}
          </div>
          <div style={{ fontSize: '7pt', color: '#b45309' }}>Maintenance</div>
        </div>

        {/* Card 5: Incidents */}
        <div
          style={{
            border: '1px solid #fed7aa',
            borderRadius: '6px',
            padding: '8px',
            textAlign: 'center',
            backgroundColor: '#fff7ed',
          }}
        >
          <div
            style={{
              fontSize: '7pt',
              color: '#9a3412',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            Incidents
          </div>
          <div
            style={{
              fontSize: '13pt',
              fontWeight: 900,
              color: '#ea580c',
              marginTop: '2px',
            }}
          >
            {incidents.length}
          </div>
          <div style={{ fontSize: '7pt', color: '#c2410c' }}>
            Security Alerts
          </div>
        </div>

        {/* Card 6: Photos Uploaded */}
        <div
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            padding: '8px',
            textAlign: 'center',
            backgroundColor: '#ffffff',
          }}
        >
          <div
            style={{
              fontSize: '7pt',
              color: '#64748b',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            Photo Evidence
          </div>
          <div
            style={{
              fontSize: '13pt',
              fontWeight: 900,
              color: '#475569',
              marginTop: '2px',
            }}
          >
            {allUploadedImages.length}
          </div>
          <div style={{ fontSize: '7pt', color: '#64748b' }}>Attached</div>
        </div>
      </div>

      {/* 4. MAIN CHECKPOINT TIMELINE & VERIFICATION CHECKLIST */}
      <div style={{ marginBottom: '16px' }}>
        <h2
          style={{
            fontSize: '11pt',
            fontWeight: 800,
            color: '#0f172a',
            textTransform: 'uppercase',
            borderBottom: '2px solid #0f172a',
            paddingBottom: '4px',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>📍 Checkpoint Sweep Timeline ({timeline.length})</span>
          <span
            style={{ fontSize: '8.5pt', fontWeight: 600, color: '#64748b' }}
          >
            Chronological Order
          </span>
        </h2>

        {timeline.map((item: any, idx: number) => {
          return (
            <div
              key={idx}
              className="no-break"
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '10px 12px',
                marginBottom: '10px',
                backgroundColor: '#ffffff',
              }}
            >
              {/* Checkpoint Header Row */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid #f1f5f9',
                  paddingBottom: '6px',
                  marginBottom: '8px',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <span
                    style={{
                      fontSize: '8pt',
                      fontWeight: 800,
                      backgroundColor: item.scanned ? '#2563eb' : '#94a3b8',
                      color: '#ffffff',
                      padding: '2px 8px',
                      borderRadius: '4px',
                    }}
                  >
                    SEQ #{item.sequence}
                  </span>
                  <span
                    style={{
                      fontSize: '10pt',
                      fontWeight: 800,
                      color: '#0f172a',
                    }}
                  >
                    {item.gate?.name || `Checkpoint #${item.sequence}`}
                  </span>
                  <span
                    style={{
                      fontSize: '8pt',
                      color: '#64748b',
                      fontFamily: 'monospace',
                    }}
                  >
                    ({item.gate?.gateCode || 'CODE'})
                  </span>
                </div>

                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                >
                  {item.scanned ? (
                    <span
                      style={{
                        fontSize: '8pt',
                        fontWeight: 800,
                        color: '#15803d',
                        backgroundColor: '#dcfce7',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid #bbf7d0',
                      }}
                    >
                      ✓ SCANNED: {new Date(item.scannedAt).toLocaleTimeString()}
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: '8pt',
                        fontWeight: 700,
                        color: '#b91c1c',
                        backgroundColor: '#fee2e2',
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      ✕ MISSED
                    </span>
                  )}
                </div>
              </div>

              {/* GPS & Gate Condition */}
              {item.scanned && (
                <div
                  style={{
                    fontSize: '8pt',
                    color: '#64748b',
                    marginBottom: '8px',
                    display: 'flex',
                    gap: '16px',
                  }}
                >
                  {item.scanCoords && <span>🌐 GPS: {item.scanCoords}</span>}
                  {item.status && (
                    <span>
                      🔧 Condition:{' '}
                      <strong
                        style={{
                          color: item.status === 'GOOD' ? '#16a34a' : '#dc2626',
                        }}
                      >
                        {item.status}
                      </strong>
                    </span>
                  )}
                  {item.remarks && (
                    <span>📝 Gate Sweep Note: "{item.remarks}"</span>
                  )}
                </div>
              )}

              {/* Sub Tasks Table */}
              {item.subTaskResponses && item.subTaskResponses.length > 0 ? (
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '8pt',
                    marginTop: '6px',
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        backgroundColor: '#f8fafc',
                        borderBottom: '1px solid #e2e8f0',
                      }}
                    >
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '4px 6px',
                          color: '#475569',
                        }}
                      >
                        Verification Task
                      </th>
                      <th
                        style={{
                          textAlign: 'center',
                          padding: '4px 6px',
                          color: '#475569',
                          width: '12%',
                        }}
                      >
                        Role
                      </th>
                      <th
                        style={{
                          textAlign: 'center',
                          padding: '4px 6px',
                          color: '#475569',
                          width: '12%',
                        }}
                      >
                        Answer
                      </th>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '4px 6px',
                          color: '#475569',
                          width: '30%',
                        }}
                      >
                        Employee Remarks
                      </th>
                      <th
                        style={{
                          textAlign: 'center',
                          padding: '4px 6px',
                          color: '#475569',
                          width: '22%',
                        }}
                      >
                        Evidence Photo
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.subTaskResponses.map((res: any, rIdx: number) => {
                      const isYes = res.answer === 'YES';
                      const taskTitle =
                        res.gateSubTask?.taskName ||
                        res.title ||
                        'Inspection Task';
                      const taskRole = res.gateSubTask?.role || 'SECURITY';
                      const taskImgs =
                        res.images && res.images.length > 0
                          ? res.images
                          : item.images && item.images.length > 0
                            ? item.images
                            : [];

                      return (
                        <tr
                          key={rIdx}
                          style={{
                            borderBottom:
                              rIdx === item.subTaskResponses.length - 1
                                ? 'none'
                                : '1px solid #f1f5f9',
                          }}
                        >
                          <td
                            style={{
                              padding: '5px 6px',
                              fontWeight: 600,
                              color: '#1e293b',
                            }}
                          >
                            {taskTitle}
                          </td>
                          <td
                            style={{
                              padding: '5px 6px',
                              textAlign: 'center',
                              color: '#64748b',
                            }}
                          >
                            {taskRole}
                          </td>
                          <td
                            style={{ padding: '5px 6px', textAlign: 'center' }}
                          >
                            <span
                              style={{
                                fontWeight: 800,
                                fontSize: '7.5pt',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: isYes ? '#dcfce7' : '#fee2e2',
                                color: isYes ? '#15803d' : '#b91c1c',
                                border: `1px solid ${isYes ? '#bbf7d0' : '#fecaca'}`,
                              }}
                            >
                              {isYes ? '✓ YES' : '✕ NO'}
                            </span>
                          </td>
                          <td style={{ padding: '5px 6px', color: '#334155' }}>
                            {res.remarks ? (
                              <span>"{res.remarks}"</span>
                            ) : (
                              <span
                                style={{
                                  color: '#94a3b8',
                                  fontStyle: 'italic',
                                }}
                              >
                                -
                              </span>
                            )}
                          </td>
                          <td
                            style={{ padding: '5px 6px', textAlign: 'center' }}
                          >
                            {taskImgs.length > 0 ? (
                              <div
                                style={{
                                  display: 'flex',
                                  gap: '4px',
                                  justifyContent: 'center',
                                  flexWrap: 'wrap',
                                }}
                              >
                                {taskImgs.map(
                                  (imgUrl: string, imgIdx: number) => (
                                    <img
                                      key={imgIdx}
                                      src={resolveImageUrl(imgUrl)}
                                      alt="Evidence"
                                      style={{
                                        width: '44px',
                                        height: '44px',
                                        objectFit: 'cover',
                                        borderRadius: '4px',
                                        border: '1px solid #cbd5e1',
                                      }}
                                    />
                                  ),
                                )}
                              </div>
                            ) : (
                              <span
                                style={{ color: '#94a3b8', fontSize: '7.5pt' }}
                              >
                                No Photo
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div
                  style={{
                    fontSize: '7.5pt',
                    color: '#94a3b8',
                    fontStyle: 'italic',
                  }}
                >
                  No role sub-tasks assigned for this checkpoint.
                </div>
              )}

              {/* Checkpoint Level Live Camera Evidence Photos */}
              {/* {item.scanned && item.images && item.images.length > 0 && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div
                    style={{
                      fontSize: '7.5pt',
                      fontWeight: 800,
                      color: '#475569',
                      textTransform: 'uppercase',
                      marginBottom: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>📷 Checkpoint Photo Evidence ({item.images.length})</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {item.images.map((imgUrl: string, imgIdx: number) => {
                      const fullUrl = resolveImageUrl(imgUrl);
                      return (
                        <img
                          key={imgIdx}
                          src={fullUrl}
                          alt={`Checkpoint evidence ${imgIdx + 1}`}
                          style={{
                            width: '54px',
                            height: '54px',
                            objectFit: 'cover',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1',
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              )} */}
            </div>
          );
        })}
      </div>

      {/* 5. GENERATED MAINTENANCE SNAGS SECTION */}
      {snags.length > 0 && (
        <div className="no-break" style={{ marginBottom: '16px' }}>
          <h2
            style={{
              fontSize: '10.5pt',
              fontWeight: 800,
              color: '#d97706',
              textTransform: 'uppercase',
              borderBottom: '2px solid #d97706',
              paddingBottom: '4px',
              marginBottom: '8px',
            }}
          >
            ⚠️ Automatically Generated Maintenance Snags ({snags.length})
          </h2>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '8pt',
              border: '1px solid #fef08a',
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: '#fefce8',
                  borderBottom: '1px solid #fef08a',
                }}
              >
                <th
                  style={{
                    textAlign: 'left',
                    padding: '6px',
                    color: '#854d0e',
                  }}
                >
                  Category
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '6px',
                    color: '#854d0e',
                  }}
                >
                  Location
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: '6px',
                    color: '#854d0e',
                  }}
                >
                  Priority
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '6px',
                    color: '#854d0e',
                  }}
                >
                  Description
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: '6px',
                    color: '#854d0e',
                  }}
                >
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {snags.map((snag: any, idx: number) => (
                <tr key={idx} style={{ borderBottom: '1px solid #fef9c3' }}>
                  <td
                    style={{
                      padding: '6px',
                      fontWeight: 700,
                      color: '#713f12',
                    }}
                  >
                    {snag.category}{' '}
                    {snag.subCategory ? `• ${snag.subCategory}` : ''}
                  </td>
                  <td style={{ padding: '6px', color: '#451a03' }}>
                    {snag.gate?.name || 'Site Facility'}
                  </td>
                  <td
                    style={{
                      padding: '6px',
                      textAlign: 'center',
                      fontWeight: 800,
                    }}
                  >
                    <span
                      style={{
                        color: snag.priority === 'HIGH' ? '#dc2626' : '#d97706',
                      }}
                    >
                      {snag.priority}
                    </span>
                  </td>
                  <td style={{ padding: '6px', color: '#1c1917' }}>
                    {snag.description}
                  </td>
                  <td
                    style={{
                      padding: '6px',
                      textAlign: 'center',
                      fontWeight: 700,
                    }}
                  >
                    {snag.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 6. REPORTED INCIDENTS SECTION */}
      {incidents.length > 0 && (
        <div className="no-break" style={{ marginBottom: '16px' }}>
          <h2
            style={{
              fontSize: '10.5pt',
              fontWeight: 800,
              color: '#dc2626',
              textTransform: 'uppercase',
              borderBottom: '2px solid #dc2626',
              paddingBottom: '4px',
              marginBottom: '8px',
            }}
          >
            🚨 Reported Security Incidents ({incidents.length})
          </h2>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '8pt',
              border: '1px solid #fecaca',
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: '#fef2f2',
                  borderBottom: '1px solid #fecaca',
                }}
              >
                <th
                  style={{
                    textAlign: 'left',
                    padding: '6px',
                    color: '#991b1b',
                  }}
                >
                  Type
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: '6px',
                    color: '#991b1b',
                  }}
                >
                  Severity
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '6px',
                    color: '#991b1b',
                  }}
                >
                  Description
                </th>
                <th
                  style={{
                    textAlign: 'center',
                    padding: '6px',
                    color: '#991b1b',
                  }}
                >
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc: any, idx: number) => (
                <tr key={idx} style={{ borderBottom: '1px solid #fee2e2' }}>
                  <td
                    style={{
                      padding: '6px',
                      fontWeight: 800,
                      color: '#991b1b',
                    }}
                  >
                    {inc.type}
                  </td>
                  <td
                    style={{
                      padding: '6px',
                      textAlign: 'center',
                      fontWeight: 800,
                      color: '#dc2626',
                    }}
                  >
                    {inc.severity}
                  </td>
                  <td style={{ padding: '6px', color: '#1f2937' }}>
                    {inc.description}
                  </td>
                  <td
                    style={{
                      padding: '6px',
                      textAlign: 'center',
                      color: '#4b5563',
                    }}
                  >
                    {new Date(inc.createdAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 7. SUPERVISOR VERIFICATION & SIGN-OFF STAMP */}
      <div
        className="no-break"
        style={{
          border: '2px solid #0f172a',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '16px',
          backgroundColor: '#f8fafc',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ flex: 1, paddingRight: '16px' }}>
          <div
            style={{
              fontSize: '8.5pt',
              fontWeight: 800,
              color: '#0f172a',
              textTransform: 'uppercase',
              marginBottom: '4px',
            }}
          >
            Supervisor Verification Audit & Approval
          </div>
          <div style={{ fontSize: '8pt', color: '#475569' }}>
            Verification Status:{' '}
            <strong
              style={{
                color:
                  session.verificationStatus === 'VERIFIED'
                    ? '#16a34a'
                    : session.verificationStatus === 'NOT_VERIFIED'
                      ? '#dc2626'
                      : '#d97706',
              }}
            >
              {session.verificationStatus === 'VERIFIED'
                ? '✓ VERIFIED & PASSED'
                : session.verificationStatus === 'NOT_VERIFIED'
                  ? '✕ REJECTED'
                  : '⏳ PENDING VERIFICATION'}
            </strong>
          </div>
          {session.verifiedBy && (
            <div
              style={{ fontSize: '8pt', color: '#475569', marginTop: '2px' }}
            >
              Supervisor:{' '}
              <strong>
                {session.verifiedBy.employee
                  ? `${session.verifiedBy.employee.firstName} ${session.verifiedBy.employee.lastName}`
                  : session.verifiedBy.email}
              </strong>{' '}
              | Verified:{' '}
              {session.verificationTime
                ? new Date(session.verificationTime).toLocaleString()
                : 'N/A'}
            </div>
          )}
          {session.supervisorRemarks && (
            <div
              style={{
                fontSize: '8pt',
                color: '#334155',
                marginTop: '4px',
                fontStyle: 'italic',
              }}
            >
              Remarks: "{session.supervisorRemarks}"
            </div>
          )}
        </div>

        {/* Digital Signature Placeholder Stamp */}
        <div
          style={{
            width: '180px',
            height: '64px',
            border: '2px dashed #94a3b8',
            borderRadius: '6px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#ffffff',
          }}
        >
          <span
            style={{
              fontSize: '7pt',
              color: '#94a3b8',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            Official Digital Signature
          </span>
          <span
            style={{
              fontSize: '8pt',
              fontWeight: 800,
              color: '#2563eb',
              marginTop: '2px',
            }}
          >
            {session.verificationStatus === 'VERIFIED'
              ? '✓ APPROVED & SIGNED'
              : 'PENDING STAMP'}
          </span>
        </div>
      </div>

      {/* 8. FINAL EXECUTIVE AUDIT RESULT BOX */}
      <div
        className="no-break"
        style={{
          border: `2px solid ${overallResultColor}`,
          backgroundColor: overallResultBg,
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '8pt',
              fontWeight: 800,
              color: overallResultColor,
              textTransform: 'uppercase',
            }}
          >
            Patrol Audit Result:
          </div>
          <div
            style={{
              fontSize: '14pt',
              fontWeight: 900,
              color: overallResultColor,
            }}
          >
            {overallResult}
          </div>
          <div style={{ fontSize: '8pt', color: '#334155', marginTop: '2px' }}>
            Checkpoints: {completedCheckpoints}/{totalCheckpoints} (Missed:{' '}
            {missedCheckpoints}) | Tasks: {totalTasks} (Passed: {yesCount},
            Failed: {noCount})
          </div>
        </div>

        <div
          style={{
            fontSize: '18pt',
            fontWeight: 900,
            color: overallResultColor,
          }}
        >
          {completionPct}%
        </div>
      </div>

      {/* 9. DOCUMENT FOOTER */}
      <div
        style={{
          borderTop: '1px solid #cbd5e1',
          paddingTop: '8px',
          marginTop: '12px',
          fontSize: '7.5pt',
          color: '#64748b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          Hello Orbit Security Platform (v2.4.0) — Official Enterprise
          Completion Report
        </div>
        <div>CONFIDENTIAL & PROPRIETARY — Page 1 of 1</div>
      </div>
    </div>
  );
}
