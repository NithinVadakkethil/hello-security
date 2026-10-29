import { calculateCompliancePercentage } from '../src/lib/compliance';
import { calculateCheckpointCompliance } from '../src/lib/checkpoint-eligibility';

describe('Web Compliance Calculation Suite', () => {
  it('calculates 0/0 as 0%', () => {
    expect(calculateCompliancePercentage(0, 0)).toBe(0);
    expect(calculateCheckpointCompliance(0, 0)).toBe(0);
  });

  it('calculates 0/1 as 0%', () => {
    expect(calculateCompliancePercentage(0, 1)).toBe(0);
    expect(calculateCheckpointCompliance(1, 0)).toBe(0);
  });

  it('calculates 1/1 as 100%', () => {
    expect(calculateCompliancePercentage(1, 1)).toBe(100);
    expect(calculateCheckpointCompliance(1, 1)).toBe(100);
  });

  it('calculates 3/5 as 60%', () => {
    expect(calculateCompliancePercentage(3, 5)).toBe(60);
    expect(calculateCheckpointCompliance(5, 3)).toBe(60);
  });

  it('calculates 8/10 as 80%', () => {
    expect(calculateCompliancePercentage(8, 10)).toBe(80);
    expect(calculateCheckpointCompliance(10, 8)).toBe(80);
  });

  it('calculates 8/11 as 73%', () => {
    expect(calculateCompliancePercentage(8, 11)).toBe(73);
    expect(calculateCheckpointCompliance(11, 8)).toBe(73);
  });

  it('guards against NaN, Infinity, negative, and invalid values', () => {
    expect(calculateCompliancePercentage(0, 0)).toBe(0);
    expect(calculateCompliancePercentage(-2, 0)).toBe(0);
    expect(calculateCompliancePercentage(0, -1)).toBe(0);
    expect(calculateCompliancePercentage(NaN as any, 10)).toBe(0);
    expect(calculateCompliancePercentage(5, NaN as any)).toBe(0);
    expect(calculateCompliancePercentage(undefined as any, null as any)).toBe(0);
  });
});

