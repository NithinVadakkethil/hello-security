/**
 * Checkpoint Eligibility Utility
 * 
 * Provides centralized, authoritative rules for determining whether a checkpoint
 * is eligible for a given patrol session across reports, compliance calculations,
 * PDF generation, and mobile assignments.
 */

export interface CheckpointEligibilityParams {
  gate?: {
    id?: string;
    isActive?: boolean | null;
    updatedAt?: Date | string | null;
  } | null;
  session?: {
    startedAt?: Date | string | null;
    endedAt?: Date | string | null;
    status?: string | null;
    createdAt?: Date | string | null;
  } | null;
  isScanned?: boolean;
  wasScanned?: boolean;
}

/**
 * Determines whether a checkpoint is part of the eligible checkpoint set for a patrol session.
 * 
 * Rules:
 * 1. Historical Scan Preservation: Any checkpoint actually scanned during a patrol session
 *    is ALWAYS eligible and included. Historical scans and evidence must NEVER be removed
 *    or hidden merely because a checkpoint was deactivated later.
 * 2. Active Status: If the checkpoint is currently active (isActive !== false), it is eligible.
 * 3. Active/In-Progress Patrols: If the checkpoint is currently deactivated and was NOT scanned,
 *    it is strictly excluded from the eligible set for active/in-progress patrol sessions.
 *    It must never appear as Unscanned, Pending, Missed, or Incomplete.
 * 4. Completed Historical Patrols: If the session completed BEFORE the checkpoint's deactivation
 *    timestamp (gate.updatedAt), the checkpoint was active when the patrol took place and is
 *    preserved in the historical report. If the patrol started after deactivation, the checkpoint
 *    was already inactive and is excluded.
 */
export function isCheckpointEligibleForSession(params: CheckpointEligibilityParams): boolean {
  const { gate, session, isScanned, wasScanned } = params;
  const isActuallyScanned = Boolean(isScanned ?? wasScanned);

  // Rule 1: Scanned checkpoints are always eligible (never erase historical evidence)
  if (isActuallyScanned) {
    return true;
  }

  // Rule 2: Currently active checkpoints are eligible
  if (gate?.isActive !== false) {
    return true;
  }

  // The checkpoint is currently deactivated and was NOT scanned in this session.
  // Rule 3: For ongoing/active patrols, deactivated checkpoints are excluded
  const isSessionClosed = session?.status === 'COMPLETED' || session?.status === 'CANCELLED';
  if (!isSessionClosed) {
    return false;
  }

  // Rule 4: For completed historical patrols, check deactivation timing
  const sessionEndTime = session?.endedAt
    ? new Date(session.endedAt).getTime()
    : session?.startedAt
    ? new Date(session.startedAt).getTime()
    : session?.createdAt
    ? new Date(session.createdAt).getTime()
    : 0;
  const gateUpdateTime = gate?.updatedAt ? new Date(gate.updatedAt).getTime() : 0;

  if (sessionEndTime > 0 && gateUpdateTime > 0) {
    // If gate was updated/deactivated AFTER this historical patrol ended, it was active during the patrol
    if (gateUpdateTime > sessionEndTime) {
      return true;
    }
    // If gate was deactivated BEFORE this session started, it was already inactive
    return false;
  }

  // Safe default: do not count inactive gates as unscanned
  return false;
}

/**
 * Filters a timeline or gate list to only checkpoints eligible for the given session.
 */
export function filterEligibleCheckpointsForSession<T extends { gate?: any; scanned?: boolean }>(
  items: T[],
  session: any,
): T[] {
  return items.filter((item) =>
    isCheckpointEligibleForSession({
      gate: item.gate,
      session,
      isScanned: !!item.scanned,
    }),
  );
}

/**
 * Calculates checkpoint compliance rate based on eligible checkpoints and scanned count.
 * Returns 0% when there are 0 eligible checkpoints (0/0 = 0%).
 */
export function calculateCheckpointCompliance(totalEligible: number, scannedCount: number): number {
  if (totalEligible <= 0 || scannedCount <= 0) return 0;
  return Math.min(100, Math.round((Math.min(scannedCount, totalEligible) / totalEligible) * 100));
}

export interface SessionCheckpointMetrics {
  totalCheckpoints: number;
  scannedCheckpoints: number;
  missedCheckpoints: number;
  compliancePct: number;
  checkpointCompletionStatus: string;
  eligibleGateIds: string[];
  missedGateIds: string[];
  eligibleItems: any[];
  missedItems: any[];
}

/**
 * Authoritative checkpoint metrics calculation for a patrol session.
 * 
 * Invariants guaranteed:
 * - 0 <= scannedCheckpoints <= totalCheckpoints
 * - 0 <= missedCheckpoints <= totalCheckpoints
 * - scannedCheckpoints + missedCheckpoints === totalCheckpoints
 * - 0 <= compliancePct <= 100
 * - Finalized sessions with missed checkpoints are categorized as INCOMPLETE.
 */
