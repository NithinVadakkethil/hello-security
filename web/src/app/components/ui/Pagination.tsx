import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  const pageNum = Number(currentPage) || 1;
  const total = Number(totalPages) || 1;

  if (total <= 1 && pageNum <= 1) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '24px',
        padding: '8px 4px',
      }}
    >
      <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
        Page <strong style={{ color: 'var(--text-primary)' }}>{pageNum}</strong> of{' '}
        <strong style={{ color: 'var(--text-primary)' }}>{total}</strong>
      </span>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPageChange(Math.max(1, pageNum - 1));
          }}
          disabled={pageNum <= 1}
          className="btn btn-secondary"
          style={{
            padding: '8px 12px',
            opacity: pageNum <= 1 ? 0.5 : 1,
            cursor: pageNum <= 1 ? 'not-allowed' : 'pointer',
          }}
          aria-label="Previous Page"
        >
          <ChevronLeft size={16} />
          <span>Previous</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPageChange(Math.min(total, pageNum + 1));
          }}
          disabled={pageNum >= total}
          className="btn btn-secondary"
          style={{
            padding: '8px 12px',
            opacity: pageNum >= total ? 0.5 : 1,
            cursor: pageNum >= total ? 'not-allowed' : 'pointer',
          }}
          aria-label="Next Page"
        >
          <span>Next</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
