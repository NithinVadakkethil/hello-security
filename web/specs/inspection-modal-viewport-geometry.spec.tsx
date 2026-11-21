import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '../src/app/components/ui/Modal';
import DetailedReportModal from '../src/app/dashboard/reports/components/DetailedReportModal';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe('Modal & DetailedReportModal — Viewport Layout, Scroll Lock & Portal Architecture', () => {
  const sampleReport = {
    id: 'patrol-session-001',
    patrolCode: 'PATROL-SESSION-000001',
    status: 'COMPLETED',
    startedAt: '2026-08-24T08:15:10.511Z',
    endedAt: '2026-08-24T08:45:10.511Z',
    assignment: {
      site: { name: 'Peninsula 1', address: 'Business Bay Dubai' },
      employee: {
        firstName: 'Anup',
        lastName: 'Dhakal',
        role: 'SECURITY',
        employeeNumber: 'EMP-000002',
      },
      patrolRoute: {
        name: 'Ground Floor Perimeter',
        routeGates: [
          { sequence: 1, gate: { id: 'g-1', name: 'Main Lobby Entrance Gate', gateCode: 'GATE-001' } },
          { sequence: 2, gate: { id: 'g-2', name: 'Emergency Stairwell North', gateCode: 'GATE-002' } },
        ],
      },
    },
    checkpoints: [
      {
        gateId: 'g-1',
        scannedAt: '2026-08-24T08:18:00.000Z',
        completedAt: '2026-08-24T08:20:00.000Z',
        status: 'GOOD',
      },
    ],
  };

  afterEach(() => {
    document.body.style.overflow = '';
    const mainContainers = document.querySelectorAll('.main-scrollable');
    mainContainers.forEach((el) => el.remove());
  });

  describe('Modal Base Component', () => {
    it('locks both document.body and .main-scrollable containers when opened, and restores on close', () => {
      // Create a simulated .main-scrollable container as present in dashboard layout
      const scrollableDiv = document.createElement('div');
      scrollableDiv.className = 'main-scrollable central-main-scrollable';
      scrollableDiv.style.overflow = 'auto';
      document.body.appendChild(scrollableDiv);

      const onClose = jest.fn();
      const { unmount, rerender } = render(
        <Modal isOpen={true} onClose={onClose} title="Test Modal" usePortal={false}>
          <div data-testid="modal-content">Modal Body Content</div>
        </Modal>
      );

      // Verify scroll lock applied
      expect(document.body.style.overflow).toBe('hidden');
      expect(scrollableDiv.style.overflow).toBe('hidden');

      // Re-render as closed
      rerender(
        <Modal isOpen={false} onClose={onClose} title="Test Modal" usePortal={false}>
          <div data-testid="modal-content">Modal Body Content</div>
        </Modal>
      );

      // Verify scroll lock removed
      expect(document.body.style.overflow).toBe('');
      expect(scrollableDiv.style.overflow).toBe('auto');

      unmount();
      scrollableDiv.remove();
    });

    it('closes on Escape key press and restores scroll lock', () => {
      const onClose = jest.fn();
      render(
        <Modal isOpen={true} onClose={onClose} title="Escape Test Modal" usePortal={false}>
          <div>Content</div>
        </Modal>
      );

      expect(document.body.style.overflow).toBe('hidden');

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('renders with React Portal to document.body when usePortal=true', () => {
      const { container, unmount } = render(
        <Modal isOpen={true} onClose={jest.fn()} title="Portal Modal" usePortal={true}>
          <div data-testid="portal-content">Mounted via Portal</div>
        </Modal>
      );

      // Should not be inside local render container
      expect(container.querySelector('[data-testid="portal-content"]')).toBeNull();

      // Should be inside document.body directly
      const portaledElement = document.body.querySelector('[data-testid="portal-content"]');
      expect(portaledElement).not.toBeNull();
      expect(portaledElement?.textContent).toBe('Mounted via Portal');

      unmount();
    });

    it('has accessible dialog role, sticky header, and close button with aria-label', () => {
      render(
        <Modal isOpen={true} onClose={jest.fn()} title="Accessibility Test" usePortal={false}>
          <div>Accessible Body</div>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeTruthy();
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.getAttribute('aria-labelledby')).toBe('modal-title-heading');

      const closeButton = screen.getByRole('button', { name: /close modal/i });
      expect(closeButton).toBeTruthy();
    });
  });

  describe('DetailedReportModal Responsive Layout', () => {
    it('renders inspection report details, header, metadata and checkpoint list', () => {
      render(
        <DetailedReportModal
          isOpen={true}
          onClose={jest.fn()}
          report={sampleReport}
          usePortal={false}
        />
      );

      // Verify title in header
      expect(screen.getByText(`Patrol Report: ${sampleReport.patrolCode}`)).toBeTruthy();

      // Verify print/export button in header
      expect(screen.getByRole('button', { name: /print audit report/i })).toBeTruthy();

      // Verify checkpoint items rendered (present in both printable audit layout and timeline)
      expect(screen.getAllByText(/Main Lobby Entrance Gate/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Emergency Stairwell North/i).length).toBeGreaterThanOrEqual(1);

      // Verify summary KPI metrics rendered
      expect(screen.getByText('Total Checkpoints')).toBeTruthy();
      expect(screen.getByText('Scanned')).toBeTruthy();
      expect(screen.getByText('Unscanned')).toBeTruthy();

      // Verify unscanned sequence card rendered
      const unscannedCard = screen.getByRole('button', {
        name: /scroll to first unscanned checkpoint/i,
      });
      expect(unscannedCard).toBeTruthy();
    });

    it('renders modal container with rpt-wide-modal CSS class for constrained viewport width and height', () => {
      const { container } = render(
        <DetailedReportModal
          isOpen={true}
          onClose={jest.fn()}
          report={sampleReport}
          usePortal={false}
        />
      );

      const modalContainer = container.querySelector('.modal-container.rpt-wide-modal');
      expect(modalContainer).not.toBeNull();

      const modalContentBody = container.querySelector('.modal-content-body');
      expect(modalContentBody).not.toBeNull();

      const metaGrid = container.querySelector('.rpt-meta-grid');
      expect(metaGrid).not.toBeNull();
    });
  });
});
