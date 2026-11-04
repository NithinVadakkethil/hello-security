import { isRoleMatching } from '../app/utils/role-matching';

export interface CheckpointTimelineTask {
  id: string;
  title: string;
  role: string;
  isRequired: boolean;
  answer: string;
  remarks: string | null;
  images: string[];
  answeredAt: string | Date | null;
  submittedBy: string;
}

export interface CheckpointTimelineItem {
  sequence: number;
  gate: any;
  scanned: boolean;
  scannedAt: string | Date | null;
  completedAt: string | Date | null;
  remarks: string | null;
  status: string | null;
  images: string[];
  subTaskResponses: any[];
  scanCoords: string | null;
  tasks: CheckpointTimelineTask[];
}

export function getReportOfficerInfo(report: any): { guardName: string; officerRole: string } {
  if (!report) {
    return { guardName: '—', officerRole: 'SECURITY' };
  }

  const emp = report.assignment?.employee || report.employee;
  const mgrEmp = report.managerUser?.employee;

  const guardName = emp
    ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() ||
      emp.name ||
      emp.email ||
      '—'
    : mgrEmp
      ? `${mgrEmp.firstName || ''} ${mgrEmp.lastName || ''}`.trim() || '—'
      : report.managerUser?.email ||
        (report.user
          ? `${report.user.firstName || ''} ${report.user.lastName || ''}`.trim() ||
            report.user.name
          : '') ||
        (report.officerName && report.officerName !== 'Inspector'
          ? report.officerName
          : '—');

  const officerRole =
    emp?.role ||
    mgrEmp?.role ||
    report.employeeRole ||
    (report.managerUserId ? 'MANAGER' : 'SECURITY');

  return { guardName, officerRole };
}