export function calculateSessionCheckpointMetrics(session: any): SessionCheckpointMetrics {
  if (!session) {
    return {
      totalCheckpoints: 0,
      scannedCheckpoints: 0,
      missedCheckpoints: 0,
      compliancePct: 0,
      checkpointCompletionStatus: 'NO_CHECKPOINTS',
      eligibleGateIds: [],
      missedGateIds: [],
      eligibleItems: [],
      missedItems: [],
    };
  }

  const isDirect =
    session.assignment?.assignmentType === 'DIRECT_CHECKPOINTS' ||
    (!session.assignment?.patrolRoute && (session.assignment?.assignmentGates?.length || 0) > 0);

  const assignedItems: any[] = isDirect
    ? (session.assignment?.assignmentGates || [])
    : (session.assignment?.patrolRoute?.routeGates || []);

  // Collect distinct valid scanned gate IDs (ignoring rejected/invalid scans)
  const rawCheckpoints: any[] = session.checkpoints || [];
  const validScans = rawCheckpoints.filter(
    (cp: any) => cp && cp.status !== 'REJECTED' && cp.status !== 'INVALID',
  );
  const scannedGateIds = new Set<string>(
    validScans.map((cp: any) => cp.gateId || cp.gate?.id).filter(Boolean),
  );

  const sessionForEligibility = {
    status: session.status || 'COMPLETED',
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    createdAt: session.startedAt || session.createdAt,
  };

  const eligibleItems = assignedItems.filter((item: any) => {
    const gateId = item.gateId || item.gate?.id;
    if (!gateId) return false;
    const wasScanned = scannedGateIds.has(gateId);
    return isCheckpointEligibleForSession({
      gate: item.gate || { id: gateId, isActive: true },
      session: sessionForEligibility,
      isScanned: wasScanned,
      wasScanned,
    });
  });

  const eligibleGateIds = Array.from(
    new Set(eligibleItems.map((item: any) => item.gateId || item.gate?.id).filter(Boolean)),
  );

  const hasAssignedGates = assignedItems.length > 0;
  let totalCheckpoints = 0;
  let scannedCheckpoints = 0;
  let missedItems: any[] = [];
  let missedGateIds: string[] = [];

  if (hasAssignedGates) {
    totalCheckpoints = eligibleGateIds.length;
    // Distinct eligible checkpoints that were scanned
    scannedCheckpoints = eligibleGateIds.filter((gid) => scannedGateIds.has(gid)).length;
    missedItems = eligibleItems.filter((item: any) => {
      const gid = item.gateId || item.gate?.id;
      return !scannedGateIds.has(gid);
    });
    missedGateIds = Array.from(
      new Set(missedItems.map((item: any) => item.gateId || item.gate?.id).filter(Boolean)),
    );
  } else {
    // Ad-hoc patrols without pre-assigned route gates:
    // Every distinct valid checkpoint scanned is considered eligible and completed
    totalCheckpoints = scannedGateIds.size;
    scannedCheckpoints = scannedGateIds.size;
    missedItems = [];
    missedGateIds = [];
  }

  const missedCheckpoints = Math.max(0, totalCheckpoints - scannedCheckpoints);
  const compliancePct =
    totalCheckpoints > 0
      ? Math.min(100, Math.max(0, Math.round((scannedCheckpoints / totalCheckpoints) * 100)))
      : 0;

  const isFinalized = session.status === 'COMPLETED' || Boolean(session.endedAt);
  let checkpointCompletionStatus: string;

  if (session.status === 'CANCELLED' || session.status === 'FAILED') {
    checkpointCompletionStatus = session.status;
  } else if (!isFinalized) {
    checkpointCompletionStatus = 'IN_PROGRESS';
  } else if (totalCheckpoints === 0) {
    checkpointCompletionStatus = 'NO_CHECKPOINTS';
  } else if (missedCheckpoints === 0 && scannedCheckpoints >= totalCheckpoints) {
    checkpointCompletionStatus = 'COMPLETED';
  } else {
    checkpointCompletionStatus = 'INCOMPLETE';
  }

  return {
    totalCheckpoints,
    scannedCheckpoints,
    missedCheckpoints,
    compliancePct,
    checkpointCompletionStatus,
    eligibleGateIds,
    missedGateIds,
    eligibleItems,
    missedItems,
  };
}

export interface PatrolSessionsAggregateResult {
  totalPatrolSessions: number;
  completedPatrolSessions: number;
  incompletePatrolSessions: number;
  unclassifiablePatrolSessions: number;
  totalCheckpoints: number;
  checkpointsScanned: number;
  checkpointsMissed: number;
  averageCompliancePct: number;
  totalDurationSeconds: number;
  diagnostics: {
    unclassifiableIds: string[];
  };
}

