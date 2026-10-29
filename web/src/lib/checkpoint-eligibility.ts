/**
 * Checkpoint Eligibility Utility (Frontend)
 *
 * Provides centralized, authoritative rules for determining whether a checkpoint
 * is eligible for a given patrol session across reports, compliance calculations,
 * and PDF generation.
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
  const isActuallyScanned = Boolean(isScanned || wasScanned);

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
