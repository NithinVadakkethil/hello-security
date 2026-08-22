import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number | 'all';
  pageSizeOptions?: (number | 'all')[];
  onPageSizeChange?: (size: number | 'all') => void;
  totalRecords?: number;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  totalRecords,
}: PaginationProps) {
  const pageNum = Number(currentPage) || 1;
  const total = Number(totalPages) || 1;
  const isAllSelected = pageSize === 'all';

  // If total pages <= 1, no page size options, and page is 1, hide completely
  if (total <= 1 && pageNum <= 1 && !pageSizeOptions && !isAllSelected) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '24px',
        padding: '8px 4px',
        flexWrap: 'wrap',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          {isAllSelected ? (
            <>
              Showing <strong style={{ color: 'var(--text-primary)' }}>All</strong>
              {totalRecords !== undefined && (
                <> ({totalRecords} total record{totalRecords === 1 ? '' : 's'})</>
              )}
            </>
          ) : (
            <>
              Page <strong style={{ color: 'var(--text-primary)' }}>{pageNum}</strong> of{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{total}</strong>
              {totalRecords !== undefined && (
                <> ({totalRecords} total record{totalRecords === 1 ? '' : 's'})</>
              )}
            </>
          )}
        </span>

        {pageSizeOptions && onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Rows per page:
            </span>
            <select
              value={isAllSelected ? 'all' : pageSize}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                onPageSizeChange(val);
              }}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-color)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={String(opt)} value={opt}>
                  {opt === 'all' ? 'All' : opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!isAllSelected && total > 1 && (
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
      )}
    </div>
  );
}
