'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface CompanyCarouselItem {
  id: string;
  companyName: string;
  clientCode: string;
  clientLogoUrl?: string | null;
}

interface CompanyCarouselHeaderProps {
  clients: CompanyCarouselItem[];
  selectedClientId: string;
  onSelectClient: (id: string) => void;
}

export default function CompanyCarouselHeader({
  clients = [],
  selectedClientId,
  onSelectClient,
}: CompanyCarouselHeaderProps) {
  if (clients.length === 0) return null;

  const selectedIdx = clients.findIndex((c) => c.id === selectedClientId);
  const currentIdx = selectedIdx >= 0 ? selectedIdx : 0;

  const handlePrev = () => {
    const prevIdx = (currentIdx - 1 + clients.length) % clients.length;
    onSelectClient(clients[prevIdx].id);
  };

  const handleNext = () => {
    const nextIdx = (currentIdx + 1) % clients.length;
    onSelectClient(clients[nextIdx].id);
  };

  return (
    <div className="carousel-header-bar">
      <div className="carousel-title-group">
        <span className="carousel-label">Select Organization</span>
        <span className="carousel-counter">
          Company {currentIdx + 1} of {clients.length}
        </span>
      </div>

      {/* Quick Select Company Chips */}
      <div className="company-chips-row">
        {clients.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelectClient(c.id)}
            className={`company-chip ${c.id === selectedClientId ? 'active' : ''}`}
          >
            {c.companyName}
          </button>
        ))}
      </div>

      {/* Arrow Controls */}
      {clients.length > 1 && (
        <div className="carousel-controls">
          <button
            type="button"
            onClick={handlePrev}
            className="carousel-arrow-btn"
            aria-label="Previous Company"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="carousel-arrow-btn"
            aria-label="Next Company"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      <style jsx>{`
        .carousel-header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 12px 16px;
          background: var(--bg-card, #ffffff);
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 12px;
          flex-wrap: wrap;
        }
        .carousel-title-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .carousel-label {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-primary, #0f172a);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .carousel-counter {
          font-size: 0.75rem;
          font-weight: 700;
          color: #2563eb;
          background: rgba(37, 99, 235, 0.1);
          padding: 2px 8px;
          border-radius: 6px;
        }
        .company-chips-row {
          display: flex;
          align-items: center;
          gap: 8px;
          overflow-x: auto;
          flex: 1;
        }
        .company-chip {
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 0.82rem;
          font-weight: 600;
          background: var(--surface-color, #f8fafc);
          border: 1px solid var(--border-color, #e2e8f0);
          color: var(--text-secondary, #64748b);
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }
        .company-chip:hover {
          color: var(--text-primary, #0f172a);
          border-color: #2563eb;
        }
        .company-chip.active {
          background: #2563eb;
          color: #ffffff;
          border-color: #2563eb;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);
        }
        .carousel-controls {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .carousel-arrow-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--surface-color, #f8fafc);
          border: 1px solid var(--border-color, #e2e8f0);
          color: var(--text-primary, #0f172a);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .carousel-arrow-btn:hover {
          background: #2563eb;
          color: #ffffff;
          border-color: #2563eb;
        }
      `}</style>
    </div>
  );
}
