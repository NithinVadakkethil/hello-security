import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import DetailedReportModal from '../src/app/dashboard/reports/components/DetailedReportModal';

// Mock next/navigation if needed
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe('DetailedReportModal — Click Unscanned Summary Card to Scroll to First Unscanned Checkpoint', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const baseReport = {
    id: 'report-123',
    patrolCode: 'PTR-2026-001',
    status: 'COMPLETED',
    startedAt: '2026-10-28T09:00:00.000Z',
    endedAt: '2026-10-28T09:45:00.000Z',
    assignment: {
      site: { name: 'Tower A', address: '123 Business Bay' },
      employee: { firstName: 'John', lastName: 'Doe', role: 'SECURITY', employeeNumber: 'SEC-007' },
      patrolRoute: {
        name: 'Perimeter Route',
        routeGates: [
          { sequence: 1, gate: { id: 'g-1', name: 'Main Lobby', gateCode: 'GATE-001' } },
          { sequence: 2, gate: { id: 'g-2', name: 'East Staircase', gateCode: 'GATE-002' } },
          { sequence: 3, gate: { id: 'g-3', name: 'Roof Deck', gateCode: 'GATE-003' } },
        ],
      },
    },
    // Checkpoints: Only gate 1 was scanned, gates 2 and 3 are unscanned
    checkpoints: [
      {
        gateId: 'g-1',
        scannedAt: '2026-10-28T09:05:00.000Z',
        completedAt: '2026-10-28T09:07:00.000Z',
        status: 'GOOD',
      },
    ],
  };

  it('renders summary cards with correct Total (3), Scanned (1), and Unscanned (2) counts', () => {
    render(<DetailedReportModal isOpen={true} onClose={jest.fn()} report={baseReport} />);

    expect(screen.getByText('Total Checkpoints')).toBeTruthy();
    expect(screen.getByText('Scanned')).toBeTruthy();
    expect(screen.getByText('Unscanned')).toBeTruthy();

    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1); // Total
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1); // Scanned
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1); // Unscanned
  });

  it('makes the UNSCANNED card interactive with button semantics and pointer cursor when unscanned > 0', () => {
    render(<DetailedReportModal isOpen={true} onClose={jest.fn()} report={baseReport} />);

    const unscannedCard = screen.getByRole('button', {
      name: /Scroll to first unscanned checkpoint \(2 unscanned\)/i,
    });
    expect(unscannedCard).toBeTruthy();
    expect(unscannedCard.getAttribute('tabindex')).toBe('0');
    expect(unscannedCard.className).toContain('is-clickable');
  });

  it('smoothly scrolls to the first unscanned checkpoint (Seq #2) on click and triggers temporary highlight', () => {
    const { container } = render(<DetailedReportModal isOpen={true} onClose={jest.fn()} report={baseReport} />);

    // Mock scroll container scrollTo
    const scrollContainer = container.querySelector('.modal-content-body') as HTMLElement;
    const scrollToMock = jest.fn();
    if (scrollContainer) {
      scrollContainer.scrollTo = scrollToMock;
      scrollContainer.scrollTop = 50;
      jest.spyOn(scrollContainer, 'getBoundingClientRect').mockReturnValue({
        top: 100,
        bottom: 700,
        left: 0,
        right: 800,
        width: 800,
        height: 600,
      } as DOMRect);
    }

    // Mock target element rect for Seq #2
    const targetCheckpoint = container.querySelector('#checkpoint-timeline-item-2') as HTMLElement;
    expect(targetCheckpoint).toBeTruthy();
    jest.spyOn(targetCheckpoint, 'getBoundingClientRect').mockReturnValue({
      top: 350,
      bottom: 450,
      left: 0,
      right: 800,
      width: 800,
      height: 100,
    } as DOMRect);

    const unscannedCard = screen.getByRole('button', {
      name: /Scroll to first unscanned checkpoint/i,
    });

    // Before click, no highlight
    expect(targetCheckpoint.className).not.toContain('is-highlighted');

    fireEvent.click(unscannedCard);

    // After click:
    // offsetFromContainerTop = 350 - 100 = 250
    // targetScrollTop = 50 + 250 - 16 = 284
    expect(scrollToMock).toHaveBeenCalledWith({
      top: 284,
      behavior: 'smooth',
    });

    // Checkpoint Seq #2 is now highlighted
    expect(targetCheckpoint.className).toContain('is-highlighted');

    // Fast-forward 2.5s: highlight should clear automatically
    act(() => {
      jest.advanceTimersByTime(2500);
    });
    expect(targetCheckpoint.className).not.toContain('is-highlighted');
  });

  it('triggers scroll and highlight via keyboard Enter and Space activation', () => {
    const { container } = render(<DetailedReportModal isOpen={true} onClose={jest.fn()} report={baseReport} />);

    const scrollContainer = container.querySelector('.modal-content-body') as HTMLElement;
    const scrollToMock = jest.fn();
    if (scrollContainer) {
      scrollContainer.scrollTo = scrollToMock;
    }

    const unscannedCard = screen.getByRole('button', {
      name: /Scroll to first unscanned checkpoint/i,
    });
    const targetCheckpoint = container.querySelector('#checkpoint-timeline-item-2') as HTMLElement;

    // Test Enter key
    fireEvent.keyDown(unscannedCard, { key: 'Enter', code: 'Enter' });
    expect(scrollToMock).toHaveBeenCalled();
    expect(targetCheckpoint.className).toContain('is-highlighted');

    // Clear highlight
    act(() => {
      jest.advanceTimersByTime(2500);
    });
    expect(targetCheckpoint.className).not.toContain('is-highlighted');

    scrollToMock.mockClear();

    // Test Space key
    fireEvent.keyDown(unscannedCard, { key: ' ', code: 'Space' });
    expect(scrollToMock).toHaveBeenCalled();
    expect(targetCheckpoint.className).toContain('is-highlighted');
  });

  it('respects prefers-reduced-motion: reduce by using behavior: auto instead of smooth', () => {
    // Mock matchMedia to simulate prefers-reduced-motion: reduce
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    const { container } = render(<DetailedReportModal isOpen={true} onClose={jest.fn()} report={baseReport} />);

    const scrollContainer = container.querySelector('.modal-content-body') as HTMLElement;
    const scrollToMock = jest.fn();
    if (scrollContainer) {
      scrollContainer.scrollTo = scrollToMock;
    }

    const unscannedCard = screen.getByRole('button', {
      name: /Scroll to first unscanned checkpoint/i,
    });

    fireEvent.click(unscannedCard);

    expect(scrollToMock).toHaveBeenCalledWith(
      expect.objectContaining({
        behavior: 'auto',
      })
    );
  });

  it('is inert when all checkpoints are scanned (unscannedCount === 0)', () => {
    const allScannedReport = {
      ...baseReport,
      checkpoints: [
        { gateId: 'g-1', scannedAt: '2026-10-28T09:05:00.000Z', status: 'GOOD' },
        { gateId: 'g-2', scannedAt: '2026-10-28T09:15:00.000Z', status: 'GOOD' },
        { gateId: 'g-3', scannedAt: '2026-10-28T09:25:00.000Z', status: 'GOOD' },
      ],
    };

    const { container } = render(<DetailedReportModal isOpen={true} onClose={jest.fn()} report={allScannedReport} />);

    // Unscanned count is 0
    expect(screen.queryByRole('button', { name: /Scroll to first unscanned checkpoint/i })).toBeNull();

    const unscannedLabel = screen.getByText('Unscanned');
    const unscannedCard = unscannedLabel.closest('div')?.parentElement;
    expect(unscannedCard).toBeTruthy();
    expect(unscannedCard?.className).not.toContain('is-clickable');
    expect(unscannedCard?.getAttribute('role')).toBeNull();
    expect(unscannedCard?.getAttribute('tabindex')).toBeNull();

    // Clicking does not call scrollTo
    const scrollContainer = container.querySelector('.modal-content-body') as HTMLElement;
    const scrollToMock = jest.fn();
    if (scrollContainer) {
      scrollContainer.scrollTo = scrollToMock;
    }

    if (unscannedCard) {
      fireEvent.click(unscannedCard);
    }
    expect(scrollToMock).not.toHaveBeenCalled();
  });

  it('targets Seq #1 when the very first checkpoint in timeline is unscanned', () => {
    const firstUnscannedReport = {
      ...baseReport,
      // Only checkpoint 2 was scanned; Seq 1 is unscanned
      checkpoints: [
        { gateId: 'g-2', scannedAt: '2026-10-28T09:15:00.000Z', status: 'GOOD' },
      ],
    };

    const { container } = render(<DetailedReportModal isOpen={true} onClose={jest.fn()} report={firstUnscannedReport} />);

    const scrollContainer = container.querySelector('.modal-content-body') as HTMLElement;
    const scrollToMock = jest.fn();
    if (scrollContainer) {
      scrollContainer.scrollTo = scrollToMock;
    }

    const unscannedCard = screen.getByRole('button', {
      name: /Scroll to first unscanned checkpoint/i,
    });
    const seq1Checkpoint = container.querySelector('#checkpoint-timeline-item-1') as HTMLElement;
    expect(seq1Checkpoint).toBeTruthy();

    fireEvent.click(unscannedCard);

    expect(seq1Checkpoint.className).toContain('is-highlighted');
  });

  it('renders consistently across report null transitions without React Rules of Hooks violations', () => {
    // 1. Initial page state: Client Admin renders DetailedReportModal with report=null, isOpen=false
    const { rerender } = render(<DetailedReportModal isOpen={false} onClose={jest.fn()} report={null} />);
    expect(screen.queryByText('Total Checkpoints')).toBeNull();

    // 2. User clicks a row in Reports table: isOpen=true, report=baseReport
    expect(() => {
      rerender(<DetailedReportModal isOpen={true} onClose={jest.fn()} report={baseReport} />);
    }).not.toThrow();
    expect(screen.getByText('Total Checkpoints')).toBeTruthy();

    // 3. User closes modal: isOpen=false
    expect(() => {
      rerender(<DetailedReportModal isOpen={false} onClose={jest.fn()} report={null} />);
    }).not.toThrow();
    expect(screen.queryByText('Total Checkpoints')).toBeNull();

    // 4. User opens a different report with 0 checkpoints scanned
    const zeroScannedReport = {
      ...baseReport,
      id: 'report-zero',
      patrolCode: 'PTR-ZERO-001',
      checkpoints: [],
    };
    expect(() => {
      rerender(<DetailedReportModal isOpen={true} onClose={jest.fn()} report={zeroScannedReport} />);
    }).not.toThrow();
    expect(screen.getByText('Total Checkpoints')).toBeTruthy();
  });
});