/**
 * Shared authoritative aggregation across multiple patrol sessions.
 * 
 * Invariants guaranteed:
 * - Only finalized sessions are processed (status === 'COMPLETED' or endedAt is present).
 * - Excludes ongoing (IN_PROGRESS, PAUSED), CANCELLED, and FAILED sessions.
 * - For classifiable finalized sessions: totalPatrolSessions = completedPatrolSessions + incompletePatrolSessions + unclassifiablePatrolSessions
 * - checkpointsScanned <= totalCheckpoints
 * - checkpointsMissed === totalCheckpoints - checkpointsScanned
 * - 0 <= averageCompliancePct <= 100 (0% when totalCheckpoints === 0)
 */
export function calculatePatrolSessionsAggregate(sessions: any[]): PatrolSessionsAggregateResult {
  let completedPatrolSessions = 0;
  let incompletePatrolSessions = 0;
  let unclassifiablePatrolSessions = 0;
  let totalCheckpoints = 0;
  let checkpointsScanned = 0;
  let checkpointsMissed = 0;
  let totalDurationSeconds = 0;
  const unclassifiableIds: string[] = [];

  for (const session of sessions) {
    if (!session) continue;
    const status = (session.status || '').toUpperCase();
    if (status === 'CANCELLED' || status === 'FAILED' || status === 'IN_PROGRESS' || status === 'PAUSED') {
      continue;
    }
    const isFinalized = status === 'COMPLETED' || Boolean(session.endedAt);
    if (!isFinalized) {
      continue;
    }

    const metrics = calculateSessionCheckpointMetrics(session);
    if (metrics.checkpointCompletionStatus === 'COMPLETED') {
      completedPatrolSessions++;
    } else if (metrics.checkpointCompletionStatus === 'INCOMPLETE') {
      incompletePatrolSessions++;
    } else if (metrics.checkpointCompletionStatus === 'NO_CHECKPOINTS') {
      unclassifiablePatrolSessions++;
      unclassifiableIds.push(session.id || session.patrolCode || 'unknown');
    }

    totalCheckpoints += metrics.totalCheckpoints;
    checkpointsScanned += metrics.scannedCheckpoints;
    checkpointsMissed += metrics.missedCheckpoints;

    if (session.totalDuration && typeof session.totalDuration === 'number') {
      totalDurationSeconds += session.totalDuration;
    }
  }

  const totalPatrolSessions = completedPatrolSessions + incompletePatrolSessions + unclassifiablePatrolSessions;
  const averageCompliancePct =
    totalCheckpoints > 0
      ? Math.min(100, Math.round((checkpointsScanned / totalCheckpoints) * 100))
      : 0;

  return {
    totalPatrolSessions,
    completedPatrolSessions,
    incompletePatrolSessions,
    unclassifiablePatrolSessions,
    totalCheckpoints,
    checkpointsScanned,
    checkpointsMissed,
    averageCompliancePct,
    totalDurationSeconds,
    diagnostics: {
      unclassifiableIds,
    },
  };
}

/**
 * Calculates distinct active assigned checkpoints for an employee.
 * 
 * Rules:
 * 1. Only active assignments are included (isActive !== false, within effectiveFrom/effectiveTo).
 * 2. Only active routes are included (patrolRoute.isActive !== false).
 * 3. Only active checkpoints are included (gate.isActive !== false).
 * 4. Deduplication: Count distinct physical checkpoints by gateId (stable ID Set).
 *    If a gate is assigned across multiple routes or direct assignments, it is counted once.
 * 5. Does NOT multiply by patrol sessions, days, weeks, months, or completion counts.
 */
export function calculateEmployeeAssignedCheckpoints(
  assignments: any[],
  currentDate: Date = new Date(),
): number {
  if (!Array.isArray(assignments) || assignments.length === 0) {
    return 0;
  }

  const assignedGateIds = new Set<string>();
  const nowTime = currentDate.getTime();

  for (const assignment of assignments) {
    if (!assignment || assignment.isActive === false) continue;
    if (assignment.effectiveFrom && new Date(assignment.effectiveFrom).getTime() > nowTime) continue;
    if (assignment.effectiveTo && new Date(assignment.effectiveTo).getTime() < nowTime) continue;

    // Route-based checkpoint assignments
    if (assignment.patrolRoute && assignment.patrolRoute.isActive !== false) {
      const routeGates = assignment.patrolRoute.routeGates || [];
      for (const rg of routeGates) {
        const gate = rg.gate;
        const gateId = rg.gateId || gate?.id;
        if (gateId && gate?.isActive !== false) {
          assignedGateIds.add(gateId);
        }
      }
    }

    // Direct checkpoint assignments
    if (assignment.assignmentGates && Array.isArray(assignment.assignmentGates)) {
      for (const ag of assignment.assignmentGates) {
        const gate = ag.gate;
        const gateId = ag.gateId || gate?.id;
        if (gateId && gate?.isActive !== false) {
          assignedGateIds.add(gateId);
        }
      }
    }
  }

  return assignedGateIds.size;
}