export function buildCheckpointEntry(
  sequence: number,
  gate: any,
  scan: any,
  guardName: string,
  officerRole: string,
): CheckpointTimelineItem {
  const scanned = !!scan;
  const configuredTasks: any[] = Array.isArray(gate?.subTasks)
    ? gate.subTasks.filter((st: any) => isRoleMatching(st.role, officerRole))
    : [];
  const responses: any[] = Array.isArray(scan?.subTaskResponses)
    ? scan.subTaskResponses.filter((res: any) =>
        isRoleMatching(res.gateSubTask?.role || res.roleSnapshot || res.role, officerRole),
      )
    : [];

  const responseMap = new Map<string, any>();
  for (const res of responses) {
    if (res.gateSubTaskId) responseMap.set(res.gateSubTaskId, res);
    if (res.id) responseMap.set(res.id, res);
    if (res.taskNameSnapshot) {
      responseMap.set(res.taskNameSnapshot.trim().toLowerCase(), res);
    }
    if (res.gateSubTask?.taskName) {
      responseMap.set(res.gateSubTask.taskName.trim().toLowerCase(), res);
    }
  }

  const combinedTasks: CheckpointTimelineTask[] = [];
  const matchedResponseIds = new Set<string>();

  if (configuredTasks.length > 0) {
    for (const st of configuredTasks) {
      const normalizedTaskName = st.taskName ? st.taskName.trim().toLowerCase() : '';
      const res = responseMap.get(st.id) || (normalizedTaskName ? responseMap.get(normalizedTaskName) : undefined);
      if (res) {
        if (res.id) matchedResponseIds.add(res.id);
        if (res.gateSubTaskId) matchedResponseIds.add(res.gateSubTaskId);
        combinedTasks.push({
          id: st.id,
          title: res.taskNameSnapshot || st.taskName || res.gateSubTask?.taskName || 'Verification Task',
          role: res.roleSnapshot || st.role || 'SECURITY',
          isRequired: st.isRequired ?? res.isRequiredSnapshot ?? false,
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

    // Append any unmapped submitted responses that weren't in configuredTasks
    for (const res of responses) {
      const isAlreadyMatched = (res.id && matchedResponseIds.has(res.id)) || (res.gateSubTaskId && matchedResponseIds.has(res.gateSubTaskId));
      if (!isAlreadyMatched) {
        combinedTasks.push({
          id: res.id || res.gateSubTaskId,
          title: res.taskNameSnapshot || res.gateSubTask?.taskName || res.taskName || 'Verification Task',
          role: res.roleSnapshot || res.gateSubTask?.role || res.role || 'SECURITY',
          isRequired: res.isRequiredSnapshot ?? res.gateSubTask?.isRequired ?? false,
          answer: res.answer || 'UNANSWERED',
          remarks: res.remarks || null,
          images: Array.isArray(res.images) ? res.images : [],
          answeredAt: res.answeredAt || res.createdAt || null,
          submittedBy: guardName,
        });
      }
    }
  } else if (responses.length > 0) {
    for (const res of responses) {
      combinedTasks.push({
        id: res.id || res.gateSubTaskId,
        title: res.taskNameSnapshot || res.gateSubTask?.taskName || res.taskName || 'Verification Task',
        role: res.roleSnapshot || res.gateSubTask?.role || res.role || 'SECURITY',
        isRequired: res.isRequiredSnapshot ?? res.gateSubTask?.isRequired ?? false,
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
    completedAt: scan?.completedAt ?? null,
    remarks: scan?.remarks ?? null,
    status: scan?.status ?? null,
    images: Array.isArray(scan?.images) ? scan.images : [],
    subTaskResponses: Array.isArray(scan?.subTaskResponses) ? scan.subTaskResponses : responses,
    scanCoords:
      scan?.latitude && scan?.longitude
        ? `${scan.latitude.toFixed(5)}, ${scan.longitude.toFixed(5)}`
        : null,
    tasks: combinedTasks,
  };
}

export function buildCheckpointTimeline(
  report: any,
  guardNameParam?: string,
  officerRoleParam?: string,
): CheckpointTimelineItem[] {
  if (!report) return [];

  const { guardName: defaultGuardName, officerRole: defaultOfficerRole } = getReportOfficerInfo(report);
  const guardName = guardNameParam || defaultGuardName;
  const officerRole = officerRoleParam || defaultOfficerRole;

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
    const timelineItems = sorted
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

    // Also include any scans that were recorded but not in the routeGates (e.g. offline scans or deactivated gates)
    let extraSeq = timelineItems.length > 0 ? Math.max(...timelineItems.map((item) => item.sequence)) + 1 : 1;
    for (const scan of scans) {
      const gateId = scan.gateId || scan.gate?.id;
      if (gateId && !seen.has(gateId)) {
        seen.add(gateId);
        const gate = scan.gate || {
          id: gateId,
          name: `Checkpoint ${extraSeq}`,
          gateCode: '—',
        };
        timelineItems.push(buildCheckpointEntry(extraSeq++, gate, scan, guardName, officerRole));
      }
    }

    return timelineItems;
  }

  const seen = new Set<string>();
  return scans
    .filter((scan: any) => {
      const id = scan.id || scan.gateId;
      if (!id || seen.has(id)) return false;
      seen.add(id);
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

export const SYSTEM_SYNC_METADATA_MARKERS = [
  'Auto-completed during sync catch-up',
  'Auto-completed upon starting a new patrol session.',
] as const;

export function isSystemSyncRemark(remark?: string | null): boolean {
  if (!remark) return false;
  const trimmed = remark.trim();
  if (!trimmed) return false;
  for (const marker of SYSTEM_SYNC_METADATA_MARKERS) {
    if (trimmed === marker) return true;
  }
  return trimmed.startsWith('[SYSTEM:') || trimmed.startsWith('[SYSTEM]');
}

export function cleanSystemRemark(remark?: string | null): string | null {
  if (!remark) return null;
  const trimmed = remark.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^\[SYSTEM(?::[A-Z_]+)?\]\s*/i, '');
}

