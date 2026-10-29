import {
  isCheckpointEligibleForSession,
  filterEligibleCheckpointsForSession,
  calculateCheckpointCompliance,
} from '../src/lib/checkpoint-eligibility';

describe('Web Checkpoint Eligibility & Compliance Utility', () => {
  it('identifies active checkpoint as eligible', () => {
    expect(
      isCheckpointEligibleForSession({
        gate: { id: 'g-1', name: 'Main Gate', isActive: true },
        session: { status: 'IN_PROGRESS' },
        wasScanned: false,
      })
    ).toBe(true);
  });

  it('excludes currently deactivated unscanned checkpoint from in-progress patrol', () => {
    expect(
      isCheckpointEligibleForSession({
        gate: { id: 'g-2', name: 'Service Exit', isActive: false },
        session: { status: 'IN_PROGRESS' },
        wasScanned: false,
      })
    ).toBe(false);
  });

  it('preserves scanned checkpoint even if deactivated', () => {
    expect(
      isCheckpointEligibleForSession({
        gate: { id: 'g-3', name: 'Fire Staircase', isActive: false },
        session: { status: 'COMPLETED' },
        wasScanned: true,
      })
    ).toBe(true);
  });

  it('correctly calculates compliance percentage (8 / 11 = 73%)', () => {
    const compliance = calculateCheckpointCompliance(11, 8);
    expect(compliance).toBe(73);
  });

  it('filters out ineligible checkpoints from timeline array', () => {
    const rawTimeline = [
      { id: '1', gate: { id: 'g-1', name: 'Gate 1', isActive: true }, isCompleted: true },
      { id: '2', gate: { id: 'g-2', name: 'Gate 2', isActive: false }, isCompleted: false },
      { id: '3', gate: { id: 'g-3', name: 'Gate 3', isActive: true }, isCompleted: false },
    ];
    const filtered = filterEligibleCheckpointsForSession(rawTimeline, { status: 'IN_PROGRESS' });
    expect(filtered).toHaveLength(2);
    expect(filtered.map((item) => item.gate.id)).toEqual(['g-1', 'g-3']);
  });
});
